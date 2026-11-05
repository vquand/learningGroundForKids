import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_UAT_ITEMS,
  getLocalUatJourney,
  isLocalUatPath,
} from "../src/uat/localUatData.ts";

test("local UAT data exposes a broad catalog with stable unique item ids", () => {
  assert.ok(LOCAL_UAT_ITEMS.length >= 300);
  assert.equal(new Set(LOCAL_UAT_ITEMS.map((item) => item.id)).size, LOCAL_UAT_ITEMS.length);
  assert.ok(LOCAL_UAT_ITEMS.every((item) => item.title && item.latitude >= -90 && item.latitude <= 90));
});

test("local UAT journey keeps replay stops inside the map catalog", () => {
  const catalogIds = new Set(LOCAL_UAT_ITEMS.map((item) => item.id));
  const route = getLocalUatJourney("last7days");

  assert.ok(route.waypoints.length >= 5);
  assert.ok(route.waypoints.every((waypoint) => catalogIds.has(waypoint.item_id)));
  assert.equal(route.exploredCount, route.waypoints.length);
});

test("local UAT periods remain replayable and progressively bounded", () => {
  const counts = (["today", "yesterday", "last3days", "last7days"] as const)
    .map((period) => getLocalUatJourney(period).waypoints.length);

  assert.ok(counts.every((count) => count >= 1));
  assert.deepEqual([...counts].sort((a, b) => a - b), counts);
});

test("the UAT route is enabled only for Vite development", () => {
  assert.equal(isLocalUatPath("/uat/map", true), true);
  assert.equal(isLocalUatPath("/uat", true), true);
  assert.equal(isLocalUatPath("/uat/map", false), false);
  assert.equal(isLocalUatPath("/map", true), false);
});
