CREATE TABLE "achievement_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"definition" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "infinidrill_progress" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "infinidrill_progress" ADD CONSTRAINT "infinidrill_progress_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;