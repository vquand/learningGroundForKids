CREATE TABLE "town_basket_gifts" (
	"id" text PRIMARY KEY NOT NULL,
	"sender_profile_id" text NOT NULL,
	"recipient_profile_id" text NOT NULL,
	"decoration" text NOT NULL,
	"message" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone,
	CONSTRAINT "town_basket_not_self" CHECK ("town_basket_gifts"."sender_profile_id" <> "town_basket_gifts"."recipient_profile_id"),
	CONSTRAINT "town_basket_decoration" CHECK ("town_basket_gifts"."decoration" IN ('flowers','balloons','gnome')),
	CONSTRAINT "town_basket_message" CHECK ("town_basket_gifts"."message" BETWEEN 0 AND 9),
	CONSTRAINT "town_basket_opened" CHECK ("town_basket_gifts"."opened_at" IS NULL OR "town_basket_gifts"."opened_at" >= "town_basket_gifts"."created_at")
);
--> statement-breakpoint
ALTER TABLE "town_basket_gifts" ADD CONSTRAINT "town_basket_gifts_sender_profile_id_profiles_id_fk" FOREIGN KEY ("sender_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "town_basket_gifts" ADD CONSTRAINT "town_basket_gifts_recipient_profile_id_profiles_id_fk" FOREIGN KEY ("recipient_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "town_basket_inbox" ON "town_basket_gifts" USING btree ("recipient_profile_id","opened_at","created_at");--> statement-breakpoint
CREATE INDEX "town_basket_pair" ON "town_basket_gifts" USING btree ("sender_profile_id","recipient_profile_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "town_basket_pending_pair" ON "town_basket_gifts" USING btree ("sender_profile_id","recipient_profile_id") WHERE "town_basket_gifts"."opened_at" IS NULL;