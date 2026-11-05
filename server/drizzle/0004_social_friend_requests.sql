CREATE TABLE "friend_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"requesting_family_id" text NOT NULL,
	"requesting_scope" text NOT NULL,
	"requesting_profile_id" text,
	"requesting_label" text NOT NULL,
	"target_family_id" text NOT NULL,
	"target_scope" text NOT NULL,
	"target_profile_id" text,
	"target_label" text NOT NULL,
	"target_code" text NOT NULL,
	"requester_message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"responded_by_family_id" text,
	CONSTRAINT "friend_requests_requesting_scope_check" CHECK ("friend_requests"."requesting_scope" IN ('profile', 'family')),
	CONSTRAINT "friend_requests_target_scope_check" CHECK ("friend_requests"."target_scope" IN ('profile', 'family')),
	CONSTRAINT "friend_requests_status_check" CHECK ("friend_requests"."status" IN ('pending', 'accepted', 'rejected', 'cancelled')),
	CONSTRAINT "friend_requests_requesting_scope_shape" CHECK (("friend_requests"."requesting_scope" = 'profile' AND "friend_requests"."requesting_profile_id" IS NOT NULL) OR ("friend_requests"."requesting_scope" = 'family' AND "friend_requests"."requesting_profile_id" IS NULL)),
	CONSTRAINT "friend_requests_target_scope_shape" CHECK (("friend_requests"."target_scope" = 'profile' AND "friend_requests"."target_profile_id" IS NOT NULL) OR ("friend_requests"."target_scope" = 'family' AND "friend_requests"."target_profile_id" IS NULL)),
	CONSTRAINT "friend_requests_cross_family" CHECK ("friend_requests"."requesting_family_id" <> "friend_requests"."target_family_id"),
	CONSTRAINT "friend_requests_target_code_length" CHECK (char_length("friend_requests"."target_code") BETWEEN 1 AND 64),
	CONSTRAINT "friend_requests_label_length" CHECK (char_length("friend_requests"."requesting_label") BETWEEN 1 AND 160 AND char_length("friend_requests"."target_label") BETWEEN 1 AND 160),
	CONSTRAINT "friend_requests_message_length" CHECK (char_length("friend_requests"."requester_message") BETWEEN 1 AND 500)
);
--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_requesting_family_id_families_id_fk" FOREIGN KEY ("requesting_family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_requesting_profile_id_profiles_id_fk" FOREIGN KEY ("requesting_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_target_family_id_families_id_fk" FOREIGN KEY ("target_family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_target_profile_id_profiles_id_fk" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_responded_by_family_id_families_id_fk" FOREIGN KEY ("responded_by_family_id") REFERENCES "public"."families"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friend_requests_pending_unique" ON "friend_requests" USING btree ("requesting_family_id", coalesce("requesting_profile_id", ''), "requesting_scope", "target_family_id", coalesce("target_profile_id", ''), "target_scope") WHERE "friend_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "friend_requests_participant_idx" ON "friend_requests" USING btree ("target_family_id","status","created_at");--> statement-breakpoint
CREATE INDEX "friend_requests_requester_idx" ON "friend_requests" USING btree ("requesting_family_id","status","created_at");