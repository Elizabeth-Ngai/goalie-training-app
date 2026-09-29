// Formats a seconds offset as "MM:SS.s" (one decimal place on seconds) so
// AI Goalie can reference specific moments like "00:04.2" consistently
// across frame labels, prompts, and the results UI.
export function formatTimestamp(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const remainingSeconds = clamped - minutes * 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = remainingSeconds.toFixed(1).padStart(4, "0");

  return `${mm}:${ss}`;
}

// The single, centralized parser for the "MM:SS.s" timestamp strings the
// analysis returns — used for seeking the video. Tolerates a few shapes
// ("MM:SS.s", "M:SS", plain "SS.s"/"SS") and returns null for anything
// missing or malformed so a bad timestamp renders no control rather than
// crashing the report. Keep all timestamp parsing here, not in components.
export function parseTimestamp(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed === "") return null;

  const parts = trimmed.split(":");
  if (parts.length > 2) return null;

  let minutes = 0;
  let secondsPart: string;

  if (parts.length === 2) {
    minutes = Number(parts[0]);
    secondsPart = parts[1];
  } else {
    secondsPart = parts[0];
  }

  const seconds = Number(secondsPart);

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  if (minutes < 0 || seconds < 0) return null;

  const total = minutes * 60 + seconds;
  return Number.isFinite(total) ? total : null;
}
