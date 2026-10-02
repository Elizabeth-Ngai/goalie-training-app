import { Button } from "@/components/ui/Button";

export default function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <p className="text-sm text-danger">{message}</p>
      <Button type="button" onClick={onRetry} className="mt-4">
        Try Again
      </Button>
    </div>
  );
}
