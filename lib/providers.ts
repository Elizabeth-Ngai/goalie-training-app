// All LLM-calling functions for the AI Goalie pipeline live here, kept out
// of the route files so they're independently callable (e.g. from a
// standalone script) without ever going through — or exposing anything via —
// an HTTP response. Each function is fault-isolated: it never throws, it
// always resolves to an {ok:true,...} or {ok:false,error} shape, and it logs
// only a sanitized one-line success/failure marker (provider name + ok/fail,
// never response content or key material).
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { formatTimestamp, parseTimestamp } from "@/lib/time";
import {
  ANALYSIS_PROMPT,
  SESSION_SYNTHESIS_PROMPT,
  SYNTHESIS_PROMPT,
  TRAINING_PLAN_PROMPT,
} from "@/lib/prompts";
import type { AdaptiveTrainingContext } from "@/lib/adaptiveTraining";
import {
  EvidenceReference,
  GOALIE_REPORT_JSON_SCHEMA,
  GoalieReport,
  GoalieReportSchema,
  PROVIDER_ANALYSIS_JSON_SCHEMA,
  PlayerInfo,
  ProviderAnalysis,
  ProviderAnalysisSchema,
  ProviderId,
  ProviderResult,
  ReportPriority,
  SESSION_GOALIE_REPORT_JSON_SCHEMA,
  TRAINING_PLAN_JSON_SCHEMA,
  TrainingPlan,
  TrainingPlanSchema,
} from "@/lib/schemas";

// Turn a priority title into a stable, URL-safe kebab-case slug, e.g.
// "First-Step Efficiency" -> "first-step-efficiency". These IDs are the
// handle Phase 2 will use to link training-plan drills to priorities.
function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "priority";
}

// Assign each priority a deterministic, title-derived id, de-duplicating with
// numeric suffixes so ids are unique within a single report regardless of
// what the model returned. Centralizes all id generation for both the
// synthesis and fallback paths.
function normalizePriorityIds(priorities: ReportPriority[]): ReportPriority[] {
  const seen = new Map<string, number>();
  return priorities.map((priority) => {
    const base = slugify(priority.title);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    return { ...priority, id };
  });
}

// addressesIssueId is the source of truth for a drill's link to a priority;
// addressesIssue is never trusted independently of it. A valid id gets its
// addressesIssue normalized to that priority's real title (discarding
// whatever free text the model paired with it); an id that doesn't match a
// real priority (hallucinated/stale) is fully unlinked rather than kept
// half-wired to free text we can no longer verify. A genuinely null id
// (the model's own "no specific priority" call for a general/warm-up drill)
// is left as-is — that free-text label is legitimate.
function sanitizeTrainingPlanIds(plan: TrainingPlan, priorities: ReportPriority[]): TrainingPlan {
  const titleById = new Map(priorities.map((p) => [p.id, p.title]));
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      drills: day.drills.map((drill) => {
        if (drill.addressesIssueId === null) return drill;
        const title = titleById.get(drill.addressesIssueId);
        if (title) return { ...drill, addressesIssue: title };
        return { ...drill, addressesIssueId: null, addressesIssue: "General Training" };
      }),
    })),
  };
}

// Assigns every drill a stable, globally-unique id (Phase 6 completion
// tracking). The provider never produces this field — it's not in
// TRAINING_DRILL_JSON_SCHEMA at all — so every drill always gets a fresh
// crypto.randomUUID() here, same "never trust the model for identity"
// precedent as normalizePriorityIds/sanitizeTrainingPlanIds above.
function assignDrillIds(plan: TrainingPlan): TrainingPlan {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      drills: day.drills.map((drill) => ({ ...drill, drillId: crypto.randomUUID() })),
    })),
  };
}

// Split a paragraph-ish string into short one-sentence bullets. Used only by
// the deterministic fallback (buildReportFromAnalysis), which has plain
// strings from a single provider analysis rather than the bulleted arrays the
// synthesis model produces. Falls back to the whole string as one bullet.
function toBullets(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : [text];
}

export type RawFrame = { timestamp: number; base64: string };

