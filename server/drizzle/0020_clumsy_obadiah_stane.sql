DROP INDEX "miniku_puzzles_layout_unique";--> statement-breakpoint
ALTER TABLE "miniku_puzzles" ADD COLUMN "owner_family_id" text;--> statement-breakpoint
ALTER TABLE "miniku_puzzles" ADD CONSTRAINT "miniku_puzzles_owner_family_id_families_id_fk" FOREIGN KEY ("owner_family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "miniku_puzzles_shared_layout_unique" ON "miniku_puzzles" USING btree ("size","givens") WHERE "miniku_puzzles"."owner_family_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "miniku_puzzles_family_layout_unique" ON "miniku_puzzles" USING btree ("owner_family_id","size","givens") WHERE "miniku_puzzles"."owner_family_id" IS NOT NULL;