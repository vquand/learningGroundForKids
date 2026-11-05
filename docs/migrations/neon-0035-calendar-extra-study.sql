-- Calendar extra study period: migration 0035 only.
-- Prerequisite: migrations through 0034_calendar_custom_items already applied.
-- Paste the ENTIRE file into Neon SQL Editor and run it in one session.
-- Do not run another migration runner in parallel.
-- Replaces the calendar_plan_lists area CHECK so it also accepts study_extra (existing rows are re-validated and already satisfy it).
-- A repeated matching run is a no-op. Any error aborts; run ROLLBACK before retrying.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
DO $calendar_extra_study_migration$
DECLARE recorded_hash text;
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'Apply existing migrations through 0034 before running migration 0035';
  END IF;
  LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
  SELECT hash INTO recorded_hash FROM drizzle.__drizzle_migrations
    WHERE created_at = 1793494800000;
  IF FOUND THEN
    IF recorded_hash <> '530734a5fa79d8f1f4bb666fedfdeda9d66f51bde280aebc9e7e4898f60c8998' THEN
      RAISE EXCEPTION 'Migration 0035 is recorded with a different hash; inspect migration history';
    END IF;
    RAISE NOTICE 'Calendar extra study period migration 0035 is already applied; no changes made';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE created_at = 1793332800000 AND hash = '10876719254627a4382bbc45edcc95a8efdae3fe07c9d126ceae079a58be5209') THEN
    RAISE EXCEPTION 'Required migration 0034_calendar_custom_items is missing or its hash differs';
  END IF;
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at > 1793494800000) THEN
    RAISE EXCEPTION 'A later migration is recorded without 0035; inspect migration history';
  END IF;


ALTER TABLE "calendar_plan_lists" DROP CONSTRAINT "calendar_plan_lists_area";

ALTER TABLE "calendar_plan_lists" ADD CONSTRAINT "calendar_plan_lists_area" CHECK ("calendar_plan_lists"."area" IN ('study_morning','study_afternoon','study_extra','meal_breakfast','meal_lunch','meal_snack','meal_dinner','medicine'));

  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES ('530734a5fa79d8f1f4bb666fedfdeda9d66f51bde280aebc9e7e4898f60c8998', 1793494800000);
END;
$calendar_extra_study_migration$;
COMMIT;
SELECT hash, created_at FROM drizzle.__drizzle_migrations
  WHERE created_at = 1793494800000;
