import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { listAnalysisSessions } from "@/lib/sessions";
import {
  computeCategoryInsights,
  getConsistentStrengths,
  PROGRESS_SESSION_LIMIT,
  RECURRING_WINDOW,
  type ProgressSession,
} from "@/lib/progress";
import { buildCategoryTrend, getCategoryTag, CATEGORY_LABELS } from "@/lib/categoryDisplay";
import { RUBRIC_CATEGORIES } from "@/lib/schemas";
import Panel from "@/components/ui/Panel";
import Eyebrow from "@/components/ui/Eyebrow";
import TrendBar from "@/components/ui/TrendBar";
import StatTile from "@/components/ui/StatTile";
import { ButtonLink } from "@/components/ui/Button";
import SessionRow from "@/components/SessionRow";

export const dynamic = "force-dynamic";

const steps = [
  {
    title: "Upload your footage",
    body: "Record a training clip or drill and upload it in seconds.",
  },
  {
    title: "We review it from every angle",
    body: "Several independent reviews of your goalkeeper footage are combined into one coaching report.",
  },
  {
    title: "Get a plan you can act on",
    body: "Clear coaching priorities tied to moments in your video, plus a personalized weekly training plan.",
  },
];

const features = [
  {
    title: "Multi-clip session analysis",
    body: "Upload up to five clips from a session and get back one combined coaching report.",
  },
  {
    title: "Personalized training plans",
    body: "A weekly plan generated from the exact moments flagged in your footage.",
  },
  {
    title: "Progress tracking",
    body: "See how you're developing over time, with training that adapts to your history.",
  },
];

