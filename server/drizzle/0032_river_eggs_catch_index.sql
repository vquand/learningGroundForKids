-- Shared eggs are stocked on the friend takeaway raft beside fish and vegetables.
ALTER TABLE "town_raft_items" DROP CONSTRAINT "town_raft_kind";--> statement-breakpoint
ALTER TABLE "town_raft_items" ADD CONSTRAINT "town_raft_kind" CHECK ("town_raft_items"."kind" IN ('fish','vegetable','egg'));--> statement-breakpoint
-- Count a child's catches per fish from the index alone (the Lake reads them on every tick).
CREATE INDEX "fishing_cast_profile_fish" ON "fishing_cast_results" USING btree ("profile_id","fish_id");
