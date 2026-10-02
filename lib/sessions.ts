// Analysis-session persistence. Mirrors lib/providers.ts's never-throw
// {ok:true,data}|{ok:false,error} convention for consistency with the rest
// of the codebase. Every function guards on `db` being configured, so this
// module is safely callable (and the app safely buildable) with zero env
// vars set — in that state every function just resolves { ok: false }.
//
// IMPORTANT: this silent "no persistence configured" degrade is correct for
// local dev / Group A, but should NOT be mistaken for acceptable production
// behavior — a missing DATABASE_URL in production should fail loudly, not
// quietly run with history disabled. That visibility mechanism isn't built
// in this phase; this comment is the flag for it.
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { analysisSessions, db } from "@/lib/db";
import {
  GoalieReport,
  GoalieReportSchema,
  PlayerInfo,
  PlayerInfoSchema,
  TrainingPlan,
  TrainingPlanSchema,
} from "@/lib/schemas";

export type DbResult<T> = { ok: true; data: T } | { ok: false; error: string };

// A JSONB field read back from the DB is only as good as its own safeParse.
// Callers branch on `.valid` — they never cast a raw column value to a
// trusted type.
export type Validated<T> = { valid: true; data: T } | { valid: false };

function toValidated<T>(parsed: { success: boolean; data?: T }): Validated<T> {
  return parsed.success ? { valid: true, data: parsed.data as T } : { valid: false };
}

export type SessionListItem = {
  id: string;
  createdAt: Date;
  videoFilename: string;
  report: Validated<GoalieReport>;
  hasTrainingPlan: boolean;
  trainingDayCount: number | null;
};

export type SessionDetail = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  videoUrl: string;
  videoFilename: string;
  report: Validated<GoalieReport>;
  playerInfo: Validated<PlayerInfo> | null; // null = no plan attempted yet
  trainingPlan: Validated<TrainingPlan> | null; // null = no plan attempted yet
};

export async function createAnalysisSession(input: {
  id: string;
  userId: string;
  videoUrl: string;
  videoFilename: string;
  report: GoalieReport;
}): Promise<DbResult<{ id: string }>> {
  if (!db) return { ok: false, error: "Database is not configured." };
  try {
    // Upsert keyed on the client-generated id: a retried save after a network
    // timeout re-applies the same analysis data rather than risking a
    // duplicate row. Deliberately omits player_info/training_plan from the
    // update set so a replayed create can never clobber a plan attached in
    // between by a later PATCH. The setWhere ownership guard means a (vanishingly
    // unlikely) id collision from a different user can never overwrite their
    // row — the update only applies to the caller's own row.
    const rows = await db
      .insert(analysisSessions)
      .values({
        id: input.id,
        userId: input.userId,
        videoUrl: input.videoUrl,
        videoFilename: input.videoFilename,
        report: input.report,
        schemaVersion: 1,
      })
      .onConflictDoUpdate({
        target: analysisSessions.id,
        set: {
          videoUrl: input.videoUrl,
          videoFilename: input.videoFilename,
          report: input.report,
          updatedAt: new Date(),
        },
        setWhere: eq(analysisSessions.userId, input.userId),
      })
      .returning({ id: analysisSessions.id });

    // No returned row => the id exists but is owned by someone else (the
    // setWhere blocked the update). Treat as a failure rather than silently
    // succeeding without persisting.
    if (!rows[0]) return { ok: false, error: "Session id conflict." };
    return { ok: true, data: { id: rows[0].id } };
  } catch (error) {
    console.error("[sessions] create: failed");
    return { ok: false, error: (error as Error).message };
  }
}

export async function updateAnalysisSessionPlan(
  id: string,
  userId: string,
  input: { playerInfo: PlayerInfo; trainingPlan: TrainingPlan }
): Promise<DbResult<{ id: string } | null>> {
  if (!db) return { ok: false, error: "Database is not configured." };
  try {
    // Ownership-scoped: a non-owner (or a NULL legacy row) matches nothing,
    // so data is null -> the route returns 404 without revealing existence.
    const rows = await db
      .update(analysisSessions)
      .set({
        playerInfo: input.playerInfo,
        trainingPlan: input.trainingPlan,
        updatedAt: new Date(), // DEFAULT now() only fires on INSERT, not UPDATE
      })
      .where(and(eq(analysisSessions.id, id), eq(analysisSessions.userId, userId)))
      .returning({ id: analysisSessions.id });

    return { ok: true, data: rows[0] ? { id: rows[0].id } : null };
  } catch (error) {
    console.error("[sessions] update-plan: failed");
    return { ok: false, error: (error as Error).message };
  }
}

