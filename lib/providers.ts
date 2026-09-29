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
import { formatTimestamp } from "@/lib/time";
import { ANALYSIS_PROMPT, SYNTHESIS_PROMPT, TRAINING_PLAN_PROMPT } from "@/lib/prompts";
import {
  GOALIE_REPORT_JSON_SCHEMA,
  GoalieReport,
  GoalieReportSchema,
  PROVIDER_ANALYSIS_JSON_SCHEMA,
  PlayerInfo,
  ProviderAnalysisSchema,
  ProviderId,
  ProviderResult,
  TRAINING_PLAN_JSON_SCHEMA,
  TrainingPlan,
  TrainingPlanSchema,
} from "@/lib/schemas";

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
const TRAINING_PLAN_TIMEOUT_MS = 45_000;

// Capping output length is the other half of bounding latency — generation
// time scales with tokens produced. These are generous enough for a full
// rubric / report but keep the slowest calls from running away.
const ANALYSIS_MAX_TOKENS = 3000;
const SYNTHESIS_MAX_TOKENS = 3000;
const TRAINING_PLAN_MAX_TOKENS = 6000;

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
      model: "gemini-3.8-flash",
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

    console.log("[providers] synthesis: ok");
    return { ok: true, report: parsed.data };
  } catch (error) {
    console.error("[providers] synthesis: failed");
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
export function buildReportFromAnalysis(
  analysis: import("@/lib/schemas").ProviderAnalysis
): GoalieReport | null {
  if (analysis.technicalIssues.length === 0) return null;

  const topPriorities = analysis.technicalIssues.slice(0, 3).map((issue) => ({
    category: issue.category,
    timestamp: issue.timestamp,
    observation: issue.observation,
    whyItMatters: issue.whyItMatters,
    howToImprove: issue.recommendation,
    recommendedDrill: analysis.recommendedDrills[0] ?? {
      name: `Targeted ${issue.category} drill`,
      purpose: issue.recommendation,
    },
  }));

  const candidate = {
    summary: analysis.summary,
    strengths: analysis.strengths,
    technicalIssues: analysis.technicalIssues,
    topPriorities,
    keyMoments: analysis.keyMoments,
    recommendedDrills: analysis.recommendedDrills,
    sourceCount: 1 as const,
  };

  const parsed = GoalieReportSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export async function generateTrainingPlan(
  report: GoalieReport,
  playerInfo: PlayerInfo
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
                technicalIssues: report.technicalIssues,
                strengths: report.strengths,
                playerInfo,
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

    console.log("[providers] training-plan: ok");
    return { ok: true, plan: parsed.data };
  } catch (error) {
    console.error("[providers] training-plan: failed");
    return { ok: false, error: (error as Error).message };
  }
}
