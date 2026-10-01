// Goalkeeper profile persistence (Phase 4). Same conventions as
// lib/sessions.ts: guarded on `db`, never throws, returns DbResult, and
// validates the stored jsonb through Zod on read (never blind-casts).
import { eq } from "drizzle-orm";
import { db, goalkeeperProfiles } from "@/lib/db";
import {
  GoalkeeperProfileDefaults,
  GoalkeeperProfileDefaultsSchema,
} from "@/lib/schemas";
import type { DbResult, Validated } from "@/lib/sessions";

export async function getProfile(
  userId: string
): Promise<DbResult<Validated<GoalkeeperProfileDefaults> | null>> {
  if (!db) return { ok: false, error: "Database is not configured." };
  try {
    const rows = await db
      .select()
      .from(goalkeeperProfiles)
      .where(eq(goalkeeperProfiles.userId, userId))
      .limit(1);
    const row = rows[0];
    if (!row) return { ok: true, data: null };
    const parsed = GoalkeeperProfileDefaultsSchema.safeParse(row.defaults);
    return { ok: true, data: parsed.success ? { valid: true, data: parsed.data } : { valid: false } };
  } catch (error) {
    console.error("[profiles] get: failed");
    return { ok: false, error: (error as Error).message };
  }
}

export async function upsertProfile(
  userId: string,
  defaults: GoalkeeperProfileDefaults
): Promise<DbResult<{ userId: string }>> {
  if (!db) return { ok: false, error: "Database is not configured." };
  try {
    const rows = await db
      .insert(goalkeeperProfiles)
      .values({ userId, defaults })
      .onConflictDoUpdate({
        target: goalkeeperProfiles.userId,
        set: { defaults, updatedAt: new Date() },
      })
      .returning({ userId: goalkeeperProfiles.userId });
    return { ok: true, data: { userId: rows[0].userId } };
  } catch (error) {
    console.error("[profiles] upsert: failed");
    return { ok: false, error: (error as Error).message };
  }
}