export async function getAnalysisSession(
  id: string,
  userId: string
): Promise<DbResult<SessionDetail | null>> {
  if (!db) return { ok: false, error: "Database is not configured." };
  try {
    // Ownership-scoped: a non-owner gets null -> the page calls notFound(),
    // so there's no way to probe whether another user's session id exists.
    const rows = await db
      .select()
      .from(analysisSessions)
      .where(and(eq(analysisSessions.id, id), eq(analysisSessions.userId, userId)))
      .limit(1);
    const row = rows[0];
    if (!row) return { ok: true, data: null };

    return {
      ok: true,
      data: {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        videoUrl: row.videoUrl,
        videoFilename: row.videoFilename,
        report: toValidated(GoalieReportSchema.safeParse(row.report)),
        playerInfo: row.playerInfo === null ? null : toValidated(PlayerInfoSchema.safeParse(row.playerInfo)),
        trainingPlan:
          row.trainingPlan === null ? null : toValidated(TrainingPlanSchema.safeParse(row.trainingPlan)),
      },
    };
  } catch (error) {
    console.error("[sessions] get: failed");
    return { ok: false, error: (error as Error).message };
  }
}

export async function listAnalysisSessions(opts: {
  userId: string;
  limit?: number;
  offset?: number;
}): Promise<DbResult<SessionListItem[]>> {
  if (!db) return { ok: false, error: "Database is not configured." };
  try {
    const rows = await db
      .select({
        id: analysisSessions.id,
        createdAt: analysisSessions.createdAt,
        videoFilename: analysisSessions.videoFilename,
        report: analysisSessions.report,
        // Computed in Postgres so the (possibly large) full training_plan
        // JSONB never has to leave the database for a list card that only
        // shows a status + day count.
        hasTrainingPlan: sql<boolean>`${analysisSessions.trainingPlan} is not null`,
        trainingDayCount: sql<number | null>`jsonb_array_length(${analysisSessions.trainingPlan} -> 'days')`,
      })
      .from(analysisSessions)
      // Scoped to the owner. Legacy rows with user_id = NULL match nothing
      // (eq, not OR IS NULL) and stay invisible.
      .where(eq(analysisSessions.userId, opts.userId))
      .orderBy(desc(analysisSessions.createdAt))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);

    return {
      ok: true,
      data: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        videoFilename: row.videoFilename,
        report: toValidated(GoalieReportSchema.safeParse(row.report)),
        hasTrainingPlan: Boolean(row.hasTrainingPlan),
        trainingDayCount: row.trainingDayCount ?? null,
      })),
    };
  } catch (error) {
    console.error("[sessions] list: failed");
    return { ok: false, error: (error as Error).message };
  }
}

// Full session details (including the full training_plan jsonb, unlike
// listAnalysisSessions which deliberately omits it for the lighter history
// list) for the most recent sessions OWNED by userId, excluding one specific
// session in a single query. Built for Phase 6's adaptive-context assembly:
// excludeSessionId is always the session currently being generated for, so
// its own report/plan is never double-counted as "historical." A dedicated
// query rather than weakening listAnalysisSessions's existing boundary,
// matching the precedent set in Phase 5.
export type RecentSessionDetail = {
  id: string;
  createdAt: Date;
  report: Validated<GoalieReport>;
  trainingPlan: Validated<TrainingPlan> | null;
};

export async function listRecentSessionDetails(
  userId: string,
  opts: { excludeSessionId?: string; limit: number }
): Promise<DbResult<RecentSessionDetail[]>> {
  if (!db) return { ok: false, error: "Database is not configured." };
  try {
    const whereClause = opts.excludeSessionId
      ? and(eq(analysisSessions.userId, userId), ne(analysisSessions.id, opts.excludeSessionId))
      : eq(analysisSessions.userId, userId);

    const rows = await db
      .select({
        id: analysisSessions.id,
        createdAt: analysisSessions.createdAt,
        report: analysisSessions.report,
        trainingPlan: analysisSessions.trainingPlan,
      })
      .from(analysisSessions)
      .where(whereClause)
      .orderBy(desc(analysisSessions.createdAt))
      .limit(opts.limit);

    return {
      ok: true,
      data: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        report: toValidated(GoalieReportSchema.safeParse(row.report)),
        trainingPlan:
          row.trainingPlan === null ? null : toValidated(TrainingPlanSchema.safeParse(row.trainingPlan)),
      })),
    };
  } catch (error) {
    console.error("[sessions] list-recent-details: failed");
    return { ok: false, error: (error as Error).message };
  }
}

export async function deleteAnalysisSession(
  id: string,
  userId: string
): Promise<DbResult<{ deleted: boolean }>> {
  if (!db) return { ok: false, error: "Database is not configured." };
  try {
    // Database row only — the underlying Vercel Blob is never touched here.
    // See Phase 3 notes: Blob cleanup on delete is a known pre-launch gap,
    // not an oversight. Ownership-scoped: a non-owner matches nothing, so
    // deleted:false -> the route returns 404 and the owner's row is intact.
    const rows = await db
      .delete(analysisSessions)
      .where(and(eq(analysisSessions.id, id), eq(analysisSessions.userId, userId)))
      .returning({ id: analysisSessions.id });

    return { ok: true, data: { deleted: rows.length > 0 } };
  } catch (error) {
    console.error("[sessions] delete: failed");
    return { ok: false, error: (error as Error).message };
  }
}
