export default function AnalysisLoading({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
