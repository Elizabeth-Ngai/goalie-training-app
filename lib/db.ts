// Drizzle table definition + database client for analysis-session
// persistence (Phase 3). The jsonb columns are deliberately left untyped
// (no .$type<T>() generic) so no call site can treat a row as a trusted
// GoalieReport/PlayerInfo/TrainingPlan without running it through the Zod
// schemas in lib/schemas.ts first — see lib/sessions.ts for the validated
// read path.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const analysisSessions = pgTable(
  "analysis_sessions",
  {
    // Client-generated (crypto.randomUUID() at upload time), not server-
    // assigned — see lib/sessions.ts createAnalysisSession for why this is
    // an upsert keyed on a caller-supplied id rather than a plain insert.
    id: uuid("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    videoUrl: text("video_url").notNull(),
    videoFilename: text("video_filename").notNull(),
    report: jsonb("report").notNull(),
    playerInfo: jsonb("player_info"),
    trainingPlan: jsonb("training_plan"),
    schemaVersion: integer("schema_version").notNull().default(1),
    // Nullable, unused today — forward-compatible column for a future auth
    // phase. Does not enforce any access control; see Phase 3 privacy notes.
    userId: text("user_id"),
  },
  (table) => [index("analysis_sessions_created_at_idx").on(table.createdAt.desc())]
);

// Guarded: importable and safely exercisable with zero env vars set (local
// dev without a provisioned database, or a build with no DATABASE_URL yet).
// Every lib/sessions.ts function checks `db` for null before querying.
const connectionString = process.env.DATABASE_URL;
export const db = connectionString
  ? drizzle(neon(connectionString), { schema: { analysisSessions } })
  : null;
