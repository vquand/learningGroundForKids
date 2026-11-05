CREATE TABLE "cabbage_roll_sessions" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cabbage_roll_sessions" ADD CONSTRAINT "cabbage_roll_sessions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;