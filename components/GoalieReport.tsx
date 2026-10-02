import { GoalieReport as GoalieReportData } from "@/lib/schemas";
import EvidenceWatch from "@/components/EvidenceWatch";
import Panel from "@/components/ui/Panel";
import Eyebrow from "@/components/ui/Eyebrow";
import PriorityCard from "@/components/ui/PriorityCard";

export default function GoalieReport({
  report,
  onSeek,
  clipLabels,
}: {
  report: GoalieReportData;
  onSeek: (seconds: number, clipId?: string) => void;
  // clipId -> "Clip N — filename" for multi-clip sessions. Omitted for
  // legacy/single-video reports, where evidence has no references and
  // EvidenceWatch falls back to a single clip-less Watch button.
  clipLabels?: Record<string, string>;
}) {
  return (
    <div className="space-y-6">
      <Panel className="p-5">
        <Eyebrow>Coach&apos;s read</Eyebrow>
        {report.sourceCount < 3 && (
          <p className="mt-2 text-sm text-focus">Analysis completed with limited evidence.</p>
        )}
        <p className="mt-3 text-sm text-ink-soft">{report.summary}</p>

        <ol className="mt-6 space-y-6">
          {report.topPriorities.map((priority, index) => (
            <li key={priority.id}>
              <PriorityCard priority={priority} index={index} onSeek={onSeek} clipLabels={clipLabels} />
            </li>
          ))}
        </ol>

        {report.strengths.length > 0 && (
          <div className="mt-6 border-t border-line pt-5">
            <Eyebrow tone="accent">What you did well</Eyebrow>
            <ul className="mt-3 flex flex-wrap gap-2">
              {report.strengths.map((strength, index) => (
                <li key={index}>
                  <span className="inline-flex items-center rounded-btn border border-accent px-3 py-1.5 text-xs font-bold tracking-wide text-accent uppercase">
                    {strength.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {report.keyMoments.length > 0 && (
        <Panel className="p-5">
          <Eyebrow>Key moments</Eyebrow>
          <ul className="mt-4 space-y-4">
            {report.keyMoments.map((moment, index) => (
              <li key={index} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {moment.label && <span className="text-sm font-semibold text-ink">{moment.label}</span>}
                </div>
                <p className="mt-1 text-sm text-ink-soft">{moment.description}</p>
                <div className="mt-2">
                  <EvidenceWatch
                    timestamp={moment.timestamp}
                    evidenceReferences={moment.evidenceReferences}
                    clipLabels={clipLabels}
                    onSeek={onSeek}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {report.recommendedDrills.length > 0 && (
        <Panel className="p-5">
          <Eyebrow>Recommended drills</Eyebrow>
          <ul className="mt-3 space-y-2 text-sm">
            {report.recommendedDrills.map((drill, index) => (
              <li key={index}>
                <span className="font-semibold text-ink">{drill.name}</span>
                <span className="text-muted"> — {drill.purpose}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
