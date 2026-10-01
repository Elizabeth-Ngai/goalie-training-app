CREATE TABLE "analysis_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"video_url" text NOT NULL,
	"video_filename" text NOT NULL,
	"report" jsonb NOT NULL,
	"player_info" jsonb,
	"training_plan" jsonb,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE INDEX "analysis_sessions_created_at_idx" ON "analysis_sessions" USING btree ("created_at" DESC NULLS LAST);