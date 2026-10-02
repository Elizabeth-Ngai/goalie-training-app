import { parseTimestamp } from "@/lib/time";

// The "TimestampButton" primitive: a full-width row, clip label on the left,
// timestamp (Saira Condensed, accent) + play marker on the right.
//
// Parsing is centralized in parseTimestamp; if the timestamp is missing or
// malformed it returns null and we render nothing rather than a broken row.
//
// Optional clipId/label. When omitted (legacy single-video reports and
// single-clip sessions whose evidence has no references), onSeek is called
// with undefined clipId and the player falls back to the one video.
export default function WatchButton({
  timestamp,
  clipId,
  clipLabel,
  onSeek,
}: {
  timestamp: string;
  clipId?: string;
  clipLabel?: string;
  onSeek: (seconds: number, clipId?: string) => void;
}) {
  const seconds = parseTimestamp(timestamp);
  if (seconds === null) return null;

  const clipShort = clipLabel ? clipLabel.split("—")[0].trim() : "Watch";

  return (
    <button
      type="button"
      onClick={() => onSeek(seconds, clipId)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-btn border border-line bg-surface-2 px-3 transition-colors hover:border-accent"
    >
      <span className="text-sm font-semibold text-ink-soft">{clipShort}</span>
      <span className="flex items-center gap-2 font-display text-sm font-bold text-accent">
        {timestamp}
        <span aria-hidden>▶</span>
      </span>
    </button>
  );
}
