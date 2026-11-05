CREATE TABLE "family_password_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_family_id" text NOT NULL,
	"target_family_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "family_password_audit" ADD CONSTRAINT "family_password_audit_actor_family_id_families_id_fk" FOREIGN KEY ("actor_family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_password_audit" ADD CONSTRAINT "family_password_audit_target_family_id_families_id_fk" FOREIGN KEY ("target_family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_family_password_audit_target_created" ON "family_password_audit" USING btree ("target_family_id","created_at");