import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAnalysisSession } from "@/lib/sessions";
import { CreateSessionRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  // Owner derived from the authenticated session, never from the request body.
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsedBody = CreateSessionRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Missing or invalid session data" }, { status: 400 });
  }

  const result = await createAnalysisSession({ ...parsedBody.data, userId });

  if (!result.ok) {
    return NextResponse.json({ error: "Couldn't save this session." }, { status: 502 });
  }

  return NextResponse.json({ id: result.data.id });
}
