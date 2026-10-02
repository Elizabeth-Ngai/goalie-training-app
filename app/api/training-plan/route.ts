import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateTrainingPlan } from "@/lib/providers";
import { TrainingPlanRequestSchema } from "@/lib/schemas";
import { listRecentSessionDetails } from "@/lib/sessions";
import { listDrillCompletionsForSessions } from "@/lib/trainingCompletions";
import {
  ADAPTIVE_TRAINING_HISTORY_LIMIT,
  buildAdaptiveTrainingContext,
  explainAdaptation,
  type AdaptiveTrainingContext,
} from "@/lib/adaptiveTraining";
import type { ProgressSession } from "@/lib/progress";

export const maxDuration = 60;

// Builds adaptive context for `userId`, excluding `analysisSessionId` (the
// session currently being generated for — never double-counted as
// historical). Returns undefined on ANY failure or insufficient input,
// rather than throwing — adaptive context is an enhancement, never a hard
// dependency of plan generation. Also returns undefined when
// analysisSessionId is absent entirely: without a reliable exclusion id,
// building history risks double-counting the current report, so we simply
// don't attempt it (current-analysis-only generation).
async function tryBuildAdaptiveContext(
  userId: string,
  analysisSessionId: string | undefined,
  report: Parameters<typeof buildAdaptiveTrainingContext>[0]
): Promise<AdaptiveTrainingContext | undefined> {
  if (!analysisSessionId) return undefined;

  try {
    const recentDetails = await listRecentSessionDetails(userId, {
      excludeSessionId: analysisSessionId,
      limit: ADAPTIVE_TRAINING_HISTORY_LIMIT,
    });
    if (!recentDetails.ok) return undefined;

    const sessionIds = recentDetails.data.map((s) => s.id);
    const completions = await listDrillCompletionsForSessions(userId, sessionIds);
    if (!completions.ok) return undefined;

    const progressSessions: ProgressSession[] = [];
    for (const s of recentDetails.data) {
      if (s.report.valid) progressSessions.push({ id: s.id, createdAt: s.createdAt, report: s.report.data });
    }

    return buildAdaptiveTrainingContext(report, progressSessions, recentDetails.data, completions.data);
  } catch {
    // Any unexpected failure degrades to current-analysis-only — never
    // blocks plan generation.
    return undefined;
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsedBody = TrainingPlanRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Missing or invalid report/player information" },
      { status: 400 }
    );
  }

  const adaptiveContext = await tryBuildAdaptiveContext(
    userId,
    parsedBody.data.analysisSessionId,
    parsedBody.data.report
  );

  const plan = await generateTrainingPlan(parsedBody.data.report, parsedBody.data.playerInfo, adaptiveContext);

  if (!plan.ok) {
    return NextResponse.json(
      { error: "Couldn't generate a training plan. Please try again." },
      { status: 502 }
    );
  }

  // Deterministic, evidence-based explanation of how history shaped the plan.
  // Computed here (where the context already lives), shown only right after
  // generation — never persisted, never reconstructed later for a historical
  // plan against a changed progress state.
  const adaptationNotes = adaptiveContext ? explainAdaptation(adaptiveContext) : [];

  return NextResponse.json({ plan: plan.plan, adaptationNotes });
}
