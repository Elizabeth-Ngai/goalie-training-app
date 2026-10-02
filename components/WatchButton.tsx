import { parseTimestamp } from "@/lib/time";

// Small interactive control rendered next to any timestamped observation.
// Parsing is centralized in parseTimestamp; if the timestamp is missing or
// malformed it returns null and we render nothing rather than a broken button.
//
// Phase 7: optional clipId/label. When omitted (legacy single-video reports
// and single-clip sessions whose evidence has no references), onSeek is
// called with undefined clipId and the player falls back to the one video —
// exactly the pre-Phase-7 behavior. With a clipId, the label is shown so the
// user knows which clip ("Watch Clip 2 · 00:11") and seeks that clip.
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

  return (
    <button
      type="button"
      onClick={() => onSeek(seconds, clipId)}
      className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:border-accent"
    >
      <span aria-hidden>▶</span> Watch {clipLabel ? `${clipLabel} · ${timestamp}` : timestamp}
    </button>
  );
}
