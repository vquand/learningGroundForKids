CREATE TABLE "lesson_audiences" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"target_family_id" text,
	"target_profile_id" text,
	"granted_by_family_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_audiences_target_required" CHECK ("lesson_audiences"."target_family_id" IS NOT NULL OR "lesson_audiences"."target_profile_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "lesson_audiences" ADD CONSTRAINT "lesson_audiences_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_audiences" ADD CONSTRAINT "lesson_audiences_target_family_id_families_id_fk" FOREIGN KEY ("target_family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_audiences" ADD CONSTRAINT "lesson_audiences_target_profile_id_profiles_id_fk" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_audiences" ADD CONSTRAINT "lesson_audiences_granted_by_family_id_families_id_fk" FOREIGN KEY ("granted_by_family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_audiences_item_family_unique" ON "lesson_audiences" USING btree ("item_id","target_family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_audiences_item_profile_unique" ON "lesson_audiences" USING btree ("item_id","target_profile_id");--> statement-breakpoint
CREATE INDEX "lesson_audiences_target_family_idx" ON "lesson_audiences" USING btree ("target_family_id","created_at");--> statement-breakpoint
CREATE INDEX "lesson_audiences_target_profile_idx" ON "lesson_audiences" USING btree ("target_profile_id","created_at");