import { GoalieReport as GoalieReportData, RubricCategory } from "@/lib/schemas";

const CATEGORY_LABELS: Record<RubricCategory, string> = {
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

export default function GoalieReport({ report }: { report: GoalieReportData }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">AI Goalie Analysis</h2>

        {report.sourceCount < 3 && (
          <p className="mt-2 text-sm text-warn">
            Partial analysis — based on limited evidence. Some observations may
            have lower confidence than usual.
          </p>
        )}

        <p className="mt-3 text-sm text-foreground">{report.summary}</p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Top Priorities</h2>
        <ol className="mt-4 space-y-5">
          {report.topPriorities.map((priority, index) => (
            <li
              key={index}
              className="border-t border-border pt-4 first:border-t-0 first:pt-0"
            >
              <p className="font-medium">
                {index + 1}. {CATEGORY_LABELS[priority.category]}{" "}
                <span className="font-mono text-xs text-muted">
                  {priority.timestamp}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted">{priority.observation}</p>
              <p className="mt-2 text-sm">
                <span className="font-medium">Why it matters: </span>
                {priority.whyItMatters}
              </p>
              <p className="mt-1 text-sm">
                <span className="font-medium">How to improve: </span>
                {priority.howToImprove}
              </p>
              <p className="mt-2 text-sm text-accent">
                Drill: {priority.recommendedDrill.name} —{" "}
                <span className="text-muted">{priority.recommendedDrill.purpose}</span>
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold text-good">Strengths</h2>
        <ul className="mt-3 space-y-3">
          {report.strengths.map((strength, index) => (
            <li key={index} className="text-sm">
              <span className="font-medium">{CATEGORY_LABELS[strength.category]}</span>{" "}
              <span className="font-mono text-xs text-muted">{strength.timestamp}</span>
              <p className="text-muted">{strength.observation}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold text-warn">Areas for Improvement</h2>
        <ul className="mt-3 space-y-3">
          {report.technicalIssues.map((issue, index) => (
            <li key={index} className="text-sm">
              <span className="font-medium">{CATEGORY_LABELS[issue.category]}</span>{" "}
              <span className="font-mono text-xs text-muted">{issue.timestamp}</span>
              <p className="text-muted">{issue.observation}</p>
              <p className="mt-1 text-foreground">{issue.recommendation}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Key Moments</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {report.keyMoments.map((moment, index) => (
            <li key={index}>
              <span className="font-mono text-xs text-muted">{moment.timestamp}</span>{" "}
              — {moment.description}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Recommended Drills</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {report.recommendedDrills.map((drill, index) => (
            <li key={index}>
              <span className="font-medium">{drill.name}</span>{" "}
              <span className="text-muted">— {drill.purpose}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
