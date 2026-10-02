export default function AnalysisLoading({ label }: { label: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <p className="text-sm font-medium text-ink-soft">{label}</p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-track">
        <div className="h-full w-2/3 rounded-full bg-accent motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
