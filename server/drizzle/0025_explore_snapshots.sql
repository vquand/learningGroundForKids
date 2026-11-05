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
--> statement-breakpoint
CREATE TABLE "explore_revisions" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"catalog_revision" bigint DEFAULT 1 NOT NULL,
	"visibility_revision" bigint DEFAULT 1 NOT NULL,
	CONSTRAINT "explore_revisions_singleton" CHECK ("explore_revisions"."id" = 1)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX "idx_explore_jobs_state_lease" ON "explore_rebuild_jobs" USING btree ("state","lease_until");--> statement-breakpoint
CREATE INDEX "idx_explore_snapshots_kind_created" ON "explore_snapshots" USING btree ("kind","created_at");
--> statement-breakpoint
INSERT INTO explore_revisions (id) VALUES (1);
--> statement-breakpoint
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
--> statement-breakpoint
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['items','item_translations','quiz_questions','lesson_audiences','family_disabled_lessons'] LOOP
    EXECUTE format('CREATE TRIGGER explore_catalog_revision AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION explore_invalidate_catalog()', table_name);
    EXECUTE format('CREATE TRIGGER explore_catalog_truncate AFTER TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION explore_invalidate_catalog()', table_name);
  END LOOP;
END;
$$;
