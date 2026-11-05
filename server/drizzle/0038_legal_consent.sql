ALTER TABLE "families" ADD COLUMN "legal_accepted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "legal_accepted_version" text;
--> statement-breakpoint
ALTER TABLE "google_auth_transactions" ADD COLUMN "legal_version" text;
--> statement-breakpoint
ALTER TABLE "google_auth_transactions" DROP CONSTRAINT "google_auth_transactions_purpose";
--> statement-breakpoint
ALTER TABLE "google_auth_transactions" ADD CONSTRAINT "google_auth_transactions_purpose" CHECK ("google_auth_transactions"."purpose" IN ('login','parent','signup'));
