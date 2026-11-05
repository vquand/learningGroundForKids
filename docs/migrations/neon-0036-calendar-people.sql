-- Calendar people settings: migration 0036 only.
-- Prerequisite: migrations through 0035_calendar_extra_study already applied.
-- Paste the ENTIRE file into Neon SQL Editor and run it in one session.
-- Do not run another migration runner in parallel.
-- Adds the per-family calendar_family_settings table (disabled roles + revision); preserves existing rows.
-- A repeated matching run is a no-op. Any error aborts; run ROLLBACK before retrying.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
DO $calendar_people_migration$
DECLARE recorded_hash text;
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'Apply existing migrations through 0035 before running migration 0036';
  END IF;
  LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
  SELECT hash INTO recorded_hash FROM drizzle.__drizzle_migrations
    WHERE created_at = 1793523568207;
  IF FOUND THEN
    IF recorded_hash <> '3ddca80aadc0d0926692f998cd4a00dbe7a589882e43ef51b566050ffc0890ae' THEN
      RAISE EXCEPTION 'Migration 0036 is recorded with a different hash; inspect migration history';
    END IF;
    RAISE NOTICE 'Calendar people settings migration 0036 is already applied; no changes made';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE created_at = 1793494800000 AND hash = '530734a5fa79d8f1f4bb666fedfdeda9d66f51bde280aebc9e7e4898f60c8998') THEN
    RAISE EXCEPTION 'Required migration 0035_calendar_extra_study is missing or its hash differs';
  END IF;
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at > 1793523568207) THEN
    RAISE EXCEPTION 'A later migration is recorded without 0036; inspect migration history';
  END IF;


CREATE TABLE "calendar_family_settings" (
	"family_id" text PRIMARY KEY NOT NULL,
	"disabled_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "calendar_family_settings_revision" CHECK ("calendar_family_settings"."revision" >= 1)
);

ALTER TABLE "calendar_family_settings" ADD CONSTRAINT "calendar_family_settings_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;

  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES ('3ddca80aadc0d0926692f998cd4a00dbe7a589882e43ef51b566050ffc0890ae', 1793523568207);
END;
$calendar_people_migration$;
COMMIT;
SELECT hash, created_at FROM drizzle.__drizzle_migrations
  WHERE created_at = 1793523568207;
