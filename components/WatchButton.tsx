import { parseTimestamp } from "@/lib/time";

// Small interactive control rendered next to any timestamped observation.
// Parsing is centralized in parseTimestamp; if the timestamp is missing or
// malformed it returns null and we render nothing rather than a broken button.
export default function WatchButton({
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
