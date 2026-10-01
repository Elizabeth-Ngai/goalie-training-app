// Deterministic, pure derivations of the weekly summary and focus areas from
// an already-generated TrainingPlan + the report's priorities. None of this
// is ever asked of the LLM — it's all directly computable from structured
// data already on the plan, so keep it centralized here rather than in
// components.
import { ReportPriority, TrainingDay } from "@/lib/schemas";

export function countTrainingDays(days: TrainingDay[]): number {
  return days.filter((day) => !day.isRestDay).length;
}

export function sumTrainingMinutes(days: TrainingDay[]): number {
  return days
    .filter((day) => !day.isRestDay)
    .reduce((sum, day) => sum + day.durationMinutes, 0);
}

export function countTotalDrills(days: TrainingDay[]): number {
  return days.reduce((sum, day) => sum + day.drills.length, 0);
}

// First non-rest day, or 0 if the whole plan is rest days.
export function firstSelectableDayIndex(days: TrainingDay[]): number {
  const index = days.findIndex((day) => !day.isRestDay);
  return index === -1 ? 0 : index;
}

export type FocusArea = { id: string; title: string; drillCount: number };

// Ranks priorities by how many drills in the plan target them. Ties are
// broken by each priority's position in topPriorities (the analysis's own
// ranking), not by map/array iteration order, so the result is stable
// regardless of drill ordering within the plan.
export function computeFocusAreas(
  days: TrainingDay[],
  priorities: ReportPriority[]
): { primary: FocusArea | null; secondary: FocusArea | null } {
  const drillCounts = new Map<string, number>();
  for (const day of days) {
    for (const drill of day.drills) {
      if (drill.addressesIssueId === null) continue;
      drillCounts.set(drill.addressesIssueId, (drillCounts.get(drill.addressesIssueId) ?? 0) + 1);
    }
  }

  const priorityIndex = new Map(priorities.map((priority, index) => [priority.id, index]));

  const ranked = [...drillCounts.entries()]
    .map(([id, drillCount]): FocusArea & { order: number } | null => {
      const priority = priorities.find((p) => p.id === id);
      const order = priorityIndex.get(id);
      if (!priority || order === undefined) return null;
      return { id, title: priority.title, drillCount, order };
    })
    .filter((area): area is FocusArea & { order: number } => area !== null)
    .sort((a, b) => b.drillCount - a.drillCount || a.order - b.order);

  return { primary: ranked[0] ?? null, secondary: ranked[1] ?? null };
}
