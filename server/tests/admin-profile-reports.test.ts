import assert from "node:assert/strict";
import test from "node:test";
import { countDerivedBadges, deriveBadges } from "../src/badges.js";
import { journeyWindow } from "../src/db/admin-profile-reports.js";

test("admin journey periods use explicit UTC calendar boundaries", () => {
  const now = new Date("2026-09-27T18:30:00Z");
  assert.deepEqual(journeyWindow("yesterday", now), { since: new Date("2026-09-26T00:00:00Z"), until: new Date("2026-09-27T00:00:00Z") });
  assert.deepEqual(journeyWindow("last3days", now), { since: new Date("2026-09-25T00:00:00Z"), until: now });
  assert.deepEqual(journeyWindow("last7days", now), { since: new Date("2026-09-21T00:00:00Z"), until: now });
  assert.deepEqual(journeyWindow("today", now), { since: new Date("2026-09-27T00:00:00Z"), until: now });
  assert.deepEqual(journeyWindow("all", now), { since: null, until: now });
});

test("aggregate badge count matches existing milestone rules without loading whole histories", () => {
  for (const count of [0, 5, 15, 30, 60]) {
    const done = Array.from({ length: count }, (_, i) => ({ item_id: `item-${i}`, category: i % 2 ? "animal" : "food", done_at: new Date(i * 1000) }));
    const attempts = Array.from({ length: count }, (_, i) => ({ item_id: i % 3 ? "item" : null, score: 8, total: 10, completed_at: new Date(i * 1000) }));
    assert.equal(countDerivedBadges([Math.ceil(count / 2), Math.floor(count / 2)],
      attempts.filter((a) => a.item_id !== null).length, attempts.filter((a) => a.item_id === null).length), deriveBadges("profile", done, attempts).length);
  }
});
