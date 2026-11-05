-- Revert server code before rolling back; pending signups are intentionally discarded.
DELETE FROM "google_auth_transactions" WHERE "purpose" = 'signup';
ALTER TABLE "google_auth_transactions" DROP CONSTRAINT "google_auth_transactions_purpose";
ALTER TABLE "google_auth_transactions" ADD CONSTRAINT "google_auth_transactions_purpose" CHECK ("google_auth_transactions"."purpose" IN ('login','parent'));
ALTER TABLE "google_auth_transactions" DROP COLUMN "legal_version";
ALTER TABLE "families" DROP COLUMN "legal_accepted_version";
ALTER TABLE "families" DROP COLUMN "legal_accepted_at";
