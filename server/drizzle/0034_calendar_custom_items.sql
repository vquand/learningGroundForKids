CREATE TABLE "calendar_study_library" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"subject" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "name_history" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_study_library" ADD CONSTRAINT "calendar_study_library_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_study_library_profile_id_subject_name_key" ON "calendar_study_library" USING btree ("profile_id","subject","name");