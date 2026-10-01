import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProfile, upsertProfile } from "@/lib/profiles";
import { ProfileRequestSchema } from "@/lib/schemas";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getProfile(userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Couldn't load your profile." }, { status: 502 });
  }

  // null = no profile yet; invalid = stored row failed validation. Either way
  // the client just treats it as "no usable defaults".
  const defaults = result.data && result.data.valid ? result.data.data : null;
  return NextResponse.json({ defaults });
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsedBody = ProfileRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Missing or invalid profile data" }, { status: 400 });
  }

  const result = await upsertProfile(userId, parsedBody.data.defaults);
  if (!result.ok) {
    return NextResponse.json({ error: "Couldn't save your profile." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
