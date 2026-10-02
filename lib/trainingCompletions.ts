// Training-drill completion persistence (Phase 6). Mirrors lib/sessions.ts's
// conventions: guarded on `db`, never throws, DbResult shape, ownership
// scoped by Clerk userId derived server-side (never trusted from a client).
//
// Absence of a row IS the "untracked" state — there is no stored
// 'untracked'/'not_started' value. Only 'completed' | 'skipped' are ever
// written; "undo" deletes the row rather than writing a third status.
import { and, eq, inArray } from "drizzle-orm";
import { analysisSessions, db, trainingDrillCompletions } from "@/lib/db";
import { CompletionStatus, TrainingPlanSchema } from "@/lib/schemas";
import type { DbResult } from "@/lib/sessions";

export type DrillCompletionRecord = {
  analysisSessionId: string;
  drillId: string;
  status: CompletionStatus;
  updatedAt: Date;
};

// Checks the drillId actually exists somewhere in the session's own
// persisted training_plan before allowing a completion write — rejects a
// forged drill id outright, independent of the ownership check.
async function drillExistsInSessionPlan(analysisSessionId: string, userId: string, drillId: string): Promise<boolean> {
  if (!db) return false;
  const rows = await db
    .select({ trainingPlan: analysisSessions.trainingPlan })
    .from(analysisSessions)
    .where(and(eq(analysisSessions.id, analysisSessionId), eq(analysisSessions.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return false; // not owned, or doesn't exist — never distinguish which

  const parsed = TrainingPlanSchema.safeParse(row.trainingPlan);
  if (!parsed.success) return false;

  return parsed.data.days.some((day) => day.drills.some((drill) => drill.drillId === drillId));
}

export async function upsertDrillCompletion(
  userId: string,
  analysisSessionId: string,
  drillId: string,
  status: CompletionStatus
): Promise<DbResult<{ found: boolean }>> {
  if (!db) return { ok: false, error: "Database is not configured." };
  try {
    // Ownership + drill-existence are both re-verified here (not trusted
    // from any earlier step) — a non-owner or a forged drillId both
    // resolve to the same found:false outcome, never leaking which.
    const exists = await drillExistsInSessionPlan(analysisSessionId, userId, drillId);
    if (!exists) return { ok: true, data: { found: false } };

    await db
      .insert(trainingDrillCompletions)
      .values({ userId, analysisSessionId, drillId, status })
      .onConflictDoUpdate({
        target: [
          trainingDrillCompletions.userId,
          trainingDrillCompletions.analysisSessionId,
          trainingDrillCompletions.drillId,
        ],
        set: { status, updatedAt: new Date() },
      });

    return { ok: true, data: { found: true } };
  } catch (error) {
    console.error("[trainingCompletions] upsert: failed");
    return { ok: false, error: (error as Error).message };
  }
}

export async function deleteDrillCompletion(
  userId: string,
  analysisSessionId: string,
  drillId: string
): Promise<DbResult<{ deleted: boolean }>> {
  if (!db) return { ok: false, error: "Database is not configured." };
  try {
    const rows = await db
      .delete(trainingDrillCompletions)
      .where(
        and(
          eq(trainingDrillCompletions.userId, userId),
          eq(trainingDrillCompletions.analysisSessionId, analysisSessionId),
          eq(trainingDrillCompletions.drillId, drillId)
        )
      )
      .returning({ id: trainingDrillCompletions.id });

    return { ok: true, data: { deleted: rows.length > 0 } };
  } catch (error) {
    console.error("[trainingCompletions] delete: failed");
    return { ok: false, error: (error as Error).message };
  }
}

export async function listDrillCompletionsForSession(
  userId: string,
  analysisSessionId: string
): Promise<DbResult<Record<string, CompletionStatus>>> {
  if (!db) return { ok: false, error: "Database is not configured." };
  try {
    const rows = await db
      .select({ drillId: trainingDrillCompletions.drillId, status: trainingDrillCompletions.status })
      .from(trainingDrillCompletions)
      .where(
        and(
          eq(trainingDrillCompletions.userId, userId),
          eq(trainingDrillCompletions.analysisSessionId, analysisSessionId)
        )
      );

    const map: Record<string, CompletionStatus> = {};
    for (const row of rows) map[row.drillId] = row.status as CompletionStatus;
    return { ok: true, data: map };
  } catch (error) {
    console.error("[trainingCompletions] list-for-session: failed");
    return { ok: false, error: (error as Error).message };
  }
}

// Batched across multiple sessions in ONE query — used by the adaptive-
// context assembly (lib/adaptiveTraining.ts) so building training history
// for up to ADAPTIVE_TRAINING_HISTORY_LIMIT sessions never costs more than
// a single round trip. Short-circuits on an empty id list rather than
// issuing an empty `IN ()` query.
export async function listDrillCompletionsForSessions(
  userId: string,
  sessionIds: string[]
): Promise<DbResult<DrillCompletionRecord[]>> {
  if (sessionIds.length === 0) return { ok: true, data: [] };
  if (!db) return { ok: false, error: "Database is not configured." };
  try {
    const rows = await db
      .select({
        analysisSessionId: trainingDrillCompletions.analysisSessionId,
        drillId: trainingDrillCompletions.drillId,
        status: trainingDrillCompletions.status,
        updatedAt: trainingDrillCompletions.updatedAt,
      })
      .from(trainingDrillCompletions)
      .where(
        and(eq(trainingDrillCompletions.userId, userId), inArray(trainingDrillCompletions.analysisSessionId, sessionIds))
      );

    return {
      ok: true,
      data: rows.map((row) => ({
        analysisSessionId: row.analysisSessionId,
        drillId: row.drillId,
        status: row.status as CompletionStatus,
        updatedAt: row.updatedAt,
      })),
    };
  } catch (error) {
    console.error("[trainingCompletions] list-for-sessions: failed");
    return { ok: false, error: (error as Error).message };
  }
}