// Hard per-call timeouts are the safety net that keeps the whole route inside
// the 60s serverless budget. Measured tail latency on these LLM calls is
// wildly variable (a single call occasionally spiked past 100s even when it
// eventually succeeded). The three analysis calls run concurrently so the
// phase is bounded by ANALYSIS_TIMEOUT_MS; synthesis runs after, bounded by
// SYNTHESIS_TIMEOUT_MS — worst case ~54s, under the 60s ceiling. A call that
// exceeds its timeout is treated as that provider failing (for analysis) or,
// for synthesis, falls back to a deterministic report built from one
// analysis — never a hard Vercel function kill.
const ANALYSIS_TIMEOUT_MS = 26_000;
const SYNTHESIS_TIMEOUT_MS = 28_000;
// The training-plan call is its own request (own 60s budget, not competing
// with analysis+synthesis), so it can use most of that budget: a full 7-day
// plan is a large structured output and needs both time and token headroom
// to finish without truncating mid-JSON.
const TRAINING_PLAN_TIMEOUT_MS = 52_000;
// Phase 7 cross-clip synthesis is ALSO its own standalone request (own 60s
// budget, no competing analysis/synthesis), so like the training plan it gets
// most of that budget. Its output restates priorities/strengths/keyMoments/
// technicalIssues for up to 5 clips, each now carrying an evidenceReferences
// array — materially larger than a single-video synthesis, so it needs both
// the bigger timeout and the bigger token cap below to avoid timing out or
// truncating mid-JSON (which surfaced as "Couldn't combine your clips").
const SESSION_SYNTHESIS_TIMEOUT_MS = 52_000;

// Capping output length is the other half of bounding latency — generation
// time scales with tokens produced. These are generous enough for a full
// rubric / report but keep the slowest calls from running away.
const ANALYSIS_MAX_TOKENS = 3000;
const SYNTHESIS_MAX_TOKENS = 3000;
const TRAINING_PLAN_MAX_TOKENS = 8000;
const SESSION_SYNTHESIS_MAX_TOKENS = 8000;

// Anthropic's client resolves credentials lazily (only throws once a request
// is made), so it's safe to construct at module scope. OpenAI and
// @google/genai both throw synchronously in their constructors when no API
// key is available at all — constructing those at module scope was found
// (via testing) to crash the entire importing module, breaking every
// provider, not just the misconfigured one. So those two are constructed
// inside their own function's try block instead.
// maxRetries:0 on every client below (Anthropic/OpenAI default to 2, Gemini
// to 5 retries with exponential backoff). Retries are actively harmful here:
// a call that hits its timeout would otherwise be retried — up to doubling
// its time and blowing the route's 60s budget. Combined with the hard
// per-call timeouts above, maxRetries:0 makes a slow or down provider fail
// fast and predictably instead of dragging the whole route down.
const anthropic = new Anthropic({ maxRetries: 0 });

function frameContentText(frame: RawFrame): string {
  return `Frame — timestamp ${formatTimestamp(frame.timestamp)}`;
}

export async function callOpenAI(frames: RawFrame[]): Promise<ProviderResult> {
  try {
    const openai = new OpenAI({ maxRetries: 0 });
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      // "minimal" reasoning cuts this call from ~33s to ~10s on a real image
      // while still producing a substantive rubric — critical because this
      // runs inside the 60s serverless budget alongside a serial synthesis
      // call. Measured: default 33s / low 20s / minimal 10s.
      reasoning_effort: "minimal",
      max_completion_tokens: ANALYSIS_MAX_TOKENS,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: ANALYSIS_PROMPT },
            ...frames.flatMap((frame) => [
              { type: "text" as const, text: frameContentText(frame) },
              {
                type: "image_url" as const,
                image_url: { url: `data:image/jpeg;base64,${frame.base64}` },
              },
            ]),
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "provider_analysis",
          schema: PROVIDER_ANALYSIS_JSON_SCHEMA,
          strict: true,
        },
      },
    }, { timeout: ANALYSIS_TIMEOUT_MS });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content in OpenAI response");

    const parsed = ProviderAnalysisSchema.safeParse(JSON.parse(content));
    if (!parsed.success) throw new Error("Malformed OpenAI response");

    console.log("[providers] openai: ok");
    return { provider: "openai", ok: true, analysis: parsed.data };
  } catch (error) {
    console.error("[providers] openai: failed");
    return { provider: "openai", ok: false, error: (error as Error).message };
  }
}

