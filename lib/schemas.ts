// Zod schemas (runtime validation of every LLM JSON response) paired with
// hand-written JSON Schema consts (passed to each provider's structured
// output API). Keep each pair in sync when either changes.

import { z } from "zod";

export const RUBRIC_CATEGORIES = [
  "positioning",
  "setPosition",
  "footwork",
  "decisionMaking",
  "diving",
  "handling",
  "landing",
  "recovery",
  "distribution",
] as const;

export const RubricCategorySchema = z.enum(RUBRIC_CATEGORIES);
export type RubricCategory = z.infer<typeof RubricCategorySchema>;

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export const ConfidenceLevelSchema = z.enum(CONFIDENCE_LEVELS);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const PROVIDER_IDS = ["openai", "gemini", "claude"] as const;
export const ProviderIdSchema = z.enum(PROVIDER_IDS);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

export const DrillSuggestionSchema = z.object({
  name: z.string(),
  purpose: z.string(),
});
export type DrillSuggestion = z.infer<typeof DrillSuggestionSchema>;

const DRILL_SUGGESTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    purpose: { type: "string" },
  },
  required: ["name", "purpose"],
  additionalProperties: false,
};

// Phase 7: a single video-evidence location — WHICH clip + WHAT timestamp.
// Pre-Phase-7 reports have only a scalar `timestamp` and no references; the
// `evidenceReferences` field below is optional everywhere so they still
// parse. A multi-clip synthesized finding carries one reference per
// supporting clip, so "this pattern appeared across Clip 1, 2 and 4" is
// retained and each reference is independently Watch-able.
export const EvidenceReferenceSchema = z.object({
  clipId: z.string(),
  timestamp: z.string(),
});
export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;

const EVIDENCE_REFERENCE_JSON_SCHEMA = {
  type: "object",
  properties: {
    clipId: { type: "string" },
    timestamp: { type: "string" },
  },
  required: ["clipId", "timestamp"],
  additionalProperties: false,
};

export const KeyMomentSchema = z.object({
  timestamp: z.string(),
  description: z.string(),
});
export type KeyMoment = z.infer<typeof KeyMomentSchema>;

const KEY_MOMENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    timestamp: { type: "string" },
    description: { type: "string" },
  },
  required: ["timestamp", "description"],
  additionalProperties: false,
};

export const StrengthItemSchema = z.object({
  category: RubricCategorySchema,
  timestamp: z.string(),
  observation: z.string(),
  evidence: z.string(),
  confidence: ConfidenceLevelSchema,
});
export type StrengthItem = z.infer<typeof StrengthItemSchema>;

const STRENGTH_ITEM_JSON_SCHEMA = {
  type: "object",
  properties: {
    category: { type: "string", enum: RUBRIC_CATEGORIES },
    timestamp: { type: "string" },
    observation: { type: "string" },
    evidence: { type: "string" },
    confidence: { type: "string", enum: CONFIDENCE_LEVELS },
  },
  required: ["category", "timestamp", "observation", "evidence", "confidence"],
  additionalProperties: false,
};

export const TechnicalIssueItemSchema = z.object({
  category: RubricCategorySchema,
  timestamp: z.string(),
  observation: z.string(),
  evidence: z.string(),
  whyItMatters: z.string(),
  recommendation: z.string(),
  confidence: ConfidenceLevelSchema,
  // Phase 7 clip provenance (optional for backward compat; populated only
  // in multi-clip session reports). Persisted in GoalieReport.technicalIssues,
  // so it must not be left clip-ambiguous in a multi-clip report.
  evidenceReferences: z.array(EvidenceReferenceSchema).optional(),
});
export type TechnicalIssueItem = z.infer<typeof TechnicalIssueItemSchema>;

