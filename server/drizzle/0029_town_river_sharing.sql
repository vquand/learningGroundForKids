CREATE TABLE "town_raft_items" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"source_key" text NOT NULL,
	"kind" text NOT NULL,
	"item_id" text NOT NULL,
	"stamina" integer NOT NULL,
	"produced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"picker_id" text,
	"picked_at" timestamp with time zone,
	"pickup_request_id" text,
	CONSTRAINT "town_raft_kind" CHECK ("town_raft_items"."kind" IN ('fish','vegetable')),
	CONSTRAINT "town_raft_stamina" CHECK ("town_raft_items"."stamina" BETWEEN 1 AND 10),
	CONSTRAINT "town_raft_pickup_shape" CHECK (("town_raft_items"."picked_at" IS NULL AND "town_raft_items"."pickup_request_id" IS NULL) OR ("town_raft_items"."picked_at" IS NOT NULL AND "town_raft_items"."pickup_request_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "town_raft_progress" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"fish_caught" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "town_raft_fish_caught" CHECK ("town_raft_progress"."fish_caught" BETWEEN 0 AND 50)
);
--> statement-breakpoint
CREATE TABLE "town_river_events" (
	"sequence" bigserial PRIMARY KEY NOT NULL,
	"event_key" text NOT NULL,
	"owner_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"kind" text NOT NULL,
	"data" jsonb NOT NULL,
	"stamina" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "town_river_kind" CHECK ("town_river_events"."kind" IN ('visit','gift','pickup')),
	CONSTRAINT "town_river_stamina" CHECK ("town_river_events"."stamina">=0)
);
--> statement-breakpoint
CREATE TABLE "town_river_inbox" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"last_sequence" bigint DEFAULT 0 NOT NULL,
	"last_arrival_id" text,
	"last_arrival_new" boolean DEFAULT false NOT NULL,
	"last_report" jsonb
);
--> statement-breakpoint
ALTER TABLE "town_raft_items" ADD CONSTRAINT "town_raft_items_provider_id_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "town_raft_items" ADD CONSTRAINT "town_raft_items_picker_id_profiles_id_fk" FOREIGN KEY ("picker_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "town_raft_progress" ADD CONSTRAINT "town_raft_progress_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "town_river_events" ADD CONSTRAINT "town_river_events_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "town_river_inbox" ADD CONSTRAINT "town_river_inbox_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "town_raft_source" ON "town_raft_items" USING btree ("provider_id","source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "town_raft_pickup_request" ON "town_raft_items" USING btree ("pickup_request_id");--> statement-breakpoint
CREATE INDEX "town_raft_stock" ON "town_raft_items" USING btree ("provider_id","picked_at","produced_at");--> statement-breakpoint
CREATE INDEX "town_raft_picker_day" ON "town_raft_items" USING btree ("picker_id","picked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "town_river_receipt" ON "town_river_events" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "town_river_timeline" ON "town_river_events" USING btree ("owner_id","created_at","sequence");
