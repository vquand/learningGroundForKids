-- Fishing Friends: migration 0026 only.
-- Prerequisite: migrations through 0025_explore_snapshots already applied.
-- Paste this ENTIRE file into the target Neon branch/database SQL Editor.
-- Run before deploying the new API/frontend, with no migration runner in parallel.
-- A repeated run with the matching recorded migration is a no-op.
-- Any error aborts the transaction: run ROLLBACK before retrying in that session.
-- Existing accounts, achievements and player progress are preserved.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $fishing_migration$
DECLARE recorded_hash text;
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'Apply existing migrations through 0025 before running Fishing Friends migration 0026';
  END IF;
  LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
  SELECT hash INTO recorded_hash FROM drizzle.__drizzle_migrations
    WHERE created_at = 1792412946341;
  IF FOUND THEN
    IF recorded_hash <> '33d86c411ed65985e115305b3113973960806926d2628f1d073be0c22073cca3' THEN
      RAISE EXCEPTION 'Migration 0026 is recorded with a different hash; inspect migration history before proceeding';
    END IF;
    RAISE NOTICE 'Fishing Friends migration 0026 is already applied; no changes made';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE created_at = 1792338725622 AND hash = '69f408d94c75be071eb80fdc3cfd94898bd8c26a95a08edd5bc02a6ba7af197a') THEN
    RAISE EXCEPTION 'Required migration 0025_explore_snapshots is missing or its hash differs';
  END IF;
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at > 1792412946341) THEN
    RAISE EXCEPTION 'A later migration is recorded without 0026; inspect migration history before proceeding';
  END IF;

CREATE TABLE "fishing_cast_results" (
	"profile_id" text NOT NULL,
	"cast_id" text NOT NULL,
	"location" text NOT NULL,
	"fish_id" text,
	"stamina" integer NOT NULL,
	"points" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fishing_cast_results_profile_id_cast_id_pk" PRIMARY KEY("profile_id","cast_id")
);

CREATE TABLE "fishing_progress" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "fishing_cast_results" ADD CONSTRAINT "fishing_cast_results_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "fishing_progress" ADD CONSTRAINT "fishing_progress_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;

  -- Exact SHA-256 of server/drizzle/0026_fishing_friends.sql, including
  -- its statement-breakpoint comments. Drizzle uses this timestamp/hash pair.
  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES ('33d86c411ed65985e115305b3113973960806926d2628f1d073be0c22073cca3', 1792412946341);
END;
$fishing_migration$;
COMMIT;

-- Expected: both Fishing Friends tables and exactly one matching ledger entry.
SELECT to_regclass('public.fishing_progress') AS progress_table,
       to_regclass('public.fishing_cast_results') AS catch_history_table;
SELECT hash, created_at FROM drizzle.__drizzle_migrations
  WHERE created_at = 1792412946341;
