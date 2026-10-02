export default function TrendBar({
  segments,
  tone,
}: {
  // Oldest -> newest, left to right. true = occurred in that session.
  segments: boolean[];
  tone: "focus" | "accent";
}) {
  const fillClass = tone === "accent" ? "bg-accent" : "bg-focus";
  return (
    <div
      className="flex gap-1"
      role="img"
      aria-label={`${segments.filter(Boolean).length} of ${segments.length} recent sessions`}
    >
      {segments.map((filled, i) => (
        <span
          key={i}
          aria-hidden
          className={`h-[26px] flex-1 rounded-[2px] ${filled ? fillClass : "bg-track"}`}
        />
      ))}
    </div>
  );
}