const TECHNICAL_ISSUE_ITEM_JSON_SCHEMA = {
  type: "object",
  properties: {
    category: { type: "string", enum: RUBRIC_CATEGORIES },
    timestamp: { type: "string" },
    observation: { type: "string" },
    evidence: { type: "string" },
    whyItMatters: { type: "string" },
    recommendation: { type: "string" },
    confidence: { type: "string", enum: CONFIDENCE_LEVELS },
  },
  required: [
    "category",
    "timestamp",
    "observation",
    "evidence",
    "whyItMatters",
    "recommendation",
    "confidence",
  ],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// UI-friendly report item types
//
// These are the shapes rendered in the final AI Goalie report. They are
// deliberately SEPARATE from the per-provider analysis item types above
// (StrengthItem / TechnicalIssueItem / KeyMoment) so the report can be
// concise and scannable — short titles + arrays of one-sentence bullets —
// without changing what the three provider analysis calls produce. The
// synthesis step maps the rich provider analyses into these.
// ---------------------------------------------------------------------------

export const ReportPrioritySchema = z.object({
  // Stable, title-derived slug (e.g. "first-step-efficiency"). Assigned
  // deterministically server-side (see normalizePriorityIds in providers),
  // used as the handle that Phase 2 will link training-plan drills to.
  id: z.string(),
  title: z.string(),
  category: RubricCategorySchema,
  timestamp: z.string(),
  observations: z.array(z.string()),
  whyItMatters: z.array(z.string()),
  howToImprove: z.array(z.string()),
  recommendedDrill: DrillSuggestionSchema,
  evidenceReferences: z.array(EvidenceReferenceSchema).optional(), // Phase 7 clip provenance
});
export type ReportPriority = z.infer<typeof ReportPrioritySchema>;

const REPORT_PRIORITY_JSON_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    category: { type: "string", enum: RUBRIC_CATEGORIES },
    timestamp: { type: "string" },
    observations: { type: "array", items: { type: "string" } },
    whyItMatters: { type: "array", items: { type: "string" } },
    howToImprove: { type: "array", items: { type: "string" } },
    recommendedDrill: DRILL_SUGGESTION_JSON_SCHEMA,
  },
  required: [
    "id",
    "title",
    "category",
    "timestamp",
    "observations",
    "whyItMatters",
    "howToImprove",
    "recommendedDrill",
  ],
  additionalProperties: false,
};

export const ReportStrengthSchema = z.object({
  title: z.string(),
  category: RubricCategorySchema,
  timestamp: z.string(),
  points: z.array(z.string()),
  evidenceReferences: z.array(EvidenceReferenceSchema).optional(), // Phase 7 clip provenance
});
export type ReportStrength = z.infer<typeof ReportStrengthSchema>;

const REPORT_STRENGTH_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    category: { type: "string", enum: RUBRIC_CATEGORIES },
    timestamp: { type: "string" },
    points: { type: "array", items: { type: "string" } },
  },
  required: ["title", "category", "timestamp", "points"],
  additionalProperties: false,
};

export const ReportKeyMomentSchema = z.object({
  timestamp: z.string(),
  label: z.string(),
  description: z.string(),
  evidenceReferences: z.array(EvidenceReferenceSchema).optional(), // Phase 7 clip provenance
});
export type ReportKeyMoment = z.infer<typeof ReportKeyMomentSchema>;

const REPORT_KEY_MOMENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    timestamp: { type: "string" },
    label: { type: "string" },
    description: { type: "string" },
  },
  required: ["timestamp", "label", "description"],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// (a) Per-provider rubric analysis
// ---------------------------------------------------------------------------

export const ProviderAnalysisSchema = z.object({
  summary: z.string(),
  strengths: z.array(StrengthItemSchema),
  technicalIssues: z.array(TechnicalIssueItemSchema),
  keyMoments: z.array(KeyMomentSchema),
  recommendedDrills: z.array(DrillSuggestionSchema),
});
export type ProviderAnalysis = z.infer<typeof ProviderAnalysisSchema>;

export const PROVIDER_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: STRENGTH_ITEM_JSON_SCHEMA },
    technicalIssues: { type: "array", items: TECHNICAL_ISSUE_ITEM_JSON_SCHEMA },
    keyMoments: { type: "array", items: KEY_MOMENT_JSON_SCHEMA },
    recommendedDrills: { type: "array", items: DRILL_SUGGESTION_JSON_SCHEMA },
  },
  required: ["summary", "strengths", "technicalIssues", "keyMoments", "recommendedDrills"],
  additionalProperties: false,
};

export type ProviderResult =
  | { provider: ProviderId; ok: true; analysis: ProviderAnalysis }
  | { provider: ProviderId; ok: false; error: string };

// ---------------------------------------------------------------------------
// (b) Final synthesized AI Goalie report
// ---------------------------------------------------------------------------

