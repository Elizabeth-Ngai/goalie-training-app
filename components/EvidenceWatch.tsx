import WatchButton from "@/components/WatchButton";
import type { EvidenceReference } from "@/lib/schemas";

// Renders the Watch control(s) for one report finding (priority / strength /
// key moment). Phase 7:
//   - evidenceReferences present (multi-clip session report) -> one clip-
//     labeled chip per reference, each seeking its own clip + timestamp, so a
//     pattern spanning several clips is all independently inspectable.
//   - no references (legacy single-video report, or a single-clip session
//     whose findings weren't stamped) -> a single legacy WatchButton on the
//     scalar timestamp, clipId undefined -> the one video. Unchanged behavior.
//
// `clipLabels` maps clipId -> a human label ("Clip 2 — cross.mp4"); UUIDs are
// never shown. A reference whose clipId isn't in the map still renders with a
// generic "Clip" label rather than leaking the id.
export default function EvidenceWatch({
  timestamp,
  evidenceReferences,
  clipLabels,
  onSeek,
}: {
  timestamp: string;
  evidenceReferences?: EvidenceReference[];
  clipLabels?: Record<string, string>;
  onSeek: (seconds: number, clipId?: string) => void;
}) {
  if (evidenceReferences && evidenceReferences.length > 0) {
    return (
      <div className="flex flex-col gap-2">
        {evidenceReferences.map((ref, index) => (
          <WatchButton
            key={`${ref.clipId}-${ref.timestamp}-${index}`}
            timestamp={ref.timestamp}
            clipId={ref.clipId}
            clipLabel={clipLabels?.[ref.clipId] ?? "Clip"}
            onSeek={onSeek}
          />
        ))}
      </div>
    );
  }

  // Legacy / unstamped: one button, no clip context.
  return <WatchButton timestamp={timestamp} onSeek={onSeek} />;
}
