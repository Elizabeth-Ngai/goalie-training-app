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
