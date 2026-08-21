// Shared types for the evidence-aware scorecard feedback system.

export type DevelopmentRating = {
  category: string;
  rating: 1 | 2 | 3 | 4 | 5 | "N/A";
  confidence: "low" | "medium" | "high";
  observation: string;
};

export type Scorecard = {
  ratings: DevelopmentRating[];
};
