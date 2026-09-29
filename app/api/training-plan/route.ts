import { NextResponse } from "next/server";
import { generateTrainingPlan } from "@/lib/providers";
import { TrainingPlanRequestSchema } from "@/lib/schemas";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json();
  const parsedBody = TrainingPlanRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Missing or invalid report/player information" },
      { status: 400 }
    );
  }

  const plan = await generateTrainingPlan(parsedBody.data.report, parsedBody.data.playerInfo);

  if (!plan.ok) {
    return NextResponse.json(
      { error: "Couldn't generate a training plan. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ plan: plan.plan });
}
