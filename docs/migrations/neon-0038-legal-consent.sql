-- Legal consent: migration 0038 only. Prerequisite: migrations through 0037_profile_tour.
-- Paste the ENTIRE file into Neon SQL Editor and run it in one session.
-- Do not run another migration runner in parallel. No account backfill: existing rows stay NULL.
-- OAuth state holds signup consent server-side; existing login/parent transactions remain usable.
-- A repeated matching run is a no-op. Any error aborts; run ROLLBACK before retrying.
-- Rollback ONLY after reverting server code (discards pending signup transactions):
-- DELETE FROM "google_auth_transactions" WHERE "purpose" = 'signup';
-- ALTER TABLE "google_auth_transactions" DROP CONSTRAINT "google_auth_transactions_purpose";
-- ALTER TABLE "google_auth_transactions" ADD CONSTRAINT "google_auth_transactions_purpose" CHECK ("google_auth_transactions"."purpose" IN ('login','parent'));
-- ALTER TABLE "google_auth_transactions" DROP COLUMN "legal_version";
-- ALTER TABLE "families" DROP COLUMN "legal_accepted_version";
-- ALTER TABLE "families" DROP COLUMN "legal_accepted_at";
-- DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1793750400000;
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
DO $legal_consent_migration$
DECLARE recorded_hash text;
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'Apply existing migrations through 0037 before running migration 0038';
  END IF;
  LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
  SELECT hash INTO recorded_hash FROM drizzle.__drizzle_migrations
    WHERE created_at = 1793750400000;
  IF FOUND THEN
    IF recorded_hash <> '17b140066038c585f3901d57ec016bf432eb502c202a8e56b1da637f91518f6b' THEN
      RAISE EXCEPTION 'Migration 0038 is recorded with a different hash; inspect migration history';
    END IF;
    RAISE NOTICE 'Legal consent migration 0038 is already applied; no changes made';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE created_at = 1793726409591 AND hash = '2ffe52e3c91579697aae618654425b4703a4041d58526fa225c76e2fe3064e92') THEN
    RAISE EXCEPTION 'Required migration 0037_profile_tour is missing or its hash differs';
  END IF;
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at > 1793750400000) THEN
    RAISE EXCEPTION 'A later migration is recorded without 0038; inspect migration history';
  END IF;


ALTER TABLE "families" ADD COLUMN IF NOT EXISTS "legal_accepted_at" timestamp with time zone;
ALTER TABLE "families" ADD COLUMN IF NOT EXISTS "legal_accepted_version" text;
ALTER TABLE "google_auth_transactions" ADD COLUMN IF NOT EXISTS "legal_version" text;
ALTER TABLE "google_auth_transactions" DROP CONSTRAINT "google_auth_transactions_purpose";
ALTER TABLE "google_auth_transactions" ADD CONSTRAINT "google_auth_transactions_purpose" CHECK ("google_auth_transactions"."purpose" IN ('login','parent','signup'));


  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES ('17b140066038c585f3901d57ec016bf432eb502c202a8e56b1da637f91518f6b', 1793750400000);
END;
$legal_consent_migration$;
COMMIT;
SELECT hash, created_at FROM drizzle.__drizzle_migrations
  WHERE created_at = 1793750400000;
SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
  WHERE (table_name = 'families' AND column_name IN ('legal_accepted_at', 'legal_accepted_version'))
     OR (table_name = 'google_auth_transactions' AND column_name = 'legal_version');
