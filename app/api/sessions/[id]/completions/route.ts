import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteDrillCompletion, upsertDrillCompletion } from "@/lib/trainingCompletions";
import { DeleteCompletionRequestSchema, SetCompletionRequestSchema } from "@/lib/schemas";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsedBody = SetCompletionRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Missing or invalid completion data" }, { status: 400 });
  }

  const result = await upsertDrillCompletion(userId, id, parsedBody.data.drillId, parsedBody.data.status);

  if (!result.ok) {
    return NextResponse.json({ error: "Couldn't save this drill's status." }, { status: 502 });
  }
  // found:false covers a non-owner, a forged session id, AND a forged drill
  // id not present in this session's own persisted plan — never
  // distinguishing which, same convention as "Session not found" elsewhere.
  if (!result.data.found) {
    return NextResponse.json({ error: "Drill not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsedBody = DeleteCompletionRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Missing or invalid completion data" }, { status: 400 });
  }

  const result = await deleteDrillCompletion(userId, id, parsedBody.data.drillId);

  if (!result.ok) {
    return NextResponse.json({ error: "Couldn't update this drill's status." }, { status: 502 });
  }
  // Idempotent: deleting an already-absent record is not an error.
  return NextResponse.json({ ok: true, deleted: result.data.deleted });
}
