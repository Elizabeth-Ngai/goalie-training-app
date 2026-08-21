export type ClassificationStatus = "idle" | "loading" | "done" | "error";

export type ClassificationPrediction = {
  category: string;
  confidence: number;
};

type VideoClassificationCardProps = {
  status: ClassificationStatus;
  prediction: ClassificationPrediction | null;
  selectedCategory: string | null;
  onSelectCategory: (category: string) => void;
};

const CATEGORY_LABELS: Record<string, string> = {
  match: "Match",
  goalkeeper_training: "Goalkeeper Training",
  fitness_training: "Fitness Training",
  unknown: "Unknown",
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS);

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

export default function VideoClassificationCard({
  status,
  prediction,
  selectedCategory,
  onSelectCategory,
}: VideoClassificationCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Video Type</h2>

      {status === "idle" && (
        <p className="mt-3 text-sm text-muted">Upload a video to classify it.</p>
      )}

      {status === "loading" && (
        <p className="mt-3 text-sm text-muted">Classifying video...</p>
      )}

      {status === "error" && (
        <p className="mt-3 text-sm text-bad">
          Couldn&apos;t classify this video. You can still pick a category below.
        </p>
      )}

      {status === "done" && prediction && (
        <p className="mt-3 text-sm">
          Predicted: <span className="font-medium">{categoryLabel(prediction.category)}</span>{" "}
          <span className="text-muted">({prediction.confidence}% confident)</span>
        </p>
      )}

      {selectedCategory && (
        <p className="mt-2 text-sm">
          Selected:{" "}
          <span className="font-medium text-accent">
            {categoryLabel(selectedCategory)}
          </span>
        </p>
      )}

      {(status === "done" || status === "error") && (
        <div className="mt-4 flex flex-wrap gap-2">
          {prediction && (
            <button
              onClick={() => onSelectCategory(prediction.category)}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
            >
              Correct
            </button>
          )}

          {ALL_CATEGORIES.filter((category) => category !== prediction?.category).map(
            (category) => (
              <button
                key={category}
                onClick={() => onSelectCategory(category)}
                className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm hover:border-accent"
              >
                {categoryLabel(category)}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
