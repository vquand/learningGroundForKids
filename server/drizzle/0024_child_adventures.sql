CREATE TABLE "adventure_events" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"event_key" text NOT NULL,
	"game" text NOT NULL,
	"kind" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kitchen_sessions" (
	"profile_id" text NOT NULL,
	"recipe_id" text NOT NULL,
	"state" jsonb NOT NULL,
	CONSTRAINT "kitchen_sessions_profile_id_recipe_id_pk" PRIMARY KEY("profile_id","recipe_id")
);
--> statement-breakpoint
ALTER TABLE "adventure_events" ADD CONSTRAINT "adventure_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_sessions" ADD CONSTRAINT "kitchen_sessions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "adventure_events_profile_key" ON "adventure_events" USING btree ("profile_id","event_key");--> statement-breakpoint
CREATE INDEX "adventure_events_profile_time" ON "adventure_events" USING btree ("profile_id","created_at","id");