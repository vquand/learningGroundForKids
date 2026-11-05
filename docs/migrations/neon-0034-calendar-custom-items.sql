-- Calendar custom items: migration 0034 only.
-- Prerequisite: migrations through 0033_kid_calendar already applied.
-- Paste the ENTIRE file into Neon SQL Editor and run it in one session.
-- Do not run another migration runner in parallel.
-- Adds the subject library and event name history; preserves existing rows.
-- A repeated matching run is a no-op. Any error aborts; run ROLLBACK before retrying.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
DO $calendar_custom_items_migration$
DECLARE recorded_hash text;
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'Apply existing migrations through 0033 before running migration 0034';
  END IF;
  LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
  SELECT hash INTO recorded_hash FROM drizzle.__drizzle_migrations
    WHERE created_at = 1793332800000;
  IF FOUND THEN
    IF recorded_hash <> '10876719254627a4382bbc45edcc95a8efdae3fe07c9d126ceae079a58be5209' THEN
      RAISE EXCEPTION 'Migration 0034 is recorded with a different hash; inspect migration history';
    END IF;
    RAISE NOTICE 'Calendar custom items migration 0034 is already applied; no changes made';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE created_at = 1793260647838 AND hash = 'fe3e2e3234bb2a700f44ddc1993d65c6b3e2dfc1fc886cb1c0a77025173a6e81') THEN
    RAISE EXCEPTION 'Required migration 0033_kid_calendar is missing or its hash differs';
  END IF;
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at > 1793332800000) THEN
    RAISE EXCEPTION 'A later migration is recorded without 0034; inspect migration history';
  END IF;


CREATE TABLE "calendar_study_library" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"subject" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "calendar_events" ADD COLUMN "name_history" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "calendar_study_library" ADD CONSTRAINT "calendar_study_library_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "calendar_study_library_profile_id_subject_name_key" ON "calendar_study_library" USING btree ("profile_id","subject","name");

  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES ('10876719254627a4382bbc45edcc95a8efdae3fe07c9d126ceae079a58be5209', 1793332800000);
END;
$calendar_custom_items_migration$;
COMMIT;
SELECT hash, created_at FROM drizzle.__drizzle_migrations
  WHERE created_at = 1793332800000;
