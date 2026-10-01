CREATE TABLE "goalkeeper_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"defaults" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
