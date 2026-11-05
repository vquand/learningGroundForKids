-- Road Racing: migration 0027 only.
-- Prerequisite: migrations through 0026_fishing_friends already applied.
-- Paste this ENTIRE file into the target Neon branch/database SQL Editor.
-- Run before deploying the new API/frontend, with no migration runner in parallel.
-- A repeated run with the matching recorded migration is a no-op.
-- Any error aborts the transaction: run ROLLBACK before retrying in that session.
-- Existing accounts, achievements and player progress are preserved.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $road_racing_migration$
DECLARE recorded_hash text;
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'Apply existing migrations through 0026 before running Road Racing migration 0027';
  END IF;
  LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
  SELECT hash INTO recorded_hash FROM drizzle.__drizzle_migrations
    WHERE created_at = 1792519346341;
  IF FOUND THEN
    IF recorded_hash <> '99320c3c8d27f21b3c9bade87b00bd89da7eb463b274ae84c7e9c50732f6e5b9' THEN
      RAISE EXCEPTION 'Migration 0027 is recorded with a different hash; inspect migration history before proceeding';
    END IF;
    RAISE NOTICE 'Road Racing migration 0027 is already applied; no changes made';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE created_at = 1792412946341 AND hash = '33d86c411ed65985e115305b3113973960806926d2628f1d073be0c22073cca3') THEN
    RAISE EXCEPTION 'Required migration 0026_fishing_friends is missing or its hash differs';
  END IF;
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at > 1792519346341) THEN
    RAISE EXCEPTION 'A later migration is recorded without 0027; inspect migration history before proceeding';
  END IF;

CREATE TABLE "road_racing_progress" (
  "profile_id" text PRIMARY KEY NOT NULL,
  "state" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "road_racing_progress_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE
);

  -- Exact SHA-256 and journal timestamp of server/drizzle/0027_road_racing.sql.
  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES ('99320c3c8d27f21b3c9bade87b00bd89da7eb463b274ae84c7e9c50732f6e5b9', 1792519346341);
END;
$road_racing_migration$;
COMMIT;

-- Expected: the Road Racing table and exactly one matching ledger entry.
SELECT to_regclass('public.road_racing_progress') AS progress_table;
SELECT hash, created_at FROM drizzle.__drizzle_migrations
  WHERE created_at = 1792519346341;
