CREATE TABLE "google_auth_transactions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"verifier" text NOT NULL,
	"purpose" text NOT NULL,
	"family_id" text,
	"session_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "google_auth_transactions_purpose" CHECK ("google_auth_transactions"."purpose" IN ('login','parent'))
);
--> statement-breakpoint
CREATE TABLE "google_identities" (
	"subject" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "google_auth_transactions" ADD CONSTRAINT "google_auth_transactions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_identities" ADD CONSTRAINT "google_identities_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "google_auth_transactions_expiry" ON "google_auth_transactions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "google_identities_family_unique" ON "google_identities" USING btree ("family_id");