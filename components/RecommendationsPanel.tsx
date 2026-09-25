import { Recommendation } from "@/lib/recommendations";

// Renders the coaching recommendations built from the scorecard's top
// priorities: a numbered list of what to work on and why.
export default function RecommendationsPanel({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Recommended for You</h2>

      {recommendations.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Nothing to recommend yet - either everything looks solid, or there
          wasn&apos;t enough confident data from this video to be sure.
        </p>
      ) : (
        <ol className="mt-4 space-y-4">
          {recommendations.map((rec, index) => (
            <li key={rec.category} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
              <p className="font-medium">
                {index + 1}. {rec.category}
              </p>
              <p className="mt-1 text-sm text-muted">{rec.reason}</p>
              <p className="mt-1 text-sm text-foreground">{rec.exercise}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
