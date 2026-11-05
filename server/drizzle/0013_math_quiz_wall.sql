CREATE TABLE "math_wall_progress" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"best_score" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "math_wall_best_nonnegative" CHECK ("math_wall_progress"."best_score" >= 0)
);
--> statement-breakpoint
ALTER TABLE "math_wall_progress" ADD CONSTRAINT "math_wall_progress_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;