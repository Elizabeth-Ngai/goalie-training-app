import { Scorecard as ScorecardData } from "@/lib/types";

// Renders a Scorecard as a simple table: one row per DevelopmentRating.
export default function Scorecard({ scorecard }: { scorecard: ScorecardData }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Ready Stance Scorecard</h2>

      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr className="text-muted">
            <th className="pb-2 pr-4 font-medium">Category</th>
            <th className="pb-2 pr-4 font-medium">Rating</th>
            <th className="pb-2 pr-4 font-medium">Confidence</th>
            <th className="pb-2 font-medium">Observation</th>
          </tr>
        </thead>
        <tbody>
          {scorecard.ratings.map((r) => (
            <tr key={r.category} className="border-t border-border">
              <td className="py-2 pr-4 font-medium">{r.category}</td>
              <td className="py-2 pr-4">
                {r.rating === "N/A" ? "N/A" : `${r.rating}/5`}
              </td>
              <td className="py-2 pr-4 capitalize text-muted">{r.confidence}</td>
              <td className="py-2 text-muted">{r.observation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
