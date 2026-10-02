CREATE TABLE "training_drill_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"analysis_session_id" uuid NOT NULL,
	"drill_id" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_drill_completions_user_id_analysis_session_id_drill_id_unique" UNIQUE("user_id","analysis_session_id","drill_id")
);
--> statement-breakpoint
ALTER TABLE "training_drill_completions" ADD CONSTRAINT "training_drill_completions_analysis_session_id_analysis_sessions_id_fk" FOREIGN KEY ("analysis_session_id") REFERENCES "public"."analysis_sessions"("id") ON DELETE cascade ON UPDATE no action;