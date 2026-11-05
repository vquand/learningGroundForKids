-- Friend takeaway raft eggs and fishing catch index: migration 0032 only.
-- Prerequisite: migrations through 0031_retire_placeholder_quizzes already applied.
-- Run the ENTIRE file in one session, with no migration runner in parallel.
-- Allows eggs as a third river-raft item kind and indexes fishing catches by fish; no rows change.
-- The index builds under a short write lock on fishing_cast_results.
-- A repeated matching run is a no-op. Any error aborts; run ROLLBACK before retrying.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
DO $river_eggs_catch_index_migration$
DECLARE recorded_hash text;
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'Apply existing migrations through 0031 before running migration 0032';
  END IF;
  LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
  SELECT hash INTO recorded_hash FROM drizzle.__drizzle_migrations
    WHERE created_at = 1792915744744;
  IF FOUND THEN
    IF recorded_hash <> 'b16931069fc0de39e08fd71d3b4e7443364de75da4d3d5410233f450706f8d7f' THEN
      RAISE EXCEPTION 'Migration 0032 is recorded with a different hash; inspect migration history';
    END IF;
    RAISE NOTICE 'River eggs and catch index migration 0032 is already applied; no changes made';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE created_at = 1792829344744 AND hash = 'a510a71b82c433e732cbc7aa7692e257e509feb6c2b2512492d2bcb20f722eb6') THEN
    RAISE EXCEPTION 'Required migration 0031_retire_placeholder_quizzes is missing or its hash differs';
  END IF;
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at > 1792915744744) THEN
    RAISE EXCEPTION 'A later migration is recorded without 0032; inspect migration history';
  END IF;

ALTER TABLE "town_raft_items" DROP CONSTRAINT "town_raft_kind";
ALTER TABLE "town_raft_items" ADD CONSTRAINT "town_raft_kind" CHECK ("town_raft_items"."kind" IN ('fish','vegetable','egg'));
CREATE INDEX "fishing_cast_profile_fish" ON "fishing_cast_results" USING btree ("profile_id","fish_id");

  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES ('b16931069fc0de39e08fd71d3b4e7443364de75da4d3d5410233f450706f8d7f', 1792915744744);
END;
$river_eggs_catch_index_migration$;
COMMIT;
SELECT hash, created_at FROM drizzle.__drizzle_migrations
  WHERE created_at = 1792915744744;
