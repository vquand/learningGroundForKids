CREATE TABLE "family_disabled_lessons" (
	"family_id" text NOT NULL,
	"item_id" text NOT NULL,
	"disabled_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_disabled_lessons_family_id_item_id_pk" PRIMARY KEY("family_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "family_disabled_lessons" ADD CONSTRAINT "family_disabled_lessons_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_disabled_lessons" ADD CONSTRAINT "family_disabled_lessons_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;