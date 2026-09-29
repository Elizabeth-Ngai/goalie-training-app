import { GoalieReport as GoalieReportData } from "@/lib/schemas";
import { parseTimestamp } from "@/lib/time";

// Small interactive control rendered next to any timestamped observation.
// Parsing is centralized in parseTimestamp; if the timestamp is missing or
// malformed it returns null and we render nothing rather than a broken button.
function WatchButton({
  timestamp,
  onSeek,
}: {
  timestamp: string;
  onSeek: (seconds: number) => void;
}) {
  const seconds = parseTimestamp(timestamp);
  if (seconds === null) return null;

  return (
    <button
      type="button"
      onClick={() => onSeek(seconds)}
      className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:border-accent"
    >
      <span aria-hidden>▶</span> Watch {timestamp}
    </button>
  );
}

function BulletList({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <ul className={`space-y-1 ${className ?? ""}`}>
      {items.map((item, index) => (
        <li key={index} className="flex gap-2 text-sm">
          <span className="text-muted" aria-hidden>
            •
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function GoalieReport({
  report,
  onSeek,
}: {
  report: GoalieReportData;
  onSeek: (seconds: number) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Overall assessment */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Overall Assessment</h2>
        {report.sourceCount < 3 && (
          <p className="mt-2 text-sm text-warn">
            Analysis completed with limited evidence.
          </p>
        )}
        <p className="mt-3 text-sm text-foreground">{report.summary}</p>
      </section>

      {/* Top things to work on */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Top Things to Work On</h2>
        <ol className="mt-4 space-y-6">
          {report.topPriorities.map((priority, index) => (
            <li
              key={priority.id}
              className="border-t border-border pt-5 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h3 className="text-base font-semibold">
                  {index + 1}. {priority.title}
                </h3>
                <WatchButton timestamp={priority.timestamp} onSeek={onSeek} />
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    What I See
                  </p>
                  <BulletList items={priority.observations} className="mt-1" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Why It Matters
                  </p>
                  <BulletList items={priority.whyItMatters} className="mt-1" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    How to Improve
                  </p>
                  <BulletList items={priority.howToImprove} className="mt-1" />
                </div>
              </div>

              <p className="mt-3 text-sm">
                <span className="font-medium text-accent">Drill: </span>
                <span className="font-medium">{priority.recommendedDrill.name}</span>
                <span className="text-muted"> — {priority.recommendedDrill.purpose}</span>
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* What you did well */}
      {report.strengths.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold text-good">What You Did Well</h2>
          <ul className="mt-4 space-y-4">
            {report.strengths.map((strength, index) => (
              <li key={index}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="font-medium">
                    <span className="text-good" aria-hidden>
                      ✓{" "}
                    </span>
                    {strength.title}
                  </p>
                  <WatchButton timestamp={strength.timestamp} onSeek={onSeek} />
                </div>
                <BulletList items={strength.points} className="mt-1" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Key moments */}
      {report.keyMoments.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Key Moments</h2>
          <ul className="mt-4 space-y-4">
            {report.keyMoments.map((moment, index) => (
              <li
                key={index}
                className="border-t border-border pt-4 first:border-t-0 first:pt-0"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <WatchButton timestamp={moment.timestamp} onSeek={onSeek} />
                  {moment.label && (
                    <span className="text-sm font-medium">{moment.label}</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">{moment.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recommended drills */}
      {report.recommendedDrills.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Recommended Drills</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {report.recommendedDrills.map((drill, index) => (
              <li key={index}>
                <span className="font-medium">{drill.name}</span>
                <span className="text-muted"> — {drill.purpose}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