export const GoalieReportSchema = z.object({
  summary: z.string(),
  strengths: z.array(ReportStrengthSchema),
  // technicalIssues stays as the rich provider-analysis shape: it is NOT
  // rendered as its own section (priorities cover what to work on), but it
  // feeds training-plan generation and the synthesis fallback, so keep it.
  technicalIssues: z.array(TechnicalIssueItemSchema),
  topPriorities: z.array(ReportPrioritySchema).min(1).max(3),
  keyMoments: z.array(ReportKeyMomentSchema),
  recommendedDrills: z.array(DrillSuggestionSchema),
  sourceCount: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export type GoalieReport = z.infer<typeof GoalieReportSchema>;

export const GOALIE_REPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: REPORT_STRENGTH_JSON_SCHEMA },
    technicalIssues: { type: "array", items: TECHNICAL_ISSUE_ITEM_JSON_SCHEMA },
    topPriorities: { type: "array", items: REPORT_PRIORITY_JSON_SCHEMA },
    keyMoments: { type: "array", items: REPORT_KEY_MOMENT_JSON_SCHEMA },
    recommendedDrills: { type: "array", items: DRILL_SUGGESTION_JSON_SCHEMA },
    sourceCount: { type: "integer", enum: [1, 2, 3] },
  },
  required: [
    "summary",
    "strengths",
    "technicalIssues",
    "topPriorities",
    "keyMoments",
    "recommendedDrills",
    "sourceCount",
  ],
  additionalProperties: false,
};

// Phase 7 session-synthesis output schema. Identical to GOALIE_REPORT_JSON_
// SCHEMA except the four persisted, timestamp-bearing evidence types REQUIRE
// an `evidenceReferences` array so the cross-clip model must attribute every
// finding to its supporting clip(s). The per-clip /api/analyze-video pipeline
// keeps using GOALIE_REPORT_JSON_SCHEMA unchanged (scalar timestamps only);
// only callSessionSynthesis uses this one. Built by spreading the base item
// schemas so the two stay in sync.
function withEvidenceReferences(base: {
  type: string;
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: boolean;
}) {
  return {
    ...base,
    properties: {
      ...base.properties,
      evidenceReferences: { type: "array", items: EVIDENCE_REFERENCE_JSON_SCHEMA },
    },
    required: [...base.required, "evidenceReferences"],
  };
}

export const SESSION_GOALIE_REPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: withEvidenceReferences(REPORT_STRENGTH_JSON_SCHEMA) },
    technicalIssues: { type: "array", items: withEvidenceReferences(TECHNICAL_ISSUE_ITEM_JSON_SCHEMA) },
    topPriorities: { type: "array", items: withEvidenceReferences(REPORT_PRIORITY_JSON_SCHEMA) },
    keyMoments: { type: "array", items: withEvidenceReferences(REPORT_KEY_MOMENT_JSON_SCHEMA) },
    recommendedDrills: { type: "array", items: DRILL_SUGGESTION_JSON_SCHEMA },
    sourceCount: { type: "integer", enum: [1, 2, 3] },
  },
  required: [
    "summary",
    "strengths",
    "technicalIssues",
    "topPriorities",
    "keyMoments",
    "recommendedDrills",
    "sourceCount",
  ],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// (c) Training plan + player info
// ---------------------------------------------------------------------------

export const TrainingDrillSchema = z.object({
  name: z.string(),
  purpose: z.string(),
  // 3-6 short, concrete action steps (enforced by the prompt, not a schema
  // bound — consistent with observations/whyItMatters/howToImprove having
  // no min/max either).
  instructions: z.array(z.string()),
  sets: z.number().int().nullable(),
  repsOrDuration: z.string(),
  restSeconds: z.number().int().nullable(),
  // Structured link to a ReportPriority.id. Must be one of the ids the model
  // was actually given, or null for general/warm-up/recovery drills with no
  // single traceable priority. Not enforced as an enum in the JSON Schema
  // (schemas here are static consts; valid ids vary per report) — the server
  // post-validates in generateTrainingPlan and normalizes addressesIssue
  // from this id, so never trust addressesIssue independently of this field.
  addressesIssueId: z.string().nullable(),
  addressesIssue: z.string(),
  // Stable per-drill identity (Phase 6), assigned server-side via
  // assignDrillIds in lib/providers.ts — never produced by the model, never
  // derived from title/position. Deliberately optional (not required): a
  // plan persisted before this field existed has no drillId on any drill,
  // and must still safeParse successfully so historical plans stay
  // readable — the completion UI simply offers no "Mark Complete" control
  // on a drill that lacks one.
  drillId: z.string().optional(),
});
export type TrainingDrill = z.infer<typeof TrainingDrillSchema>;

