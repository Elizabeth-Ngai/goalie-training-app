export default function StatTile({
  value,
  label,
  tone = "ink",
}: {
  value: string | number;
  label: string;
  tone?: "ink" | "accent";
}) {
  return (
    <div className="bg-surface p-4">
      <p
        className={`font-display text-5xl leading-none font-extrabold ${
          tone === "accent" ? "text-accent" : "text-ink"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
    </div>
  );
}
