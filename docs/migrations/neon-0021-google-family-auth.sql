-- Google family login; prerequisites: migrations through 0020.
-- Repeat runs are safe after the migration is recorded.
BEGIN;
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id serial PRIMARY KEY, hash text NOT NULL, created_at bigint
);
DO $google_migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1791814759157) THEN
CREATE TABLE "google_auth_transactions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"verifier" text NOT NULL,
	"purpose" text NOT NULL,
	"family_id" text,
	"session_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "google_auth_transactions_purpose" CHECK ("google_auth_transactions"."purpose" IN ('login','parent'))
);

CREATE TABLE "google_identities" (
	"subject" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "google_auth_transactions" ADD CONSTRAINT "google_auth_transactions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "google_identities" ADD CONSTRAINT "google_identities_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "google_auth_transactions_expiry" ON "google_auth_transactions" USING btree ("expires_at");
CREATE UNIQUE INDEX "google_identities_family_unique" ON "google_identities" USING btree ("family_id");
    INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES ('aae6d22c32bffd681c466662831d30ec14f2f6bfd6a738324b804cde2683e140', 1791814759157);
  END IF;
END;
$google_migration$;
COMMIT;
