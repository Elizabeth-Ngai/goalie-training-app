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

export const PriorityItemSchema = z.object({
  category: RubricCategorySchema,
  timestamp: z.string(),
  observation: z.string(),
  whyItMatters: z.string(),
  howToImprove: z.string(),
  recommendedDrill: DrillSuggestionSchema,
});
export type PriorityItem = z.infer<typeof PriorityItemSchema>;

const PRIORITY_ITEM_JSON_SCHEMA = {
  type: "object",
  properties: {
    category: { type: "string", enum: RUBRIC_CATEGORIES },
    timestamp: { type: "string" },
    observation: { type: "string" },
    whyItMatters: { type: "string" },
    howToImprove: { type: "string" },
    recommendedDrill: DRILL_SUGGESTION_JSON_SCHEMA,
  },
  required: [
    "category",
    "timestamp",
    "observation",
    "whyItMatters",
    "howToImprove",
    "recommendedDrill",
  ],
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
  strengths: z.array(StrengthItemSchema),
  technicalIssues: z.array(TechnicalIssueItemSchema),
  topPriorities: z.array(PriorityItemSchema).min(1).max(3),
  keyMoments: z.array(KeyMomentSchema),
  recommendedDrills: z.array(DrillSuggestionSchema),
  sourceCount: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export type GoalieReport = z.infer<typeof GoalieReportSchema>;

export const GOALIE_REPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: STRENGTH_ITEM_JSON_SCHEMA },
    technicalIssues: { type: "array", items: TECHNICAL_ISSUE_ITEM_JSON_SCHEMA },
    topPriorities: { type: "array", items: PRIORITY_ITEM_JSON_SCHEMA },
    keyMoments: { type: "array", items: KEY_MOMENT_JSON_SCHEMA },
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
  instructions: z.string(),
  sets: z.number().int().nullable(),
  repsOrDuration: z.string(),
  restSeconds: z.number().int().nullable(),
  addressesIssue: z.string(),
});
export type TrainingDrill = z.infer<typeof TrainingDrillSchema>;

const TRAINING_DRILL_JSON_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    purpose: { type: "string" },
    instructions: { type: "string" },
    sets: { type: ["integer", "null"] },
    repsOrDuration: { type: "string" },
    restSeconds: { type: ["integer", "null"] },
    addressesIssue: { type: "string" },
  },
  required: [
    "name",
    "purpose",
    "instructions",
    "sets",
    "repsOrDuration",
    "restSeconds",
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
});
