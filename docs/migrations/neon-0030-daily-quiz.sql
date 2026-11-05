-- Daily Quiz: migration 0030 only.
-- Prerequisite: migrations through 0029_town_river_sharing already applied.
-- Paste this ENTIRE file into the target Neon branch/database SQL Editor.
-- Run before deploying the new API/frontend, with no migration runner in parallel.
-- A repeated run with the matching recorded migration is a no-op.
-- Any error aborts the transaction: run ROLLBACK before retrying in that session.
-- Existing accounts, achievements and player progress are preserved.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $daily_quiz_migration$
DECLARE recorded_hash text;
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'Apply existing migrations through 0029 before running Daily Quiz migration 0030';
  END IF;
  LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
  SELECT hash INTO recorded_hash FROM drizzle.__drizzle_migrations
    WHERE created_at = 1792742944744;
  IF FOUND THEN
    IF recorded_hash <> 'd8164d1d9e1a172e8f6f4c4783cbd62305b2de8be01e6198afefca4823712e90' THEN
      RAISE EXCEPTION 'Migration 0030 is recorded with a different hash; inspect migration history before proceeding';
    END IF;
    RAISE NOTICE 'Daily Quiz migration 0030 is already applied; no changes made';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE created_at = 1792742943744 AND hash = '50066d0934dc44f30bfc8bbefe209cf56a18e2e752cd86e0ceb8af56fcb73b5a') THEN
    RAISE EXCEPTION 'Required migration 0029_town_river_sharing is missing or its hash differs';
  END IF;
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at > 1792742944744) THEN
    RAISE EXCEPTION 'A later migration is recorded without 0030; inspect migration history before proceeding';
  END IF;

CREATE TABLE "daily_quiz_progress" (
  "profile_id" text PRIMARY KEY NOT NULL,
  "state" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "daily_quiz_progress_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE
);

  -- Exact SHA-256 and journal timestamp of server/drizzle/0030_daily_quiz.sql.
  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES ('d8164d1d9e1a172e8f6f4c4783cbd62305b2de8be01e6198afefca4823712e90', 1792742944744);
END;
$daily_quiz_migration$;
COMMIT;

-- Expected: the Daily Quiz table and exactly one matching ledger entry.
SELECT to_regclass('public.daily_quiz_progress') AS progress_table;
SELECT hash, created_at FROM drizzle.__drizzle_migrations
  WHERE created_at = 1792742944744;
