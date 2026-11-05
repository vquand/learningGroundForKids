-- Kid Calendar: migration 0033 only (three new tables; no existing rows change).
-- Prerequisite: migrations through 0032_river_eggs_catch_index already applied.
-- Run the ENTIRE file in one session, with no migration runner in parallel.
-- Creates calendar_plan_lists, calendar_meal_library and calendar_events (all cascade-delete with their profile).
-- A repeated matching run is a no-op. Any error aborts; run ROLLBACK before retrying.
-- Roll back with server/drizzle/rollbacks/0033_kid_calendar.sql (drops the three tables and their data).
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
DO $kid_calendar_migration$
DECLARE recorded_hash text;
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'Apply existing migrations through 0032 before running migration 0033';
  END IF;
  LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
  SELECT hash INTO recorded_hash FROM drizzle.__drizzle_migrations
    WHERE created_at = 1793260647838;
  IF FOUND THEN
    IF recorded_hash <> 'fe3e2e3234bb2a700f44ddc1993d65c6b3e2dfc1fc886cb1c0a77025173a6e81' THEN
      RAISE EXCEPTION 'Migration 0033 is recorded with a different hash; inspect migration history';
    END IF;
    RAISE NOTICE 'Kid Calendar migration 0033 is already applied; no changes made';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE created_at = 1792915744744 AND hash = 'b16931069fc0de39e08fd71d3b4e7443364de75da4d3d5410233f450706f8d7f') THEN
    RAISE EXCEPTION 'Required migration 0032_river_eggs_catch_index is missing or its hash differs';
  END IF;
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at > 1793260647838) THEN
    RAISE EXCEPTION 'A later migration is recorded without 0033; inspect migration history';
  END IF;

CREATE TABLE "calendar_events" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"title" text NOT NULL,
	"icon_key" text NOT NULL,
	"start_date" date NOT NULL,
	"repeat" text DEFAULT 'none' NOT NULL,
	"repeat_ended_on" date,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_events_repeat" CHECK ("calendar_events"."repeat" IN ('none','weekly','monthly','yearly')),
	CONSTRAINT "calendar_events_revision" CHECK ("calendar_events"."revision" >= 1)
);

CREATE TABLE "calendar_meal_library" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"food_key" text NOT NULL,
	"custom_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "calendar_plan_lists" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"scope" text NOT NULL,
	"weekday" integer,
	"local_date" date,
	"area" text NOT NULL,
	"items" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_plan_lists_scope_shape" CHECK (("calendar_plan_lists"."scope" = 'template' AND "calendar_plan_lists"."weekday" IS NOT NULL AND "calendar_plan_lists"."weekday" BETWEEN 1 AND 7 AND "calendar_plan_lists"."local_date" IS NULL) OR ("calendar_plan_lists"."scope" = 'date' AND "calendar_plan_lists"."weekday" IS NULL AND "calendar_plan_lists"."local_date" IS NOT NULL)),
	CONSTRAINT "calendar_plan_lists_area" CHECK ("calendar_plan_lists"."area" IN ('study_morning','study_afternoon','meal_breakfast','meal_lunch','meal_snack','meal_dinner','medicine')),
	CONSTRAINT "calendar_plan_lists_revision" CHECK ("calendar_plan_lists"."revision" >= 1)
);

ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "calendar_meal_library" ADD CONSTRAINT "calendar_meal_library_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "calendar_plan_lists" ADD CONSTRAINT "calendar_plan_lists_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "calendar_events_profile_start" ON "calendar_events" USING btree ("profile_id","start_date");
CREATE UNIQUE INDEX "calendar_meal_library_unique" ON "calendar_meal_library" USING btree ("profile_id","food_key",coalesce("custom_name", ''));
CREATE UNIQUE INDEX "calendar_plan_lists_template_unique" ON "calendar_plan_lists" USING btree ("profile_id","weekday","area") WHERE "calendar_plan_lists"."scope" = 'template';
CREATE UNIQUE INDEX "calendar_plan_lists_date_unique" ON "calendar_plan_lists" USING btree ("profile_id","local_date","area") WHERE "calendar_plan_lists"."scope" = 'date';
CREATE INDEX "calendar_plan_lists_profile_date" ON "calendar_plan_lists" USING btree ("profile_id","local_date");

  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES ('fe3e2e3234bb2a700f44ddc1993d65c6b3e2dfc1fc886cb1c0a77025173a6e81', 1793260647838);
END;
$kid_calendar_migration$;
COMMIT;
SELECT hash, created_at FROM drizzle.__drizzle_migrations
  WHERE created_at = 1793260647838;