export async function callGemini(frames: RawFrame[]): Promise<ProviderResult> {
  try {
    const genai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { retryOptions: { attempts: 1 }, timeout: ANALYSIS_TIMEOUT_MS },
    });
    const response = await genai.models.generateContent({
      // gemini-3.8-flash (Google's current default for new keys) is heavily
      // capacity-constrained right now — it intermittently 503s and, when it
      // does respond, routinely takes 15s+ even on trivial prompts, blowing
      // past ANALYSIS_TIMEOUT_MS. The flash-lite model is far less congested
      // (sub-second on a smoke test) and handles this multimodal + structured
      // JSON workload fine. Revisit if the full model's availability recovers.
      model: "gemini-3.5-flash-lite",
      contents: [
        {
          role: "user",
          parts: [
            { text: ANALYSIS_PROMPT },
            ...frames.flatMap((frame) => [
              { text: frameContentText(frame) },
              { inlineData: { mimeType: "image/jpeg", data: frame.base64 } },
            ]),
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: PROVIDER_ANALYSIS_JSON_SCHEMA,
        maxOutputTokens: ANALYSIS_MAX_TOKENS,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No content in Gemini response");

    const parsed = ProviderAnalysisSchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new Error("Malformed Gemini response");

    console.log("[providers] gemini: ok");
    return { provider: "gemini", ok: true, analysis: parsed.data };
  } catch (error) {
    console.error("[providers] gemini: failed");
    return { provider: "gemini", ok: false, error: (error as Error).message };
  }
}

export async function callClaude(frames: RawFrame[]): Promise<ProviderResult> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: ANALYSIS_MAX_TOKENS,
      messages: [
        {
          role: "user",
          content: [
            ...frames.flatMap((frame) => [
              { type: "text" as const, text: frameContentText(frame) },
              {
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: "image/jpeg" as const,
                  data: frame.base64,
                },
              },
            ]),
            { type: "text" as const, text: ANALYSIS_PROMPT },
          ],
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: PROVIDER_ANALYSIS_JSON_SCHEMA,
        },
      },
    }, { timeout: ANALYSIS_TIMEOUT_MS });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const parsed = ProviderAnalysisSchema.safeParse(JSON.parse(textBlock.text));
    if (!parsed.success) throw new Error("Malformed Claude response");

    console.log("[providers] claude: ok");
    return { provider: "claude", ok: true, analysis: parsed.data };
  } catch (error) {
    console.error("[providers] claude: failed");
    return { provider: "claude", ok: false, error: (error as Error).message };
  }
}

export type SynthesisInput = {
  provider: ProviderId;
  analysis: import("@/lib/schemas").ProviderAnalysis;
};

