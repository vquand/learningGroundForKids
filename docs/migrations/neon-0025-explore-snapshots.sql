-- Explore catalog and prepared map snapshots: migration 0025 only.
-- Prerequisite: migrations through 0024_child_adventures already applied.
-- Paste this ENTIRE file into the target Neon branch/database SQL Editor.
-- Run before deploying the new API/frontend, with no migration runner in parallel.
-- A repeated run with the matching recorded migration is a no-op.
-- Any error aborts the transaction: run ROLLBACK before retrying in that session.
-- No accounts, lessons, progress or achievements are deleted or backfilled.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $explore_migration$
DECLARE recorded_hash text;
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'Apply existing migrations through 0024 before running Explore migration 0025';
  END IF;
  LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
  SELECT hash INTO recorded_hash FROM drizzle.__drizzle_migrations
    WHERE created_at = 1792338725622;
  IF FOUND THEN
    IF recorded_hash <> '69f408d94c75be071eb80fdc3cfd94898bd8c26a95a08edd5bc02a6ba7af197a' THEN
      RAISE EXCEPTION 'Migration 0025 is recorded with a different hash; inspect migration history before proceeding';
    END IF;
    RAISE NOTICE 'Explore migration 0025 is already applied; no changes made';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE created_at = 1792225577588 AND hash = '3f613fa381abc718be90ef065462cf71d6885a2e25577d95b88b427a5815aa4f') THEN
    RAISE EXCEPTION 'Required migration 0024_child_adventures is missing or its hash differs';
  END IF;
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at > 1792338725622) THEN
    RAISE EXCEPTION 'A later migration is recorded without 0025; inspect migration history before proceeding';
  END IF;

CREATE TABLE "explore_rebuild_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"owner" text NOT NULL,
	"fence" integer DEFAULT 1 NOT NULL,
	"state" text NOT NULL,
	"lease_until" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "explore_jobs_shape" CHECK ("explore_rebuild_jobs"."kind" IN ('common','view') AND "explore_rebuild_jobs"."state" IN ('running','ready','failed') AND "explore_rebuild_jobs"."fence" BETWEEN 1 AND 3 AND char_length("explore_rebuild_jobs"."id") = 64)
);

CREATE TABLE "explore_revisions" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"catalog_revision" bigint DEFAULT 1 NOT NULL,
	"visibility_revision" bigint DEFAULT 1 NOT NULL,
	CONSTRAINT "explore_revisions_singleton" CHECK ("explore_revisions"."id" = 1)
);

CREATE TABLE "explore_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"catalog_revision" bigint NOT NULL,
	"visibility_revision" bigint,
	"payload" jsonb NOT NULL,
	"payload_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "explore_snapshots_shape" CHECK ("explore_snapshots"."kind" IN ('common','view') AND char_length("explore_snapshots"."id") = 64 AND ("explore_snapshots"."kind" = 'common') = ("explore_snapshots"."visibility_revision" IS NULL)),
	CONSTRAINT "explore_snapshots_size" CHECK ("explore_snapshots"."payload_bytes" BETWEEN 1 AND 8388608)
);

CREATE INDEX "idx_explore_jobs_state_lease" ON "explore_rebuild_jobs" USING btree ("state","lease_until");
CREATE INDEX "idx_explore_snapshots_kind_created" ON "explore_snapshots" USING btree ("kind","created_at");

INSERT INTO explore_revisions (id) VALUES (1);

-- Database-owned revisions cover API, ingestion and raw SQL writes. The
-- revision changes commit/roll back with the source mutation.
CREATE FUNCTION explore_invalidate_catalog() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  new_row jsonb := '{}'::jsonb;
  old_row jsonb := '{}'::jsonb;
  common_changed boolean := false;
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    common_changed := TG_TABLE_NAME IN ('items', 'item_translations', 'quiz_questions');
  ELSE
    IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
    IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
    IF TG_TABLE_NAME = 'items' THEN
      common_changed := coalesce(
        (new_row->>'source_type' = 'system' AND new_row->>'owner_family_id' IS NULL) OR
        (old_row->>'source_type' = 'system' AND old_row->>'owner_family_id' IS NULL), false);
    ELSIF TG_TABLE_NAME IN ('item_translations', 'quiz_questions') THEN
      SELECT EXISTS (SELECT 1 FROM items WHERE id IN (new_row->>'item_id', old_row->>'item_id')
        AND source_type = 'system' AND owner_family_id IS NULL) INTO common_changed;
    END IF;
  END IF;
  UPDATE explore_revisions SET
    catalog_revision = catalog_revision + CASE WHEN common_changed THEN 1 ELSE 0 END,
    visibility_revision = visibility_revision + 1 WHERE id = 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Explore revision state is missing'; END IF;
  RETURN NULL;
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['items','item_translations','quiz_questions','lesson_audiences','family_disabled_lessons'] LOOP
    EXECUTE format('CREATE TRIGGER explore_catalog_revision AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION explore_invalidate_catalog()', table_name);
    EXECUTE format('CREATE TRIGGER explore_catalog_truncate AFTER TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION explore_invalidate_catalog()', table_name);
  END LOOP;
END;
$$;

  -- Exact SHA-256 of server/drizzle/0025_explore_snapshots.sql, including
  -- its statement-breakpoint comments. Drizzle uses this timestamp/hash pair.
  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES ('69f408d94c75be071eb80fdc3cfd94898bd8c26a95a08edd5bc02a6ba7af197a', 1792338725622);
END;
$explore_migration$;
COMMIT;

-- Expected: one revision row, both cache/job tables, and the recorded hash.
SELECT id, catalog_revision, visibility_revision FROM public.explore_revisions;
SELECT to_regclass('public.explore_snapshots') AS snapshots_table,
       to_regclass('public.explore_rebuild_jobs') AS jobs_table;
SELECT hash, created_at FROM drizzle.__drizzle_migrations
  WHERE created_at = 1792338725622;
