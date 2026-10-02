import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { listAnalysisSessions, type SessionListItem } from "@/lib/sessions";

// This page reads "newest first" live data on every request — never
// statically prerendered/cached.
export const dynamic = "force-dynamic";

function SessionCard({ item }: { item: SessionListItem }) {
  const topPriorityTitle = item.report.valid ? item.report.data.topPriorities[0]?.title : null;
  const strengthCount = item.report.valid ? item.report.data.strengths.length : null;

  return (
    <li className="rounded-xl border border-border bg-surface p-5">
      <Link href={`/history/${item.id}`} className="block">
        <p className="text-sm text-muted">
          {item.createdAt.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
        <p className="mt-1 font-semibold">
          {item.clipCount > 1 ? `${item.clipCount} clips` : item.videoFilename}
        </p>

        {item.report.valid ? (
          <div className="mt-3 space-y-1 text-sm">
            {topPriorityTitle && (
              <p>
                <span className="text-muted">Top Priority: </span>
                {topPriorityTitle}
              </p>
            )}
            {strengthCount !== null && (
              <p className="text-muted">
                {strengthCount} {strengthCount === 1 ? "Strength" : "Strengths"}
              </p>
            )}
            <p className="text-muted">
              {item.hasTrainingPlan
                ? item.trainingDayCount != null
                  ? `${item.trainingDayCount}-day training plan`
                  : "Training plan generated"
                : "No training plan yet"}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-bad">This session's saved report could not be loaded.</p>
        )}

        <span className="mt-3 inline-block text-sm font-medium text-accent">View Analysis</span>
      </Link>
    </li>
  );
}

export default async function HistoryPage() {
  // proxy.ts already redirects signed-out users to sign-in; this derives the
  // owner id to scope the query. The ownership filter in listAnalysisSessions
  // is the real guarantee a user only ever sees their own sessions.
  const { userId } = await auth();
  const result = userId
    ? await listAnalysisSessions({ userId })
    : ({ ok: false, error: "Unauthorized" } as const);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Analysis History</h1>
      <p className="mt-2 text-muted">Your previously analyzed goalkeeper sessions.</p>

      <div className="mt-8">
        {!result.ok ? (
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-sm text-bad">We couldn&apos;t load your analysis history.</p>
          </div>
        ) : result.data.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-5 text-center">
            <h2 className="font-semibold">No analyses yet</h2>
            <p className="mt-2 text-sm text-muted">
              Your goalkeeper analyses will appear here after you upload your first video.
            </p>
            <Link
              href="/analyze"
              className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
            >
              Analyze a Video
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {result.data.map((item) => (
              <SessionCard key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
