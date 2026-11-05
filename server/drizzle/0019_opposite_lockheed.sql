CREATE TABLE "miniku_family_settings" (
	"family_id" text PRIMARY KEY NOT NULL,
	"hints" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "miniku_puzzles" (
	"id" text PRIMARY KEY NOT NULL,
	"size" integer NOT NULL,
	"givens" jsonb NOT NULL,
	"solution" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "miniku_family_settings" ADD CONSTRAINT "miniku_family_settings_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "miniku_puzzles_layout_unique" ON "miniku_puzzles" USING btree ("size","givens");