const TRAINING_DRILL_JSON_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    purpose: { type: "string" },
    instructions: { type: "array", items: { type: "string" } },
    sets: { type: ["integer", "null"] },
    repsOrDuration: { type: "string" },
    restSeconds: { type: ["integer", "null"] },
    addressesIssueId: { type: ["string", "null"] },
    addressesIssue: { type: "string" },
  },
  required: [
    "name",
    "purpose",
    "instructions",
    "sets",
    "repsOrDuration",
    "restSeconds",
    "addressesIssueId",
    "addressesIssue",
  ],
  additionalProperties: false,
};

export const TrainingDaySchema = z.object({
  day: z.string(),
  focus: z.string(),
  isRestDay: z.boolean(),
  durationMinutes: z.number().int(),
  drills: z.array(TrainingDrillSchema),
});
export type TrainingDay = z.infer<typeof TrainingDaySchema>;

const TRAINING_DAY_JSON_SCHEMA = {
  type: "object",
  properties: {
    day: { type: "string" },
    focus: { type: "string" },
    isRestDay: { type: "boolean" },
    durationMinutes: { type: "integer" },
    drills: { type: "array", items: TRAINING_DRILL_JSON_SCHEMA },
  },
  required: ["day", "focus", "isRestDay", "durationMinutes", "drills"],
  additionalProperties: false,
};

export const TrainingPlanSchema = z.object({
  overview: z.string(),
  // The prompt asks for exactly 7 days, but we accept a range rather than a
  // hard length(7): the structured-output API doesn't enforce an exact count,
  // so occasionally the model returns 6 or 8 — showing that plan is far better
  // than hard-failing the whole request on an off-by-one. The UI renders
  // however many days are present.
  days: z.array(TrainingDaySchema).min(1).max(14),
});
export type TrainingPlan = z.infer<typeof TrainingPlanSchema>;

export const TRAINING_PLAN_JSON_SCHEMA = {
  type: "object",
  properties: {
    overview: { type: "string" },
    days: { type: "array", items: TRAINING_DAY_JSON_SCHEMA },
  },
  required: ["overview", "days"],
  additionalProperties: false,
};

export const PLAYING_LEVELS = ["recreational", "competitive", "elite"] as const;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const PlayerInfoSchema = z.object({
  age: z.number().int().min(5).max(60),
  playingLevel: z.enum(PLAYING_LEVELS),
  trainingGoal: z.string().min(1),
  availableDays: z.array(z.enum(WEEKDAYS)).min(1),
  sessionDurationMinutes: z.number().int().min(15).max(120),
  equipment: z.array(z.string()),
  hasTrainingPartner: z.boolean(),
});
export type PlayerInfo = z.infer<typeof PlayerInfoSchema>;

// ---------------------------------------------------------------------------
// API request/response envelopes
// ---------------------------------------------------------------------------

export const TimestampedFrameSchema = z.object({
  timestamp: z.number(),
  dataUrl: z.string(),
});
export type TimestampedFrame = z.infer<typeof TimestampedFrameSchema>;

export const AnalyzeVideoRequestSchema = z.object({
  frames: z.array(TimestampedFrameSchema).min(1),
});

export const TrainingPlanRequestSchema = z.object({
  report: GoalieReportSchema,
  playerInfo: PlayerInfoSchema,
  // Optional, used ONLY to exclude this session from the user's own
  // historical progress/training-history fetches when building adaptive
  // context (Phase 6) — never used to load/replace `report` above, which
  // stays client-supplied. If absent, adaptive context is not built at all
  // (see lib/adaptiveTraining.ts) rather than risking double-counting the
  // current report as if it were also historical.
  analysisSessionId: z.uuid().optional(),
});

// ---------------------------------------------------------------------------
// (d) Analysis session persistence (Phase 3 + Phase 7 clips)
// ---------------------------------------------------------------------------

// Centralized Phase 7 limits (enforced BOTH client-side for UX and
// server-side for cost/security — never trust the client's cap).
export const MAX_CLIPS_PER_SESSION = 5;
export const MAX_CONCURRENT_CLIP_ANALYSES = 2;

