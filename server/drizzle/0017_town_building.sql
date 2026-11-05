CREATE TABLE "town_drink_sessions" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "town_learned_items" (
	"profile_id" text NOT NULL,
	"item_id" text NOT NULL,
	CONSTRAINT "town_learned_items_profile_id_item_id_pk" PRIMARY KEY("profile_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "town_reward_events" (
	"profile_id" text NOT NULL,
	"event_id" text NOT NULL,
	"reward" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "town_reward_events_profile_id_event_id_pk" PRIMARY KEY("profile_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "town_state" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "passkeys" ALTER COLUMN "counter" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "town_drink_sessions" ADD CONSTRAINT "town_drink_sessions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "town_learned_items" ADD CONSTRAINT "town_learned_items_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "town_reward_events" ADD CONSTRAINT "town_reward_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "town_state" ADD CONSTRAINT "town_state_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;