import assert from "node:assert/strict";
import test from "node:test";
import { deriveBadges } from "../src/badges.js";

test("exploration badges use the completion that crossed each threshold", () => {
  const completions = Array.from({ length: 5 }, (_, index) => ({
    item_id: `item-${index}`,
    category: "animal",
    done_at: new Date(`2026-09-${String(index + 1).padStart(2, "0")}T00:00:00Z`),
  }));
  const badges = deriveBadges("profile-1", completions, []);
  assert.deepEqual(badges.map((badge) => badge.badge_key), ["global_5", "animal_5"]);
  assert.equal(new Date(badges[0]!.earned_at).toISOString(), "2026-09-05T00:00:00.000Z");
  assert.equal(badges[0]!.id, deriveBadges("profile-1", completions, [])[0]!.id);
});

test("wisdom badges count only passing attempts using the historical thresholds", () => {
  const attempts = [
    { item_id: "one", score: 8, total: 10, completed_at: new Date("2026-09-01T00:00:00Z") },
    { item_id: "one", score: 7, total: 10, completed_at: new Date("2026-09-02T00:00:00Z") },
    ...Array.from({ length: 4 }, (_, index) => ({
      item_id: `item-${index}`, score: 9, total: 10,
      completed_at: new Date(`2026-09-${String(index + 3).padStart(2, "0")}T00:00:00Z`),
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      item_id: null, score: 7, total: 10,
      completed_at: new Date(`2026-09-${String(index + 7).padStart(2, "0")}T00:00:00Z`),
    })),
  ];
  const badges = deriveBadges("profile-1", [], attempts);
  assert.deepEqual(badges.map((badge) => badge.badge_key), ["quiz_first", "quiz_explorer", "quiz_daily_scholar"]);
});
