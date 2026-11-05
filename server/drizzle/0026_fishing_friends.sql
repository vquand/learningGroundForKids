CREATE TABLE "fishing_cast_results" (
	"profile_id" text NOT NULL,
	"cast_id" text NOT NULL,
	"location" text NOT NULL,
	"fish_id" text,
	"stamina" integer NOT NULL,
	"points" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fishing_cast_results_profile_id_cast_id_pk" PRIMARY KEY("profile_id","cast_id")
);
--> statement-breakpoint
CREATE TABLE "fishing_progress" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fishing_cast_results" ADD CONSTRAINT "fishing_cast_results_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fishing_progress" ADD CONSTRAINT "fishing_progress_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;