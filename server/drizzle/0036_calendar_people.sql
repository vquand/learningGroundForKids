CREATE TABLE "calendar_family_settings" (
	"family_id" text PRIMARY KEY NOT NULL,
	"disabled_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "calendar_family_settings_revision" CHECK ("calendar_family_settings"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "calendar_family_settings" ADD CONSTRAINT "calendar_family_settings_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;