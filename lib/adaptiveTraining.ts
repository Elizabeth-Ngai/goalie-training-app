// Deterministic, pure, non-LLM adaptive-context builder (Phase 6). Mirrors
// lib/progress.ts's and lib/trainingPlanStats.ts's style: no DB access, no
// network calls — every function here takes already-fetched data and
// returns a compact structure for the training-plan prompt.
//
// Reuses lib/progress.ts's computeCategoryInsights as the single source of
// truth for longitudinal progress — this module does NOT reimplement or
// duplicate that logic, only adds a training-completion dimension on top.
//
// TECHNICAL DEBT (documented, not built in Phase 6): the deterministic
// "why this plan emphasizes X" explanation (see explainAdaptation below) is
// only ever computed and shown immediately after a fresh generation — it is
// never persisted and never reconstructed later for a historical plan on
// /history/[id], because recomputing it against a user's CURRENT progress
// state would misrepresent the reasoning that actually applied when that
// old plan was generated. A future phase may persist a compact snapshot of
// the AdaptiveTrainingContext (or its explanation) alongside the plan so
// historical sessions can explain their original rationale accurately.
import {
  computeCategoryInsights,
  getConsistentStrengths,
  getImproving,
  getRecentFocus,
  getRecurringFocus,
  MIN_SESSIONS_FOR_TRENDS,
  type CategoryInsight,
  type ProgressSession,
} from "@/lib/progress";
import type { CompletionStatus, GoalieReport, RubricCategory } from "@/lib/schemas";
import type { RecentSessionDetail } from "@/lib/sessions";
import type { DrillCompletionRecord } from "@/lib/trainingCompletions";

// Only the most recent N previous sessions ever contribute training-history
// evidence to adaptive context — never a user's lifetime history. Matches
// Phase 5's own session-count-based windows (RECURRING_WINDOW=6,
// STRENGTH_WINDOW=5) in spirit; centralized here, not scattered.
export const ADAPTIVE_TRAINING_HISTORY_LIMIT = 10;

export type RecentTrainingEvidence = {
  completedCount: number;
  skippedCount: number;
  untrackedCount: number; // UNKNOWN, not "didn't train" — never inferred as negative
  totalRecommended: number;
};

const EMPTY_TRAINING_EVIDENCE: RecentTrainingEvidence = {
  completedCount: 0,
  skippedCount: 0,
  untrackedCount: 0,
  totalRecommended: 0,
};

export type CompactCategorySignal = {
  category: RubricCategory;
  occurrences: number;
  recentOccurrences: number;
};

export type AdaptivePriorityContext = {
  category: RubricCategory;
  priorityId: string; // from the CURRENT report's topPriorities
  title: string;
  isRecurringFocus: boolean;
  isRecentFocus: boolean;
  isImproving: boolean;
  isConsistentStrength: boolean;
  recentTraining: RecentTrainingEvidence;
};

export type AdaptiveTrainingContext = {
  currentPriorities: AdaptivePriorityContext[]; // current video is always primary
  recurringFocuses: CompactCategorySignal[];
  recentFocuses: CompactCategorySignal[];
  improvingAreas: CompactCategorySignal[];
  consistentStrengths: CompactCategorySignal[];
  hasSufficientHistory: boolean;
};

// Cross-references completion records against each recent session's OWN
// persisted plan/report (a drill's addressesIssueId is only meaningful
// within the report that produced it) to build per-category training
// counts. Drills with no drillId (pre-Phase-6 plans) or no addressesIssueId
// (general drills) are simply not counted — they carry no category signal.
function countTrainingEvidenceByCategory(
  recentSessions: RecentSessionDetail[],
  recentCompletions: DrillCompletionRecord[]
): Map<RubricCategory, RecentTrainingEvidence> {
  const completionBySessionAndDrill = new Map<string, CompletionStatus>();
  for (const c of recentCompletions) {
    completionBySessionAndDrill.set(`${c.analysisSessionId}:${c.drillId}`, c.status);
  }

  const counts = new Map<RubricCategory, RecentTrainingEvidence>();
  function ensure(category: RubricCategory): RecentTrainingEvidence {
    const existing = counts.get(category);
    if (existing) return existing;
    const fresh = { completedCount: 0, skippedCount: 0, untrackedCount: 0, totalRecommended: 0 };
    counts.set(category, fresh);
    return fresh;
  }

  for (const session of recentSessions) {
    if (!session.report.valid || session.trainingPlan === null || !session.trainingPlan.valid) continue;

    const categoryByPriorityId = new Map(
      session.report.data.topPriorities.map((p) => [p.id, p.category])
    );

    for (const day of session.trainingPlan.data.days) {
      for (const drill of day.drills) {
        if (!drill.drillId || drill.addressesIssueId === null) continue;
        const category = categoryByPriorityId.get(drill.addressesIssueId);
        if (!category) continue;

        const evidence = ensure(category);
        evidence.totalRecommended += 1;
        const status = completionBySessionAndDrill.get(`${session.id}:${drill.drillId}`);
        if (status === "completed") evidence.completedCount += 1;
        else if (status === "skipped") evidence.skippedCount += 1;
        else evidence.untrackedCount += 1; // no record = unknown, not "skipped"
      }
    }
  }

  return counts;
}

