-- Kid profile tour: migration 0037 only.
-- Prerequisite: migrations through 0036_calendar_people already applied.
-- Paste the ENTIRE file into Neon SQL Editor and run it in one session.
-- Do not run another migration runner in parallel.
-- Adds profiles.tour_completed_at (nullable; NULL = the Playground guide has not been completed). Existing rows stay NULL so every existing profile sees the guide once.
-- A repeated matching run is a no-op. Any error aborts; run ROLLBACK before retrying.
-- Rollback (only after the server code is reverted): ALTER TABLE "profiles" DROP COLUMN "tour_completed_at";
--   then DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1793726409591;
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
DO $profile_tour_migration$
DECLARE recorded_hash text;
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'Apply existing migrations through 0036 before running migration 0037';
  END IF;
  LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
  SELECT hash INTO recorded_hash FROM drizzle.__drizzle_migrations
    WHERE created_at = 1793726409591;
  IF FOUND THEN
    IF recorded_hash <> '2ffe52e3c91579697aae618654425b4703a4041d58526fa225c76e2fe3064e92' THEN
      RAISE EXCEPTION 'Migration 0037 is recorded with a different hash; inspect migration history';
    END IF;
    RAISE NOTICE 'Kid profile tour migration 0037 is already applied; no changes made';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE created_at = 1793523568207 AND hash = '3ddca80aadc0d0926692f998cd4a00dbe7a589882e43ef51b566050ffc0890ae') THEN
    RAISE EXCEPTION 'Required migration 0036_calendar_people is missing or its hash differs';
  END IF;
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at > 1793726409591) THEN
    RAISE EXCEPTION 'A later migration is recorded without 0037; inspect migration history';
  END IF;


ALTER TABLE "profiles" ADD COLUMN "tour_completed_at" timestamp with time zone;

  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES ('2ffe52e3c91579697aae618654425b4703a4041d58526fa225c76e2fe3064e92', 1793726409591);
END;
$profile_tour_migration$;
COMMIT;
SELECT hash, created_at FROM drizzle.__drizzle_migrations
  WHERE created_at = 1793726409591;
SELECT column_name, data_type, is_nullable FROM information_schema.columns
  WHERE table_name = 'profiles' AND column_name = 'tour_completed_at';
