import assert from "node:assert/strict";
import { test } from "node:test";
import { getTourPopoverPosition, KID_TOUR_STEPS } from "../src/lib/kidTour.ts";

test("kid tour keeps the confirmed card order and copy", () => {
  assert.deepEqual(KID_TOUR_STEPS.map((step) => step.target), ["minigame", "badges", "town"]);
  assert.deepEqual(KID_TOUR_STEPS.map((step) => step.message), [
    "These are minigames. Pick one and play!",
    "Finish minigames to earn badges and materials.",
    "Use your materials to build your own little town!",
  ]);
});

test("tour popover is fully visible below when there is room", () => {
  assert.deepEqual(
    getTourPopoverPosition(
      { x: 120, y: 180, width: 500, height: 180 },
      { width: 360, height: 160 },
      { width: 1024, height: 768 },
    ),
    { left: 190, top: 376, placement: "below" },
  );
});

test("tour popover moves above a target near the bottom and clamps horizontally", () => {
  const result = getTourPopoverPosition(
    { x: 880, y: 620, width: 220, height: 100 },
    { width: 380, height: 180 },
    { width: 1024, height: 768 },
  );
  assert.deepEqual(result, { left: 628, top: 424, placement: "above" });
  assert.ok(result.left >= 16 && result.left + 380 <= 1008);
  assert.ok(result.top >= 16 && result.top + 180 <= 752);
});
