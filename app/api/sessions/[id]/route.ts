import { NextResponse } from "next/server";
import { deleteAnalysisSession, updateAnalysisSessionPlan } from "@/lib/sessions";
import { UpdateSessionRequestSchema } from "@/lib/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsedBody = UpdateSessionRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Missing or invalid plan data" }, { status: 400 });
  }

  const result = await updateAnalysisSessionPlan(id, parsedBody.data);

  if (!result.ok) {
    return NextResponse.json({ error: "Couldn't save this training plan." }, { status: 502 });
  }
  if (result.data === null) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ id: result.data.id });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteAnalysisSession(id);

  if (!result.ok) {
    return NextResponse.json({ error: "Couldn't delete this session." }, { status: 502 });
  }
  if (!result.data.deleted) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
