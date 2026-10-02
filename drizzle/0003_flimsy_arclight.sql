CREATE TABLE "analysis_clips" (
	"id" uuid PRIMARY KEY NOT NULL,
	"analysis_session_id" uuid NOT NULL,
	"video_url" text NOT NULL,
	"video_filename" text NOT NULL,
	"display_order" integer NOT NULL,
	"status" text DEFAULT 'analyzed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_clips" ADD CONSTRAINT "analysis_clips_analysis_session_id_analysis_sessions_id_fk" FOREIGN KEY ("analysis_session_id") REFERENCES "public"."analysis_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_clips_session_idx" ON "analysis_clips" USING btree ("analysis_session_id","display_order");