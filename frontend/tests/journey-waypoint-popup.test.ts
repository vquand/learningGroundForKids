import assert from "node:assert/strict";
import test from "node:test";
import {
  getJourneyWaypointPresentation,
  type JourneyWaypointPresentation,
} from "../src/components/Journey/journeyWaypointPopup.ts";

test("waypoint popup presents the item's avatar, name, and category color", () => {
  const presentation: JourneyWaypointPresentation = getJourneyWaypointPresentation({
    kind: "item",
    title: "Banh Mi",
    category: "food",
  });

  assert.deepEqual(presentation, {
    emoji: "🍜",
    color: "#FF6B6B",
    title: "Banh Mi",
    categoryLabel: "food",
  });
});

test("home waypoint popup uses a home avatar and safe fallback styling", () => {
  const presentation = getJourneyWaypointPresentation({
    kind: "home",
    title: "Home base · Hanoi",
    category: "home",
  });

  assert.deepEqual(presentation, {
    emoji: "🏠",
    color: "#2563EB",
    title: "Home base · Hanoi",
    categoryLabel: "Home",
  });
});