function compactFromPriorityEvidence(insight: CategoryInsight): CompactCategorySignal {
  return {
    category: insight.category,
    occurrences: insight.metrics.priorityTotalCount,
    recentOccurrences: insight.metrics.priorityRecentCount,
  };
}

function compactFromStrengthEvidence(insight: CategoryInsight): CompactCategorySignal {
  return {
    category: insight.category,
    occurrences: insight.metrics.strengthTotalCount,
    recentOccurrences: insight.metrics.strengthRecentCount,
  };
}

// Pure: every argument is already-fetched data. Callers are responsible for
// excluding the session currently being generated for from `progressSessions`
// and `recentSessions`/`recentCompletions` BEFORE calling this — this
// function has no session-identity concept of its own and cannot detect a
// double-counted current session.
export function buildAdaptiveTrainingContext(
  report: GoalieReport,
  progressSessions: ProgressSession[],
  recentSessions: RecentSessionDetail[],
  recentCompletions: DrillCompletionRecord[]
): AdaptiveTrainingContext {
  const insights = computeCategoryInsights(progressSessions);
  const insightByCategory = new Map(insights.map((i) => [i.category, i]));
  const trainingEvidenceByCategory = countTrainingEvidenceByCategory(recentSessions, recentCompletions);
  const currentCategories = new Set(report.topPriorities.map((p) => p.category));

  const currentPriorities: AdaptivePriorityContext[] = report.topPriorities.map((priority) => {
    const insight = insightByCategory.get(priority.category);
    return {
      category: priority.category,
      priorityId: priority.id,
      title: priority.title,
      isRecurringFocus: insight?.status === "recurring-focus",
      isRecentFocus: insight?.status === "recent-focus",
      isImproving: insight?.status === "improving",
      isConsistentStrength: insight?.status === "consistent-strength",
      recentTraining: trainingEvidenceByCategory.get(priority.category) ?? EMPTY_TRAINING_EVIDENCE,
    };
  });

  // The four buckets below are ADDITIONAL context — categories with a
  // pattern that aren't already represented in currentPriorities. Current
  // video evidence is never duplicated into these.
  const notCurrent = (insight: CategoryInsight) => !currentCategories.has(insight.category);

  return {
    currentPriorities,
    recurringFocuses: getRecurringFocus(insights).filter(notCurrent).map(compactFromPriorityEvidence),
    recentFocuses: getRecentFocus(insights).filter(notCurrent).map(compactFromPriorityEvidence),
    improvingAreas: getImproving(insights).filter(notCurrent).map(compactFromStrengthEvidence),
    consistentStrengths: getConsistentStrengths(insights).filter(notCurrent).map(compactFromStrengthEvidence),
    hasSufficientHistory: progressSessions.length >= MIN_SESSIONS_FOR_TRENDS,
  };
}

// Deterministic UI copy, derived from an already-built context — never
// persisted, never shown for a historical plan (see the technical-debt note
// at the top of this file). Returns [] when there's nothing evidence-based
// to say, rather than fabricating a generic explanation.
export function explainAdaptation(context: AdaptiveTrainingContext): string[] {
  const lines: string[] = [];
  for (const priority of context.currentPriorities) {
    if (priority.isRecurringFocus) {
      lines.push(
        `${priority.title} receives extra emphasis because it's in your current analysis and has been a recurring focus.`
      );
    } else if (priority.isRecentFocus) {
      lines.push(
        `${priority.title} is addressed because it's in your current analysis and has appeared as a priority in your recent analyses.`
      );
    } else if (priority.isImproving) {
      lines.push(
        `${priority.title} is reinforced — it's in your current analysis and you've recently shown strength here too.`
      );
    } else if (priority.isConsistentStrength) {
      lines.push(
        `${priority.title} includes some maintenance work since it's been a consistent strength, alongside its place in your current analysis.`
      );
    }
  }
  return lines;
}
