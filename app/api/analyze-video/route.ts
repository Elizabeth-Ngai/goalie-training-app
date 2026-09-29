import { NextResponse } from "next/server";
import { callClaude, callGemini, callOpenAI, callSynthesis } from "@/lib/providers";
import { AnalyzeVideoRequestSchema } from "@/lib/schemas";

// Three concurrent provider analysis calls plus one sequential synthesis
// call can exceed a default serverless function timeout.
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json();
  const parsedBody = AnalyzeVideoRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Missing or invalid frames" }, { status: 400 });
  }

  const rawFrames = parsedBody.data.frames.map((frame) => ({
    timestamp: frame.timestamp,
    base64: frame.dataUrl.replace(/^data:image\/\w+;base64,/, ""),
  }));

  const results = await Promise.all([
    callOpenAI(rawFrames),
    callGemini(rawFrames),
    callClaude(rawFrames),
  ]);

  const successes = results.filter(
    (result): result is Extract<typeof result, { ok: true }> => result.ok
  );

  // Never expose which provider(s) failed, or their raw error text, to the
  // client — only the count of successes ever leaves the server, via the
  // synthesized report's sourceCount field.
  if (successes.length === 0) {
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 502 }
    );
  }

  const synthesis = await callSynthesis(
    successes.map((result) => ({ provider: result.provider, analysis: result.analysis }))
  );

  if (!synthesis.ok) {
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ report: synthesis.report });
}
