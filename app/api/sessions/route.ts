import { NextResponse } from "next/server";
import { createAnalysisSession } from "@/lib/sessions";
import { CreateSessionRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await request.json();
  const parsedBody = CreateSessionRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Missing or invalid session data" }, { status: 400 });
  }

  const result = await createAnalysisSession(parsedBody.data);

  if (!result.ok) {
    return NextResponse.json({ error: "Couldn't save this session." }, { status: 502 });
  }

  return NextResponse.json({ id: result.data.id });
}
