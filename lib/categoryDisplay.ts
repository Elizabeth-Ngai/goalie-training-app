// Pure presentation-layer mapping from lib/progress.ts's CategoryInsight onto
// the Matchday UI's 3-state tag (FOCUS/WATCH/STRENGTH) + 6-segment trend bar.
// No DB access, no new analysis logic — purely reshapes already-computed
// insight data for display. Mirrors lib/trainingPlanStats.ts's style.
import { CategoryInsight, ProgressSession, RECURRING_WINDOW, STRENGTH_WINDOW } from "@/lib/progress";
import type { RubricCategory } from "@/lib/schemas";

export const CATEGORY_LABELS: Record<RubricCategory, string> = {
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

export type CategoryTag = { label: "FOCUS" | "WATCH" | "STRENGTH"; tone: "focus" | "muted" | "accent" };

export function getCategoryTag(status: CategoryInsight["status"]): CategoryTag {
  if (status === "recurring-focus" || status === "recent-focus") return { label: "FOCUS", tone: "focus" };
  if (status === "consistent-strength") return { label: "STRENGTH", tone: "accent" };
  return { label: "WATCH", tone: "muted" };
}

export type CategoryTrend = {
  segments: boolean[]; // always length 6, oldest -> newest
  tone: "focus" | "accent";
  windowCount: number;
  windowSize: number;
  captionLabel: "Flagged" | "Praised";
};

function sortChronological(sessions: ProgressSession[]): ProgressSession[] {
  return [...sessions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

// sortedSessions must already be chronological (oldest -> newest).
export function buildCategoryTrend(insight: CategoryInsight, sessions: ProgressSession[]): CategoryTrend {
  const sortedSessions = sortChronological(sessions);
  const isStrength = getCategoryTag(insight.status).label === "STRENGTH";
  const kind: "priority" | "strength" = isStrength ? "strength" : "priority";

  const hitSessionIds = new Set(
    insight.metrics.evidence.filter((e) => e.kind === kind).map((e) => e.sessionId)
  );

  const barWindow = sortedSessions.slice(-6);
  const filled = barWindow.map((s) => hitSessionIds.has(s.id));
  const segments = [...Array(6 - filled.length).fill(false), ...filled];

  const captionWindowSize = Math.min(isStrength ? STRENGTH_WINDOW : RECURRING_WINDOW, sortedSessions.length);
  const captionSessions = sortedSessions.slice(-captionWindowSize);
  const windowCount = captionSessions.filter((s) => hitSessionIds.has(s.id)).length;

  return {
    segments,
    tone: isStrength ? "accent" : "focus",
    windowCount,
    windowSize: captionSessions.length,
    captionLabel: isStrength ? "Praised" : "Flagged",
  };
}
