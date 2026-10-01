// Pure, deterministic, non-LLM longitudinal aggregation over a user's saved
// AnalysisSessions. Mirrors lib/trainingPlanStats.ts's style: no DB access,
// no network calls, nothing async — every function here takes already-
// fetched, already-validated data and returns typed insights.
//
// This module makes zero calls into lib/providers.ts. Opening /progress must
// never invoke OpenAI/Gemini/Claude.
//
// TECHNICAL DEBT (documented, not built in Phase 5): GoalieReport has no way
// to know whether a category was MEANINGFULLY OBSERVABLE in a given clip — a
// report with no diving content can't be distinguished from "diving was
// fine" vs. "diving never came up." A future `observedCategories:
// RubricCategory[]` field on GoalieReport could close this gap and allow
// stronger absence-based evidence than Phase 5 uses. Not added here.
import { GoalieReport, RubricCategory, RUBRIC_CATEGORIES } from "@/lib/schemas";

// Deliberately decoupled from the DB row shape (lib/db.ts/lib/sessions.ts) —
// only the fields actually needed, so a future differently-stored source
// (e.g. a Phase 7 multi-video session) could supply this same shape without
// this module ever knowing how it was persisted.
export type ProgressSession = {
  id: string;
  createdAt: Date;
  report: GoalieReport;
};

// Bounded, temporary query size — not a permanent scaling strategy. Revisit
// with real pagination if a user's session count ever approaches this.
export const PROGRESS_SESSION_LIMIT = 100;

export const MIN_SESSIONS_FOR_TRENDS = 3;
export const MIN_SESSIONS_FOR_IMPROVING = 4;
export const RECURRING_WINDOW = 6;
export const STRENGTH_WINDOW = 5;
export const RECENT_FOCUS_WINDOW = 2;
export const MIN_OCCURRENCES = 2;

export type EvidenceItem = {
  sessionId: string;
  createdAt: Date;
  kind: "priority" | "strength" | "technicalIssue";
  title: string;
  timestamp: string;
};

export type CategoryProgressEvidence = {
  category: RubricCategory;
  priorityTotalCount: number;
  priorityRecentCount: number; // last min(RECURRING_WINDOW, total) sessions — generic display window
  priorityHistoricalCount: number; // before that window
  strengthTotalCount: number;
  strengthRecentCount: number; // same generic window, for consistent display
  strengthHistoricalCount: number;
  technicalIssueCount: number; // supporting context only — never drives a status
  mostRecentPriorityAt: Date | null;
  mostRecentStrengthAt: Date | null;
  evidence: EvidenceItem[]; // every occurrence for this category, full history, chronological
};

export type CategoryStatus =
  | "recurring-focus"
  | "recent-focus"
  | "improving"
  | "consistent-strength"
  | "not-enough-evidence";

export type CategoryInsight = {
  category: RubricCategory;
  status: CategoryStatus;
  explanation: string;
  metrics: CategoryProgressEvidence;
  // The subset of metrics.evidence that specifically supports this status.
  evidence: EvidenceItem[];
};

export type ProgressSummary = {
  totalSessions: number;
  firstAnalysisAt: Date | null;
  latestAnalysisAt: Date | null;
};

