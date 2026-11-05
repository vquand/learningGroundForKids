-- Kid adventure schedule: migration 0039 only.
-- Prerequisite: migrations through 0038_legal_consent already applied.
-- Paste the ENTIRE file into Neon SQL Editor and run it in one session.
-- Do not run another migration runner in parallel.
-- Adds profile_schedules, profile_schedule_slots and profile_schedule_events (parental-control weekly time slots).
-- Features are off by default: no existing profile is restricted until a parent turns a schedule on.
-- A repeated matching run is a no-op. Any error aborts; run ROLLBACK before retrying.
-- Rollback (only after the server code is reverted): DROP TABLE IF EXISTS profile_schedule_events; DROP TABLE IF EXISTS profile_schedule_slots; DROP TABLE IF EXISTS profile_schedules;
--   then DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1793799145748;
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
DO $kid_schedule_migration$
DECLARE recorded_hash text;
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'Apply existing migrations through 0038 before running migration 0039';
  END IF;
  LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
  SELECT hash INTO recorded_hash FROM drizzle.__drizzle_migrations
    WHERE created_at = 1793799145748;
  IF FOUND THEN
    IF recorded_hash <> 'cef5361c45b1c0db8f7f3833365dffa3d42decd000fcd10429b189aeaad10f9b' THEN
      RAISE EXCEPTION 'Migration 0039 is recorded with a different hash; inspect migration history';
    END IF;
    RAISE NOTICE 'Kid adventure schedule migration 0039 is already applied; no changes made';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE created_at = 1793750400000 AND hash = '17b140066038c585f3901d57ec016bf432eb502c202a8e56b1da637f91518f6b') THEN
    RAISE EXCEPTION 'Required migration 0038_legal_consent is missing or its hash differs';
  END IF;
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at > 1793799145748) THEN
    RAISE EXCEPTION 'A later migration is recorded without 0039; inspect migration history';
  END IF;


CREATE TABLE "profile_schedule_events" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"from_timezone" text,
	"to_timezone" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "profile_schedule_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	CONSTRAINT "profile_schedule_slots_range" CHECK ("profile_schedule_slots"."weekday" BETWEEN 1 AND 7 AND "profile_schedule_slots"."start_minute" >= 0 AND "profile_schedule_slots"."start_minute" < "profile_schedule_slots"."end_minute" AND "profile_schedule_slots"."end_minute" <= 1440 AND "profile_schedule_slots"."start_minute" % 30 = 0 AND "profile_schedule_slots"."end_minute" % 30 = 0)
);
CREATE TABLE "profile_schedules" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"current_timezone" text,
	"timezone_changed_at" timestamp with time zone,
	"timezone_change_day" date,
	"timezone_changes_today" integer DEFAULT 0 NOT NULL
);
ALTER TABLE "profile_schedule_events" ADD CONSTRAINT "profile_schedule_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "profile_schedule_slots" ADD CONSTRAINT "profile_schedule_slots_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "profile_schedules" ADD CONSTRAINT "profile_schedules_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "idx_profile_schedule_events_profile_at" ON "profile_schedule_events" USING btree ("profile_id","at");
CREATE UNIQUE INDEX "profile_schedule_slots_start_unique" ON "profile_schedule_slots" USING btree ("profile_id","weekday","start_minute");

  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES ('cef5361c45b1c0db8f7f3833365dffa3d42decd000fcd10429b189aeaad10f9b', 1793799145748);
END;
$kid_schedule_migration$;
COMMIT;
SELECT hash, created_at FROM drizzle.__drizzle_migrations
  WHERE created_at = 1793799145748;
SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE 'profile_schedule%' ORDER BY table_name;