function MarketingHome() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink uppercase sm:text-5xl">
        Train like a smarter goalkeeper
      </h1>

      <p className="mt-4 text-lg text-ink-soft">
        Upload a goalkeeper clip and get coaching notes on positioning, footwork, diving, handling,
        and recovery — plus a personalized weekly training plan.
      </p>

      <ButtonLink href="/sign-up" variant="primary" className="mt-8 px-6 py-3 text-base">
        Get Started
      </ButtonLink>

      <ol id="how-it-works" className="mt-16 grid scroll-mt-20 gap-6 text-left sm:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="rounded-card border border-line bg-surface p-5">
            <span className="font-display text-sm font-bold text-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h2 className="mt-2 font-semibold text-ink">{step.title}</h2>
            <p className="mt-1 text-sm text-muted">{step.body}</p>
          </li>
        ))}
      </ol>

      <div id="features" className="mt-16 scroll-mt-20 text-left">
        <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-ink uppercase">
          Features
        </h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-3">
          {features.map((feature) => (
            <li key={feature.title} className="rounded-card border border-line bg-surface p-5">
              <h3 className="font-semibold text-ink">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted">{feature.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

function EmptyDashboard() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-14">
      <Panel className="relative overflow-hidden p-8 text-center sm:p-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 h-[300px] w-[300px] rounded-full border border-line" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
        </div>
        <div className="relative">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink uppercase sm:text-4xl">
            Upload your first clip
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft">
            Side or 3/4 angle, close enough to see your feet and hands. We&apos;ll turn it into a
            full session review and a training plan.
          </p>
          <ButtonLink href="/analyze" variant="primary" className="mt-6 px-6 py-3 text-base">
            Upload your first clip
          </ButtonLink>
        </div>
      </Panel>
    </main>
  );
}

export default async function Home() {
  const { userId } = await auth();
  if (!userId) return <MarketingHome />;

  const result = await listAnalysisSessions({ userId, limit: PROGRESS_SESSION_LIMIT });

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-14">
        <Panel className="p-5">
          <p className="text-sm text-danger">We couldn&apos;t load your dashboard.</p>
        </Panel>
      </main>
    );
  }

  const sessions = result.data;
  if (sessions.length === 0) return <EmptyDashboard />;

  const validSessions: ProgressSession[] = [];
  for (const s of sessions) {
    if (s.report.valid) validSessions.push({ id: s.id, createdAt: s.createdAt, report: s.report.data });
  }
  const insights = computeCategoryInsights(validSessions);
  const totalSessions = validSessions.length;

  const latestWithPriority = sessions.find(
    (s) => s.report.valid && s.report.data.topPriorities.length > 0
  );
  const topPriority =
    latestWithPriority && latestWithPriority.report.valid
      ? latestWithPriority.report.data.topPriorities[0]
      : null;
  const topPriorityInsight = topPriority
    ? insights.find((i) => i.category === topPriority.category)
    : null;
  const flaggedWindowSize = Math.min(RECURRING_WINDOW, totalSessions);
  const flaggedCount = topPriorityInsight?.metrics.priorityRecentCount ?? 0;

  const latestSessionWithPlan = sessions.find((s) => s.hasTrainingPlan);

  const strongestSkill = getConsistentStrengths(insights)[0] ?? null;
  const strongestTrend = strongestSkill ? buildCategoryTrend(strongestSkill, validSessions) : null;

  const clipsAnalyzed = sessions.reduce((sum, s) => sum + Math.max(s.clipCount, 1), 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-14">
      <Panel className="relative grid gap-8 overflow-hidden p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr]">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 h-[300px] w-[300px] rounded-full border border-line" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
        </div>

        <div className="relative">
          <Eyebrow tone="accent">Priority this week</Eyebrow>
          {topPriority ? (
            <>
              <h1 className="mt-2 font-display text-5xl leading-[1.05] font-extrabold tracking-tight text-ink uppercase sm:text-6xl lg:text-[72px]">
                {topPriority.title}
              </h1>
              {topPriority.whyItMatters[0] && (
                <p className="mt-4 max-w-lg text-sm text-ink-soft">{topPriority.whyItMatters[0]}</p>
              )}
              {totalSessions > 1 && (
                <p className="mt-2 text-sm text-muted">
                  Flagged in {flaggedCount} of your last {flaggedWindowSize} sessions.
                </p>
              )}
            </>
          ) : (
            <h1 className="mt-2 font-display text-4xl leading-tight font-extrabold tracking-tight text-ink uppercase">
              No priorities flagged yet
            </h1>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href={`/history/${sessions[0].id}`} variant="primary">
              Review latest session
            </ButtonLink>
            {latestSessionWithPlan && (
              <ButtonLink
                href={`/history/${latestSessionWithPlan.id}#training-plan`}
                variant="secondary"
              >
                Start today&apos;s drills
              </ButtonLink>
            )}
          </div>
        </div>

        <div className="relative grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line">
          <StatTile value={sessions.length} label="Sessions reviewed" />
          <StatTile value={clipsAnalyzed} label="Clips analyzed" />
          {strongestSkill && strongestTrend ? (
            <StatTile
              value={`${strongestTrend.windowCount}/${strongestTrend.windowSize}`}
              label={CATEGORY_LABELS[strongestSkill.category]}
              tone="accent"
            />
          ) : (
            <div className="bg-surface" />
          )}
          <div className="bg-surface" />
        </div>
      </Panel>

      <section className="mt-10">
        <Eyebrow>Skill trend · last 6 sessions</Eyebrow>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {RUBRIC_CATEGORIES.map((category) => {
            const insight = insights.find((i) => i.category === category)!;
            const tag = getCategoryTag(insight.status);
            const trend = buildCategoryTrend(insight, validSessions);
            return (
              <Panel key={category} className="p-4">
                <p className="font-semibold text-ink">{CATEGORY_LABELS[category]}</p>
                <p
                  className={`mt-1 text-xs font-bold uppercase tracking-wide ${
                    tag.tone === "accent"
                      ? "text-accent"
                      : tag.tone === "focus"
                        ? "text-focus"
                        : "text-muted"
                  }`}
                >
                  {tag.label}
                </p>
                <div className="mt-3">
                  <TrendBar segments={trend.segments} tone={trend.tone} />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {trend.captionLabel} {trend.windowCount} of {trend.windowSize}
                </p>
              </Panel>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <Eyebrow>Recent sessions</Eyebrow>
          <Link href="/history" className="text-sm font-semibold text-accent hover:underline">
            All history →
          </Link>
        </div>
        <ul className="mt-3 border-t border-line">
          {sessions.slice(0, 5).map((item) => (
            <SessionRow key={item.id} item={item} />
          ))}
        </ul>
      </section>
    </main>
  );
}
