import Link from "next/link";
import type { SessionListItem } from "@/lib/sessions";

export function formatRowDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "2-digit" }).toUpperCase();
}

export default function SessionRow({ item }: { item: SessionListItem }) {
  const topPriority = item.report.valid ? item.report.data.topPriorities[0]?.title : null;
  const planLabel = item.hasTrainingPlan
    ? item.trainingDayCount != null
      ? `${item.trainingDayCount}-DAY PLAN`
      : "PLAN READY"
    : "NO PLAN YET";
  const planTone = item.hasTrainingPlan ? "text-accent" : "text-focus";

  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={`/history/${item.id}`}
        className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 px-1 py-4 transition-colors hover:bg-surface-2"
      >
        <span className="w-20 shrink-0 font-display text-xl font-bold text-ink">
          {formatRowDate(item.createdAt)}
        </span>
        <span className="w-16 shrink-0 text-sm text-muted">
          {item.clipCount > 1 ? `${item.clipCount} clips` : "1 clip"}
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-sm font-semibold ${
            item.report.valid ? "text-ink" : "text-danger"
          }`}
        >
          {item.report.valid ? (topPriority ?? "No priorities flagged") : "Report could not be loaded"}
        </span>
        <span className={`shrink-0 text-xs font-bold uppercase tracking-wide ${planTone}`}>
          {planLabel}
        </span>
        <span aria-hidden className="shrink-0 text-muted">
          →
        </span>
      </Link>
    </li>
  );
}
