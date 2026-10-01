import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { listAnalysisSessions, type SessionListItem } from "@/lib/sessions";
import {
  computeCategoryInsights,
  buildProgressSummary,
  getRecurringFocus,
  getRecentFocus,
  getImproving,
  getConsistentStrengths,
  PROGRESS_SESSION_LIMIT,
  MIN_SESSIONS_FOR_TRENDS,
  type CategoryInsight,
  type ProgressSession,
} from "@/lib/progress";
import type { RubricCategory } from "@/lib/schemas";

// Reads the authenticated user's own sessions on every request — never
// statically prerendered/cached. Computed entirely from already-persisted
// GoalieReports: zero calls to OpenAI/Gemini/Claude.
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<CategoryInsight["status"], string> = {
  "recurring-focus": "Recurring focus",
  "recent-focus": "Recent focus",
  improving: "Improving",
  "consistent-strength": "Consistent strength",
  "not-enough-evidence": "Not enough evidence",
};

const CATEGORY_LABELS: Record<RubricCategory, string> = {
  positioning: "Positioning",
  setPosition: "Set Position",
  footwork: "Footwork",
  decisionMaking: "Decision Making",
  diving: "Diving",
  handling: "Handling",
  landing: "Landing",
  recovery: "Recovery",
  distribution: "Distribution",
};

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function InsightCard({ insight }: { insight: CategoryInsight }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="font-semibold">{CATEGORY_LABELS[insight.category]}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-accent">
        {STATUS_LABELS[insight.status]}
      </p>
      <p className="mt-2 text-sm text-muted">{insight.explanation}</p>
      {insight.evidence.length > 0 && (
        <ul className="mt-3 space-y-1">
          {insight.evidence.map((e, i) => (
            <li key={i} className="text-xs">
              <Link href={`/history/${e.sessionId}`} className="text-accent hover:underline">
                {formatDate(e.createdAt)} — {e.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TimelineItem({ item }: { item: SessionListItem }) {
  const topPriorityTitle = item.report.valid ? item.report.data.topPriorities[0]?.title : null;
  const strengthCount = item.report.valid ? item.report.data.strengths.length : null;

  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <Link href={`/history/${item.id}`} className="block">
        <p className="text-sm text-muted">{formatDate(item.createdAt)}</p>
        <p className="mt-1 font-medium">{item.videoFilename}</p>
        {item.report.valid ? (
          <div className="mt-2 space-y-0.5 text-sm">
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
          </div>
        ) : (
          <p className="mt-2 text-sm text-bad">This session&apos;s saved report could not be loaded.</p>
        )}
      </Link>
    </li>
  );
}

export default async function ProgressPage() {
  // proxy.ts already redirects signed-out users; the ownership filter inside
  // listAnalysisSessions is the real guarantee a user only ever sees their
  // own sessions here.
  const { userId } = await auth();
  const result = userId
    ? await listAnalysisSessions({ userId, limit: PROGRESS_SESSION_LIMIT })
    : ({ ok: false, error: "Unauthorized" } as const);

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-sm text-bad">We couldn&apos;t load your progress.</p>
        </div>
      </main>
    );
  }

  const sessions = result.data;

  if (sessions.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Your Progress</h1>
        <div className="mt-8 rounded-xl border border-border bg-surface p-5 text-center">
          <h2 className="font-semibold">No progress data yet</h2>
          <p className="mt-2 text-sm text-muted">
            Your development insights will appear here once you&apos;ve analyzed a video.
          </p>
          <Link
            href="/analyze"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          >
            Analyze Your First Video
          </Link>
        </div>
      </main>
    );
  }

  const validSessions: ProgressSession[] = [];
  for (const s of sessions) {
    if (s.report.valid) validSessions.push({ id: s.id, createdAt: s.createdAt, report: s.report.data });
  }

  const summary = buildProgressSummary(validSessions);
  const insights = computeCategoryInsights(validSessions);
  const recurring = getRecurringFocus(insights);
  const recentFocus = getRecentFocus(insights);
  const improving = getImproving(insights);
  const consistentStrengths = getConsistentStrengths(insights);
  const hasEnoughForTrends = validSessions.length >= MIN_SESSIONS_FOR_TRENDS;
  const developmentOverview = [...recurring, ...recentFocus, ...improving, ...consistentStrengths];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Your Progress</h1>
      <p className="mt-2 text-muted">
        Based on {sessions.length} goalkeeper {sessions.length === 1 ? "analysis" : "analyses"}
        {summary.firstAnalysisAt && summary.latestAnalysisAt && (
          <>
            {" "}
            · First: {formatDate(summary.firstAnalysisAt)} · Latest: {formatDate(summary.latestAnalysisAt)}
          </>
        )}
      </p>

      {!hasEnoughForTrends && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-5">
          <p className="text-sm text-muted">
            {validSessions.length === 1
              ? "Analyze a few more videos before we can start identifying patterns over time."
              : "A couple more analyses will let us start identifying patterns — for now, here's what each one found."}
          </p>
        </div>
      )}

      {hasEnoughForTrends && developmentOverview.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Development Overview
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {developmentOverview.map((insight) => (
              <InsightCard key={insight.category} insight={insight} />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            These are patterns in what AI Goalie has flagged across your analyses — not an overall
            skill ranking or score.
          </p>
        </section>
      )}

      {hasEnoughForTrends && (recurring.length > 0 || recentFocus.length > 0) && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Current Development Priorities
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[...recurring, ...recentFocus].map((insight) => (
              <InsightCard key={insight.category} insight={insight} />
            ))}
          </div>
        </section>
      )}

      {hasEnoughForTrends && improving.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Recent Improvements
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {improving.map((insight) => (
              <InsightCard key={insight.category} insight={insight} />
            ))}
          </div>
        </section>
      )}

      {hasEnoughForTrends && consistentStrengths.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Consistent Strengths
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {consistentStrengths.map((insight) => (
              <InsightCard key={insight.category} insight={insight} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Analysis Timeline
        </h2>
        <ul className="mt-3 space-y-3">
          {sessions.map((item) => (
            <TimelineItem key={item.id} item={item} />
          ))}
        </ul>
      </section>
    </main>
  );
}
