CREATE TABLE "daily_quiz_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"snapshot_date" date NOT NULL,
	"lang" text NOT NULL,
	"question_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_quiz_snapshots" ADD CONSTRAINT "daily_quiz_snapshots_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_quiz_snapshots_profile_date_unique" ON "daily_quiz_snapshots" USING btree ("profile_id","snapshot_date");