function sortChronological(sessions: ProgressSession[]): ProgressSession[] {
  return [...sessions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export function buildProgressSummary(sessions: ProgressSession[]): ProgressSummary {
  const sorted = sortChronological(sessions);
  return {
    totalSessions: sorted.length,
    firstAnalysisAt: sorted[0]?.createdAt ?? null,
    latestAnalysisAt: sorted[sorted.length - 1]?.createdAt ?? null,
  };
}

// Builds the raw, window-agnostic evidence for one category across all
// sessions, plus the generic last-RECURRING_WINDOW recent/historical split
// used for display. Specific rules below compute their own precise windowed
// counts directly from `evidence` where this generic split isn't exact
// enough (Recent Focus's exact last-2 check, Improving's half-split).
function buildCategoryEvidence(
  category: RubricCategory,
  sortedSessions: ProgressSession[]
): CategoryProgressEvidence {
  const evidence: EvidenceItem[] = [];

  for (const session of sortedSessions) {
    for (const priority of session.report.topPriorities) {
      if (priority.category === category) {
        evidence.push({
          sessionId: session.id,
          createdAt: session.createdAt,
          kind: "priority",
          title: priority.title,
          timestamp: priority.timestamp,
        });
      }
    }
    for (const strength of session.report.strengths) {
      if (strength.category === category) {
        evidence.push({
          sessionId: session.id,
          createdAt: session.createdAt,
          kind: "strength",
          title: strength.title,
          timestamp: strength.timestamp,
        });
      }
    }
    for (const issue of session.report.technicalIssues) {
      if (issue.category === category) {
        evidence.push({
          sessionId: session.id,
          createdAt: session.createdAt,
          kind: "technicalIssue",
          title: issue.observation,
          timestamp: issue.timestamp,
        });
      }
    }
  }

  const recentWindowSize = Math.min(RECURRING_WINDOW, sortedSessions.length);
  const recentSessionIds = new Set(sortedSessions.slice(-recentWindowSize).map((s) => s.id));

  const priorityItems = evidence.filter((e) => e.kind === "priority");
  const strengthItems = evidence.filter((e) => e.kind === "strength");
  const technicalIssueItems = evidence.filter((e) => e.kind === "technicalIssue");

  const priorityRecentCount = priorityItems.filter((e) => recentSessionIds.has(e.sessionId)).length;
  const strengthRecentCount = strengthItems.filter((e) => recentSessionIds.has(e.sessionId)).length;

  return {
    category,
    priorityTotalCount: priorityItems.length,
    priorityRecentCount,
    priorityHistoricalCount: priorityItems.length - priorityRecentCount,
    strengthTotalCount: strengthItems.length,
    strengthRecentCount,
    strengthHistoricalCount: strengthItems.length - strengthRecentCount,
    technicalIssueCount: technicalIssueItems.length,
    mostRecentPriorityAt: priorityItems.length
      ? priorityItems[priorityItems.length - 1].createdAt
      : null,
    mostRecentStrengthAt: strengthItems.length
      ? strengthItems[strengthItems.length - 1].createdAt
      : null,
    evidence,
  };
}

function classifyCategory(
  metrics: CategoryProgressEvidence,
  sortedSessions: ProgressSession[]
): { status: CategoryStatus; explanation: string; evidence: EvidenceItem[] } {
  const total = sortedSessions.length;
  const priorityEvidence = metrics.evidence.filter((e) => e.kind === "priority");
  const strengthEvidence = metrics.evidence.filter((e) => e.kind === "strength");

  if (total < MIN_SESSIONS_FOR_TRENDS) {
    return { status: "not-enough-evidence", explanation: "Not enough analyses yet.", evidence: [] };
  }

  // --- Recurring Focus ---
  const recurringWindowSize = Math.min(RECURRING_WINDOW, total);
  const recurringWindowIds = new Set(sortedSessions.slice(-recurringWindowSize).map((s) => s.id));
  const recurringWindowPriorityEvidence = priorityEvidence.filter((e) => recurringWindowIds.has(e.sessionId));
  const recurringCount = recurringWindowPriorityEvidence.length;
  const isRecurring = recurringCount >= Math.ceil(recurringWindowSize / 2) && recurringCount >= MIN_OCCURRENCES;
  if (isRecurring) {
    return {
      status: "recurring-focus",
      explanation: `Has appeared among your priorities in ${recurringCount} of your last ${recurringWindowSize} analyses.`,
      evidence: recurringWindowPriorityEvidence,
    };
  }

  // --- Recent Focus (only reachable once Recurring Focus is ruled out) ---
  if (total >= 3) {
    const recentFocusWindowSize = Math.min(RECENT_FOCUS_WINDOW, total);
    const recentSessions = sortedSessions.slice(-recentFocusWindowSize);
    const recentSessionIds = recentSessions.map((s) => s.id);
    const priorityIdsHit = new Set(priorityEvidence.map((e) => e.sessionId));
    const isRecentFocus =
      recentSessionIds.length === RECENT_FOCUS_WINDOW &&
      recentSessionIds.every((id) => priorityIdsHit.has(id));
    if (isRecentFocus) {
      const supportingEvidence = priorityEvidence.filter((e) => recentSessionIds.includes(e.sessionId));
      return {
        status: "recent-focus",
        explanation: `Has appeared as a priority in your last ${RECENT_FOCUS_WINDOW} analyses.`,
        evidence: supportingEvidence,
      };
    }
  }

  // --- Improving ---
  if (total >= MIN_SESSIONS_FOR_IMPROVING) {
    const splitIndex = Math.floor(total / 2);
    const historicalIds = new Set(sortedSessions.slice(0, splitIndex).map((s) => s.id));
    const recentIds = new Set(sortedSessions.slice(splitIndex).map((s) => s.id));
    const historicalPriorityEvidence = priorityEvidence.filter((e) => historicalIds.has(e.sessionId));
    const recentStrengthEvidence = strengthEvidence.filter((e) => recentIds.has(e.sessionId));
    const isImproving =
      historicalPriorityEvidence.length >= MIN_OCCURRENCES &&
      recentStrengthEvidence.length >= MIN_OCCURRENCES;
    if (isImproving) {
      return {
        status: "improving",
        explanation: `Appeared as a priority in ${historicalPriorityEvidence.length} earlier analyses and has shown up as a strength in ${recentStrengthEvidence.length} of your more recent analyses.`,
        evidence: [...historicalPriorityEvidence, ...recentStrengthEvidence],
      };
    }
  }

  // --- Consistent Strength ---
  const strengthWindowSize = Math.min(STRENGTH_WINDOW, total);
  const strengthWindowIds = new Set(sortedSessions.slice(-strengthWindowSize).map((s) => s.id));
  const strengthWindowEvidence = strengthEvidence.filter((e) => strengthWindowIds.has(e.sessionId));
  const strengthCount = strengthWindowEvidence.length;
  const isConsistentStrength =
    strengthCount >= Math.ceil(strengthWindowSize / 2) && strengthCount >= MIN_OCCURRENCES;
  if (isConsistentStrength) {
    return {
      status: "consistent-strength",
      explanation: `Has been identified as a strength in ${strengthCount} of your last ${strengthWindowSize} analyses.`,
      evidence: strengthWindowEvidence,
    };
  }

  return { status: "not-enough-evidence", explanation: "Not enough evidence for a pattern yet.", evidence: [] };
}

// Single pass producing one CategoryInsight per rubric category. All
// selector helpers below filter this one computed array, so nothing can
// drift between separately-recomputed functions.
export function computeCategoryInsights(sessions: ProgressSession[]): CategoryInsight[] {
  const validSessions = sessions.filter((s) => s.report != null);
  const sorted = sortChronological(validSessions);

  return RUBRIC_CATEGORIES.map((category) => {
    const metrics = buildCategoryEvidence(category, sorted);
    const { status, explanation, evidence } = classifyCategory(metrics, sorted);
    return { category, status, explanation, metrics, evidence };
  });
}

export function getRecurringFocus(insights: CategoryInsight[]): CategoryInsight[] {
  return insights.filter((i) => i.status === "recurring-focus");
}

export function getRecentFocus(insights: CategoryInsight[]): CategoryInsight[] {
  return insights.filter((i) => i.status === "recent-focus");
}

export function getImproving(insights: CategoryInsight[]): CategoryInsight[] {
  return insights.filter((i) => i.status === "improving");
}

export function getConsistentStrengths(insights: CategoryInsight[]): CategoryInsight[] {
  return insights.filter((i) => i.status === "consistent-strength");
}
