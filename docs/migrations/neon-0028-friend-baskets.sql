-- Friend baskets: migration 28. Operator handoff only; do not run against production from this branch.
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
  SELECT hash INTO recorded_hash FROM drizzle.__drizzle_migrations WHERE created_at = 1792741755195;
  IF FOUND THEN
    IF recorded_hash <> 'bb1d02ac275f7c75a775496f5b047291bf25f90cba2c0b35ebdc1687cee54615' THEN RAISE EXCEPTION 'Migration hash differs'; END IF;
    RAISE NOTICE 'Migration already applied; no changes made'; RETURN;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1792519346341 AND hash = '99320c3c8d27f21b3c9bade87b00bd89da7eb463b274ae84c7e9c50732f6e5b9') THEN RAISE EXCEPTION 'Required migration 0027_road_racing is missing or differs'; END IF;
  IF EXISTS(SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at > 1792741755195) THEN RAISE EXCEPTION 'Later migration exists without this migration'; END IF;

CREATE TABLE "town_basket_gifts" (
	"id" text PRIMARY KEY NOT NULL,
	"sender_profile_id" text NOT NULL,
	"recipient_profile_id" text NOT NULL,
	"decoration" text NOT NULL,
	"message" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone,
	CONSTRAINT "town_basket_not_self" CHECK ("town_basket_gifts"."sender_profile_id" <> "town_basket_gifts"."recipient_profile_id"),
	CONSTRAINT "town_basket_decoration" CHECK ("town_basket_gifts"."decoration" IN ('flowers','balloons','gnome')),
	CONSTRAINT "town_basket_message" CHECK ("town_basket_gifts"."message" BETWEEN 0 AND 9),
	CONSTRAINT "town_basket_opened" CHECK ("town_basket_gifts"."opened_at" IS NULL OR "town_basket_gifts"."opened_at" >= "town_basket_gifts"."created_at")
);

ALTER TABLE "town_basket_gifts" ADD CONSTRAINT "town_basket_gifts_sender_profile_id_profiles_id_fk" FOREIGN KEY ("sender_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "town_basket_gifts" ADD CONSTRAINT "town_basket_gifts_recipient_profile_id_profiles_id_fk" FOREIGN KEY ("recipient_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "town_basket_inbox" ON "town_basket_gifts" USING btree ("recipient_profile_id","opened_at","created_at");
CREATE INDEX "town_basket_pair" ON "town_basket_gifts" USING btree ("sender_profile_id","recipient_profile_id","created_at");
CREATE UNIQUE INDEX "town_basket_pending_pair" ON "town_basket_gifts" USING btree ("sender_profile_id","recipient_profile_id") WHERE "town_basket_gifts"."opened_at" IS NULL;

  INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('bb1d02ac275f7c75a775496f5b047291bf25f90cba2c0b35ebdc1687cee54615', 1792741755195);
END;
$river_migration$;
COMMIT;
