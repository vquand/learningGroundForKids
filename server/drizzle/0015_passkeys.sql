ALTER TABLE "sessions" ADD COLUMN "parent_verified_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "parent_verified_by" text;--> statement-breakpoint
CREATE TABLE "passkeys" (
  "id" text PRIMARY KEY NOT NULL,
  "family_id" text NOT NULL REFERENCES "families"("id") ON DELETE CASCADE,
  "public_key" text NOT NULL,
  "counter" bigint DEFAULT 0 NOT NULL,
  "transports" jsonb,
  "device_type" text NOT NULL,
  "backed_up" boolean NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone
);--> statement-breakpoint
CREATE INDEX "idx_passkeys_family_created" ON "passkeys" ("family_id", "created_at");--> statement-breakpoint
CREATE TABLE "passkey_challenges" (
  "token_hash" text PRIMARY KEY NOT NULL,
  "challenge" text NOT NULL,
  "purpose" text NOT NULL,
  "session_hash" text,
  "family_id" text REFERENCES "families"("id") ON DELETE CASCADE,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "idx_passkey_challenges_expiry" ON "passkey_challenges" ("expires_at");
