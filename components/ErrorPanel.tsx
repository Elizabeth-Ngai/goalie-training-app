export default function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-sm text-bad">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
      >
        Try Again
      </button>
    </div>
  );
}
