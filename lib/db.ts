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
    // Owner's Clerk userId. Kept nullable this phase: legacy pre-auth rows
    // have NULL here and stay invisible (lib/sessions.ts filters strictly on
    // eq(user_id, currentUser), never OR IS NULL). New rows always get an
    // authenticated owner at creation. NOT-NULL tightening + legacy cleanup
    // is a later phase.
    userId: text("user_id"),
  },
  (table) => [index("analysis_sessions_created_at_idx").on(table.createdAt.desc())]
);

// One row per Clerk user holding their stable default training preferences
// (a GoalkeeperProfileDefaults — a SUBSET of PlayerInfo, not the full thing).
// Used to prefill the per-session PlayerInfo form; editing a session's
// PlayerInfo never writes back here. jsonb + validate-on-read, same as above.
export const goalkeeperProfiles = pgTable("goalkeeper_profiles", {
  userId: text("user_id").primaryKey(),
  defaults: jsonb("defaults").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Guarded: importable and safely exercisable with zero env vars set (local
// dev without a provisioned database, or a build with no DATABASE_URL yet).
// Every lib/sessions.ts / lib/profiles.ts function checks `db` for null first.
const connectionString = process.env.DATABASE_URL;
export const db = connectionString
  ? drizzle(neon(connectionString), { schema: { analysisSessions, goalkeeperProfiles } })
  : null;
