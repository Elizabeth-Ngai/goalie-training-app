import { DevelopmentRating } from "./types";

export type Recommendation = {
  category: string;
  exercise: string;
  reason: string;
};

// A short drill for players who are just starting to build the skill
// (foundational), and a different one for players who are close but need
// fine-tuning (refinement).
const recommendationLibrary: Record<
  string,
  { foundational: string; refinement: string }
> = {
  "Stance Width": {
    foundational:
      "Practice standing with your feet wider than your shoulders in front of a mirror until it feels natural.",
    refinement:
      "Do a few reps of side shuffles, checking that your feet stay wide every time you reset.",
  },
  "Knee Bend": {
    foundational:
      "Practice holding a deep athletic squat position for 20-30 seconds at a time to build the habit of bending.",
    refinement:
      "Add light knee bends between shuffles so your knees stay bent even while you're moving.",
  },
  "Hand Position": {
    foundational:
      "Practice holding your hands up at chest height in front of you while standing in your ready stance.",
    refinement:
      "Do reaction-save reps, focusing on keeping your hands up between each save instead of letting them drop.",
  },
  Balance: {
    foundational:
      "Practice standing in your ready stance with weight centered evenly over both feet, using a mirror to check.",
    refinement:
      "Do balance-hold reps on one foot, then reset into a centered ready stance.",
  },
};

// Picks the right drill for how far along the player is in this category:
// foundational for a rough rating (1-2), refinement for a closer one (3+).
function pickExercise(category: string, rating: number): string {
  const entry = recommendationLibrary[category];
  if (!entry) return "General ready stance practice.";

  return rating <= 2 ? entry.foundational : entry.refinement;
}

export function buildRecommendations(
  priorities: DevelopmentRating[]
): Recommendation[] {
  return priorities.map((priority) => {
    // The rating is guaranteed to be a number here, since getTopPriorities
    // already filters out "N/A" ratings.
    const numericRating = priority.rating as number;

    let reason = priority.observation;
    if (priority.confidence === "medium") {
      reason +=
        " (we're moderately confident in this reading, the camera angle may have made it harder to tell.)";
    }

    return {
      category: priority.category,
      exercise: pickExercise(priority.category, numericRating),
      reason,
    };
  });
}
