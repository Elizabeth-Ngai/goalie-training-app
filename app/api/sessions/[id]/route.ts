import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteAnalysisSession, updateAnalysisSessionPlan } from "@/lib/sessions";
import { UpdateSessionRequestSchema } from "@/lib/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsedBody = UpdateSessionRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Missing or invalid plan data" }, { status: 400 });
  }

  const result = await updateAnalysisSessionPlan(id, userId, parsedBody.data);

  if (!result.ok) {
    return NextResponse.json({ error: "Couldn't save this training plan." }, { status: 502 });
  }
  // null = no row owned by this user with that id — don't reveal whether it
  // exists under another owner.
  if (result.data === null) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ id: result.data.id });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await deleteAnalysisSession(id, userId);

  if (!result.ok) {
    return NextResponse.json({ error: "Couldn't delete this session." }, { status: 502 });
  }
  if (!result.data.deleted) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