export const CLIP_STATUSES = ["analyzed", "failed"] as const;
export const ClipStatusSchema = z.enum(CLIP_STATUSES);
export type ClipStatus = z.infer<typeof ClipStatusSchema>;

// One persisted clip within a session. Only successfully-UPLOADED clips get a
// row (upload failures are transient UI state, never persisted — video_url is
// NOT NULL). `status` distinguishes analyzed vs uploaded-but-analysis-failed.
export const SessionClipInputSchema = z.object({
  clipId: z.uuid(),
  videoUrl: z.url(),
  videoFilename: z.string().min(1),
  displayOrder: z.number().int().min(0),
  status: ClipStatusSchema,
});
export type SessionClipInput = z.infer<typeof SessionClipInputSchema>;

export const CreateSessionRequestSchema = z.object({
  id: z.uuid(),
  // 1..MAX clips. Single-video sends a one-element array. Ordering is carried
  // by each clip's displayOrder, not array position.
  clips: z.array(SessionClipInputSchema).min(1).max(MAX_CLIPS_PER_SESSION),
  report: GoalieReportSchema,
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export const UpdateSessionRequestSchema = z.object({
  playerInfo: PlayerInfoSchema,
  trainingPlan: TrainingPlanSchema,
});
export type UpdateSessionRequest = z.infer<typeof UpdateSessionRequestSchema>;

// ---------------------------------------------------------------------------
// (e) Goalkeeper profile (Phase 4) — STABLE default preferences only.
//
// A profile holds the reusable, slow-changing fields that make sense to
// remember between sessions and prefill into the training form. It is a
// deliberate SUBSET of PlayerInfo: the session-specific fields
// (trainingGoal — the current focus; availableDays — this week's schedule)
// are intentionally excluded, so prefilling a profile never carries stale
// per-session intent into a new plan.
// ---------------------------------------------------------------------------

export const GoalkeeperProfileDefaultsSchema = PlayerInfoSchema.pick({
  age: true,
  playingLevel: true,
  sessionDurationMinutes: true,
  equipment: true,
  hasTrainingPartner: true,
});
export type GoalkeeperProfileDefaults = z.infer<typeof GoalkeeperProfileDefaultsSchema>;

export const ProfileRequestSchema = z.object({
  defaults: GoalkeeperProfileDefaultsSchema,
});
export type ProfileRequest = z.infer<typeof ProfileRequestSchema>;

// ---------------------------------------------------------------------------
// (f) Training drill completion tracking (Phase 6)
// ---------------------------------------------------------------------------

export const COMPLETION_STATUSES = ["completed", "skipped"] as const;
export const CompletionStatusSchema = z.enum(COMPLETION_STATUSES);
export type CompletionStatus = z.infer<typeof CompletionStatusSchema>;

export const SetCompletionRequestSchema = z.object({
  drillId: z.string().min(1),
  status: CompletionStatusSchema,
});
export type SetCompletionRequest = z.infer<typeof SetCompletionRequestSchema>;

export const DeleteCompletionRequestSchema = z.object({
  drillId: z.string().min(1),
});
export type DeleteCompletionRequest = z.infer<typeof DeleteCompletionRequestSchema>;

// ---------------------------------------------------------------------------
// (g) Multi-clip session synthesis (Phase 7)
// ---------------------------------------------------------------------------

// One successful per-clip report fed into cross-clip synthesis. `report` is a
// full per-clip GoalieReport (scalar timestamps, no evidenceReferences).
// `clipLabel` is a short human label ("Clip 2 — cross.mp4") given to the
// model for readable provenance; bounded to keep the request small.
export const SynthesisClipInputSchema = z.object({
  clipId: z.uuid(),
  clipLabel: z.string().min(1).max(80),
  report: GoalieReportSchema,
});
export type SynthesisClipInput = z.infer<typeof SynthesisClipInputSchema>;

// Bounded server-side (never trust the client cap): 1..MAX per-clip reports.
// 1 report is allowed but the route short-circuits (stamp provenance, no AI).
export const SynthesizeSessionRequestSchema = z.object({
  clips: z.array(SynthesisClipInputSchema).min(1).max(MAX_CLIPS_PER_SESSION),
});
export type SynthesizeSessionRequest = z.infer<typeof SynthesizeSessionRequestSchema>;
