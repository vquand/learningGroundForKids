-- River sharing: migration 29. Operator handoff only; do not run against production from this branch.
-- Apply the entire file before enabling the new API, with no parallel migration runner.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $river_migration$
DECLARE recorded_hash text;
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN RAISE EXCEPTION 'Migration history is missing'; END IF;
  LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
  SELECT hash INTO recorded_hash FROM drizzle.__drizzle_migrations WHERE created_at = 1792742943744;
  IF FOUND THEN
    IF recorded_hash <> '50066d0934dc44f30bfc8bbefe209cf56a18e2e752cd86e0ceb8af56fcb73b5a' THEN RAISE EXCEPTION 'Migration hash differs'; END IF;
    RAISE NOTICE 'Migration already applied; no changes made'; RETURN;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1792741755195 AND hash = 'bb1d02ac275f7c75a775496f5b047291bf25f90cba2c0b35ebdc1687cee54615') THEN RAISE EXCEPTION 'Required migration 0028_town_friend_baskets is missing or differs'; END IF;
  IF EXISTS(SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at > 1792742943744) THEN RAISE EXCEPTION 'Later migration exists without this migration'; END IF;

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

CREATE TABLE "town_raft_progress" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"fish_caught" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "town_raft_fish_caught" CHECK ("town_raft_progress"."fish_caught" BETWEEN 0 AND 50)
);

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

CREATE TABLE "town_river_inbox" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"last_sequence" bigint DEFAULT 0 NOT NULL,
	"last_arrival_id" text,
	"last_arrival_new" boolean DEFAULT false NOT NULL,
	"last_report" jsonb
);

ALTER TABLE "town_raft_items" ADD CONSTRAINT "town_raft_items_provider_id_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "town_raft_items" ADD CONSTRAINT "town_raft_items_picker_id_profiles_id_fk" FOREIGN KEY ("picker_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "town_raft_progress" ADD CONSTRAINT "town_raft_progress_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "town_river_events" ADD CONSTRAINT "town_river_events_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "town_river_inbox" ADD CONSTRAINT "town_river_inbox_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "town_raft_source" ON "town_raft_items" USING btree ("provider_id","source_key");
CREATE UNIQUE INDEX "town_raft_pickup_request" ON "town_raft_items" USING btree ("pickup_request_id");
CREATE INDEX "town_raft_stock" ON "town_raft_items" USING btree ("provider_id","picked_at","produced_at");
CREATE INDEX "town_raft_picker_day" ON "town_raft_items" USING btree ("picker_id","picked_at");
CREATE UNIQUE INDEX "town_river_receipt" ON "town_river_events" USING btree ("event_key");
CREATE INDEX "town_river_timeline" ON "town_river_events" USING btree ("owner_id","created_at","sequence");

  INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('50066d0934dc44f30bfc8bbefe209cf56a18e2e752cd86e0ceb8af56fcb73b5a', 1792742943744);
END;
$river_migration$;
COMMIT;
