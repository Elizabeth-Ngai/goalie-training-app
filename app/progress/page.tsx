import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { listAnalysisSessions } from "@/lib/sessions";
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
import { buildCategoryTrend, getCategoryTag, CATEGORY_LABELS } from "@/lib/categoryDisplay";
import Panel from "@/components/ui/Panel";
import Eyebrow from "@/components/ui/Eyebrow";
import TrendBar from "@/components/ui/TrendBar";
import { ButtonLink } from "@/components/ui/Button";
import SessionRow, { formatRowDate } from "@/components/SessionRow";

// Reads the authenticated user's own sessions on every request — never
// statically prerendered/cached. Computed entirely from already-persisted
// GoalieReports: zero calls to OpenAI/Gemini/Claude.
export const dynamic = "force-dynamic";

function InsightCard({ insight, sessions }: { insight: CategoryInsight; sessions: ProgressSession[] }) {
  const tag = getCategoryTag(insight.status);
  const trend = buildCategoryTrend(insight, sessions);
  const tagToneClass =
    tag.tone === "accent" ? "text-accent" : tag.tone === "focus" ? "text-focus" : "text-muted";

  return (
    <Panel className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold text-ink">{CATEGORY_LABELS[insight.category]}</p>
        <p className={`text-xs font-bold uppercase tracking-wide ${tagToneClass}`}>{tag.label}</p>
      </div>
      <div className="mt-3">
        <TrendBar segments={trend.segments} tone={trend.tone} />
      </div>
      <p className="mt-2 text-xs text-muted">
        {trend.captionLabel} {trend.windowCount} of {trend.windowSize}
      </p>
      <p className="mt-2 text-sm text-ink-soft">{insight.explanation}</p>
      {insight.evidence.length > 0 && (
        <ul className="mt-3 space-y-1">
          {insight.evidence.map((e, i) => (
            <li key={i}>
              <Link
                href={`/history/${e.sessionId}`}
                className="flex items-baseline gap-2 py-0.5 text-xs transition-colors hover:text-accent"
              >
                <span className="font-display font-semibold text-muted">
                  {formatRowDate(e.createdAt)}
                </span>
                <span className="truncate text-ink-soft">{e.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
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
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-14">
        <Panel className="p-5">
          <p className="text-sm text-danger">We couldn&apos;t load your progress.</p>
        </Panel>
      </main>
    );
  }

  const sessions = result.data;

  if (sessions.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-14">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink uppercase">
          Progress
        </h1>
        <Panel className="mt-8 p-5 text-center">
          <h2 className="font-semibold text-ink">No progress data yet</h2>
          <p className="mt-2 text-sm text-muted">
            Your development insights will appear here once you&apos;ve reviewed a session.
          </p>
          <ButtonLink href="/analyze" variant="primary" className="mt-4">
            Analyze your first video
          </ButtonLink>
        </Panel>
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
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-14">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink uppercase">
        Progress
      </h1>
      <p className="mt-2 text-muted">
        Based on {sessions.length} goalkeeper {sessions.length === 1 ? "session" : "sessions"}
        {summary.firstAnalysisAt && summary.latestAnalysisAt && (
          <>
            {" "}
            · First: {formatRowDate(summary.firstAnalysisAt)} · Latest:{" "}
            {formatRowDate(summary.latestAnalysisAt)}
          </>
        )}
      </p>

      {!hasEnoughForTrends && (
        <Panel className="mt-6 p-5">
          <p className="text-sm text-muted">
            {validSessions.length === 1
              ? "Review a few more sessions before we can start identifying patterns over time."
              : "A couple more sessions will let us start identifying patterns — for now, here's what each one found."}
          </p>
        </Panel>
      )}

      {hasEnoughForTrends && developmentOverview.length > 0 && (
        <section className="mt-8">
          <Eyebrow>Development overview</Eyebrow>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {developmentOverview.map((insight) => (
              <InsightCard key={insight.category} insight={insight} sessions={validSessions} />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            These are patterns in what we&apos;ve flagged across your sessions — not an overall skill
            ranking or score.
          </p>
        </section>
      )}

      {hasEnoughForTrends && (recurring.length > 0 || recentFocus.length > 0) && (
        <section className="mt-8">
          <Eyebrow>Current development priorities</Eyebrow>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[...recurring, ...recentFocus].map((insight) => (
              <InsightCard key={insight.category} insight={insight} sessions={validSessions} />
            ))}
          </div>
        </section>
      )}

      {hasEnoughForTrends && improving.length > 0 && (
        <section className="mt-8">
          <Eyebrow>Recent improvements</Eyebrow>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {improving.map((insight) => (
              <InsightCard key={insight.category} insight={insight} sessions={validSessions} />
            ))}
          </div>
        </section>
      )}

      {hasEnoughForTrends && consistentStrengths.length > 0 && (
        <section className="mt-8">
          <Eyebrow>Consistent strengths</Eyebrow>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {consistentStrengths.map((insight) => (
              <InsightCard key={insight.category} insight={insight} sessions={validSessions} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <Eyebrow>Session timeline</Eyebrow>
        <ul className="mt-3 border-t border-line">
          {sessions.map((item) => (
            <SessionRow key={item.id} item={item} />
          ))}
        </ul>
      </section>
    </main>
  );
}
