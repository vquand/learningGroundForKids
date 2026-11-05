import assert from "node:assert/strict";
import test from "node:test";

import { fetchAchievements, fetchBadges, fetchJourney, fetchProfileLessons, fetchRecentActivity } from "../src/api/profileExtras.ts";
import type { ItemSummary } from "../src/types/item.ts";

const completedAt = new Date().toISOString();

const item = {
  id: "item/one", category: "animal", title: "Saola", country_code: "VN",
  latitude: 16, longitude: 108, icon_slug: "animal", has_quiz: false, quiz_required: false,
} satisfies ItemSummary;

test("profile extras use same-origin completion and activity routes", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = (async (input) => {
    const path = typeof input === "string" ? input : input.toString();
    paths.push(path);
    if (path.startsWith("/api/v1/activity/recent")) return Response.json([{
      family_id: "family-1", family_name: "Family", profile_id: "profile-1",
      profile_name: "Kid", profile_emoji: "⭐", profile_color: "blue",
      avatar_frame: "space",
      item_id: item.id, item_category: "animal", completed_at: completedAt,
    }]);
    if (path === "/api/v1/profiles/profile-1") return Response.json({
      id: "profile-1", name: "Kid", emoji: "⭐", color: "blue", public_id: "KID1",
      total_done: 1, badge_count: 0, created_at: "2026-09-20T00:00:00.000Z",
    });
    if (path === "/api/v1/profiles/profile-1/badges") return Response.json([{
      id: "badge-1", badge_key: "global_5", badge_type: "global", milestone: 5,
      earned_at: completedAt, name: "", description: "",
    }]);
    return Response.json([{ item_id: item.id, category: "animal", done_at: completedAt }]);
  }) as typeof fetch;

  try {
    assert.equal((await fetchAchievements("profile-1", [item])).length, 1);
    assert.equal((await fetchProfileLessons("profile-1", [item]))[0]?.title, "Saola");
    const recentActivity = await fetchRecentActivity(10, [item]);
    assert.equal(recentActivity[0]?.item_title, "Saola");
    assert.equal(recentActivity[0]?.avatar_frame, "space");
    assert.equal((await fetchJourney("profile-1", "last7days", [item])).exploredCount, 1);
    assert.equal((await fetchBadges("profile-1"))[0]?.name, "Explorer");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(paths, [
    "/api/v1/profiles/profile-1/completions",
    "/api/v1/profiles/profile-1/completions",
    "/api/v1/activity/recent?limit=10",
    "/api/v1/profiles/profile-1/completions",
    "/api/v1/profiles/profile-1",
    "/api/v1/profiles/profile-1/badges",
  ]);
});
