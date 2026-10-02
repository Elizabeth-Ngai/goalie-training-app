import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { callSessionSynthesis, stampSingleClipProvenance } from "@/lib/providers";
import { SynthesizeSessionRequestSchema } from "@/lib/schemas";

// Its own request budget (no analysis/synthesis competing) — the input is
// text-only per-clip reports, so this is fast, but keep headroom.
export const maxDuration = 60;

// Cross-clip synthesis is AI-consuming, so it must be authenticated (not
// anonymously callable) and server-side bounded (1-5 clips, enforced by the
// Zod schema — never trusting the client UI cap). It does NOT read the DB or
// verify clip ownership: it only combines report JSON the caller already
// holds locally and returns a combined report; nothing is persisted here.
// Persistence + ownership happen later via POST /api/sessions.
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsedBody = SynthesizeSessionRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Missing or invalid clip reports" }, { status: 400 });
  }

  const clips = parsedBody.data.clips;

  // One clip in → no AI call needed; deterministically stamp that clip's
  // provenance onto its report so the single successful clip keeps its
  // identity (the "multiple uploaded, one analyzed" case lands here too).
  if (clips.length === 1) {
    const report = stampSingleClipProvenance(clips[0].report, clips[0].clipId);
    return NextResponse.json({ report });
  }

  const result = await callSessionSynthesis(clips);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Couldn't combine your clips. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ report: result.report });
}
