import { DevelopmentRating } from "./types";

// How much each category matters when deciding what to work on first.
// These numbers are a coaching judgment call, not a measured fact - feel
// free to adjust them if a different category should be prioritized higher
// or lower. Any category not listed here defaults to 1.0 (normal weight).
const categoryImportance: Record<string, number> = {
  "Hand Position": 1.3,
  "Knee Bend": 1.2,
  Balance: 1.0,
  "Stance Width": 0.9,
};

function getImportance(category: string): number {
  return categoryImportance[category] ?? 1.0;
}

// Picks the ratings most worth coaching on: skips anything we couldn't
// confidently measure, then ranks the rest by an importance-weighted score
// so a bad rating in an important category (like Hand Position) is
// prioritized over an equally bad rating in a less important one.
export function getTopPriorities(
  ratings: DevelopmentRating[],
  count = 3
): DevelopmentRating[] {
  const usableRatings = ratings.filter(
    (r) => r.rating !== "N/A" && r.confidence !== "low"
  );

  const sorted = [...usableRatings].sort((a, b) => {
    // The filter above guarantees rating is a number here, not "N/A".
    const scoreA = (a.rating as number) / getImportance(a.category);
    const scoreB = (b.rating as number) / getImportance(b.category);
    return scoreA - scoreB;
  });

  return sorted.slice(0, count);
}