export async function callSynthesis(
  analyses: SynthesisInput[]
): Promise<{ ok: true; report: GoalieReport } | { ok: false; error: string }> {
  try {
    const openai = new OpenAI({ maxRetries: 0 });

    // Provider identity is never included in what gets sent to the model —
    // this is the structural guarantee (not just a prompt instruction) that
    // synthesis output can't leak which model produced which observation.
    const sourceAnalyses = analyses.map((a) => a.analysis);

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      // "minimal" keeps synthesis fast enough to stay well under the 60s
      // serverless budget after the analysis phase. The inputs are already
      // structured rubric analyses, so the merge/dedup/prioritize task holds
      // up well without heavy reasoning.
      reasoning_effort: "minimal",
      max_completion_tokens: SYNTHESIS_MAX_TOKENS,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: SYNTHESIS_PROMPT },
            {
              type: "text",
              text: JSON.stringify({
                sourceCount: sourceAnalyses.length,
                analyses: sourceAnalyses,
              }),
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "goalie_report",
          schema: GOALIE_REPORT_JSON_SCHEMA,
          strict: true,
        },
      },
    }, { timeout: SYNTHESIS_TIMEOUT_MS });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content in synthesis response");

    const parsed = GoalieReportSchema.safeParse(JSON.parse(content));
    if (!parsed.success) throw new Error("Malformed synthesis response");

    // Overwrite the model's ids with deterministic, title-derived, unique
    // slugs so we don't depend on the LLM producing clean/unique ids.
    const report: GoalieReport = {
      ...parsed.data,
      topPriorities: normalizePriorityIds(parsed.data.topPriorities),
    };

    console.log("[providers] synthesis: ok");
    return { ok: true, report };
  } catch (error) {
    console.error("[providers] synthesis: failed");
    return { ok: false, error: (error as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Phase 7: cross-clip session synthesis
// ---------------------------------------------------------------------------

export type SessionSynthesisClip = {
  clipId: string;
  clipLabel: string;
  report: GoalieReport;
};

type RefItem = { timestamp: string; evidenceReferences?: EvidenceReference[] };

// Every timestamp a clip's own report actually contains — the ONLY locations
// session synthesis is allowed to cite for that clip. The model reasons over
// these per-clip reports, not the raw video, so it must not invent a location.
function suppliedTimestampsByClip(clips: SessionSynthesisClip[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const clip of clips) {
    const ts = new Set<string>();
    for (const p of clip.report.topPriorities) ts.add(p.timestamp);
    for (const s of clip.report.strengths) ts.add(s.timestamp);
    for (const k of clip.report.keyMoments) ts.add(k.timestamp);
    for (const t of clip.report.technicalIssues) ts.add(t.timestamp);
    map.set(clip.clipId, ts);
  }
  return map;
}

// Drop any evidence reference unless ALL hold: clipId is a real supplied clip,
// timestamp parses, AND that exact timestamp appears in that clip's supplied
// report (can reason over evidence, cannot invent it). Then deterministically
// normalize the legacy scalar `timestamp` to the first surviving reference
// (never trusting the model to keep them in sync).
function sanitizeRefItem<T extends RefItem>(item: T, suppliedByClip: Map<string, Set<string>>): T {
  const refs = (item.evidenceReferences ?? []).filter(
    (r) =>
      suppliedByClip.has(r.clipId) &&
      parseTimestamp(r.timestamp) !== null &&
      suppliedByClip.get(r.clipId)!.has(r.timestamp)
  );
  return {
    ...item,
    evidenceReferences: refs,
    timestamp: refs.length > 0 ? refs[0].timestamp : item.timestamp,
  };
}

export function sanitizeEvidenceReferences(
  report: GoalieReport,
  suppliedByClip: Map<string, Set<string>>
): GoalieReport {
  return {
    ...report,
    topPriorities: report.topPriorities.map((p) => sanitizeRefItem(p, suppliedByClip)),
    strengths: report.strengths.map((s) => sanitizeRefItem(s, suppliedByClip)),
    keyMoments: report.keyMoments.map((k) => sanitizeRefItem(k, suppliedByClip)),
    technicalIssues: report.technicalIssues.map((t) => sanitizeRefItem(t, suppliedByClip)),
  };
}

// Deterministic (no LLM): give every finding of a single-clip report a single
// evidence reference pointing at that clip, using the finding's own timestamp.
// Used for the "multiple clips uploaded but only one analyzed" case so the
// surviving clip's provenance is preserved rather than collapsing to a
// legacy clip-less report.
export function stampSingleClipProvenance(report: GoalieReport, clipId: string): GoalieReport {
  const stamp = <T extends RefItem>(item: T): T => ({
    ...item,
    evidenceReferences: [{ clipId, timestamp: item.timestamp }],
  });
  return {
    ...report,
    topPriorities: report.topPriorities.map(stamp),
    strengths: report.strengths.map(stamp),
    keyMoments: report.keyMoments.map(stamp),
    technicalIssues: report.technicalIssues.map(stamp),
  };
}

// Cross-clip synthesis: merge 2+ already-synthesized per-clip reports into ONE
// session report whose evidence is attributed to supporting clips. Text-only
// (no images), so it's fast and its input is bounded to <=5 compact reports.
export async function callSessionSynthesis(
  clips: SessionSynthesisClip[]
): Promise<{ ok: true; report: GoalieReport } | { ok: false; error: string }> {
  try {
    const openai = new OpenAI({ maxRetries: 0 });

    const response = await openai.chat.completions.create(
      {
        model: "gpt-5-mini",
        reasoning_effort: "minimal",
        max_completion_tokens: SESSION_SYNTHESIS_MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: SESSION_SYNTHESIS_PROMPT },
              {
                type: "text",
                text: JSON.stringify({
                  clips: clips.map((c) => ({
                    clipId: c.clipId,
                    clipLabel: c.clipLabel,
                    report: c.report,
                  })),
                }),
              },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "session_goalie_report",
            schema: SESSION_GOALIE_REPORT_JSON_SCHEMA,
            strict: true,
          },
        },
      },
      { timeout: SESSION_SYNTHESIS_TIMEOUT_MS }
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content in session synthesis response");

    const parsed = GoalieReportSchema.safeParse(JSON.parse(content));
    if (!parsed.success) throw new Error("Malformed session synthesis response");

    const suppliedByClip = suppliedTimestampsByClip(clips);
    const report = sanitizeEvidenceReferences(
      { ...parsed.data, topPriorities: normalizePriorityIds(parsed.data.topPriorities) },
      suppliedByClip
    );

    console.log("[providers] session-synthesis: ok");
    return { ok: true, report };
  } catch (error) {
    console.error("[providers] session-synthesis: failed");
    return { ok: false, error: (error as Error).message };
  }
}

// Deterministic fallback: turn a single validated ProviderAnalysis into a
// GoalieReport with no extra LLM call. Used when synthesis fails (e.g. times
// out) but we still have at least one good analysis — far better to show a
// usable report built from real analysis data than to fail the whole request
// after the analysis calls already succeeded. Returns null only if the
// analysis lacks the technical issues needed to populate the required
// topPriorities. sourceCount is forced to 1 since only one analysis shaped
// this report, which also surfaces the UI's "partial analysis" note.
const CATEGORY_TITLES: Record<string, string> = {
  positioning: "Positioning",
  setPosition: "Set Position",
  footwork: "Footwork",
  decisionMaking: "Decision Making",
  diving: "Diving",
  handling: "Handling",
  landing: "Landing",
  recovery: "Recovery",
  distribution: "Distribution",
};

export function buildReportFromAnalysis(
  analysis: ProviderAnalysis
): GoalieReport | null {
  if (analysis.technicalIssues.length === 0) return null;

  const topPriorities = normalizePriorityIds(
    analysis.technicalIssues.slice(0, 3).map((issue) => ({
      id: "", // assigned by normalizePriorityIds
      title: CATEGORY_TITLES[issue.category] ?? issue.category,
      category: issue.category,
      timestamp: issue.timestamp,
      observations: toBullets(issue.observation),
      whyItMatters: toBullets(issue.whyItMatters),
      howToImprove: toBullets(issue.recommendation),
      recommendedDrill: analysis.recommendedDrills[0] ?? {
        name: `Targeted ${CATEGORY_TITLES[issue.category] ?? issue.category} drill`,
        purpose: issue.recommendation,
      },
    }))
  );

  const strengths = analysis.strengths.map((strength) => ({
    title: CATEGORY_TITLES[strength.category] ?? strength.category,
    category: strength.category,
    timestamp: strength.timestamp,
    points: toBullets(strength.observation),
  }));

  const keyMoments = analysis.keyMoments.map((moment) => ({
    timestamp: moment.timestamp,
    label: "",
    description: moment.description,
  }));

  const candidate = {
    summary: analysis.summary,
    strengths,
    technicalIssues: analysis.technicalIssues,
    topPriorities,
    keyMoments,
    recommendedDrills: analysis.recommendedDrills,
    sourceCount: 1 as const,
  };

  const parsed = GoalieReportSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export async function generateTrainingPlan(
  report: GoalieReport,
  playerInfo: PlayerInfo,
  // Optional (Phase 6). Compact, deterministic, pre-computed server-side —
  // see lib/adaptiveTraining.ts. When absent, the plan is generated exactly
  // as it always was, from the current report + playerInfo alone.
  adaptiveContext?: AdaptiveTrainingContext
): Promise<{ ok: true; plan: TrainingPlan } | { ok: false; error: string }> {
  try {
    const openai = new OpenAI({ maxRetries: 0 });

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      // "low" keeps the plan coherent while staying well under this route's
      // own 60s budget (measured ~44s at default reasoning).
      reasoning_effort: "low",
      max_completion_tokens: TRAINING_PLAN_MAX_TOKENS,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: TRAINING_PLAN_PROMPT },
            {
              type: "text",
              text: JSON.stringify({
                topPriorities: report.topPriorities,
                validPriorityIds: report.topPriorities.map((p) => p.id),
                technicalIssues: report.technicalIssues,
                strengths: report.strengths,
                playerInfo,
                ...(adaptiveContext ? { adaptiveContext } : {}),
              }),
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "training_plan",
          schema: TRAINING_PLAN_JSON_SCHEMA,
          strict: true,
        },
      },
    }, { timeout: TRAINING_PLAN_TIMEOUT_MS });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content in training plan response");

    const parsed = TrainingPlanSchema.safeParse(JSON.parse(content));
    if (!parsed.success) throw new Error("Malformed training plan response");

    const plan = assignDrillIds(sanitizeTrainingPlanIds(parsed.data, report.topPriorities));

    console.log("[providers] training-plan: ok");
    return { ok: true, plan };
  } catch (error) {
    console.error("[providers] training-plan: failed");
    return { ok: false, error: (error as Error).message };
  }
}
