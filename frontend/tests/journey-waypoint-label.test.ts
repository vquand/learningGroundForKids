import assert from "node:assert/strict";
import test from "node:test";
import { getLastReachedWaypointIndex } from "../src/components/Journey/journeyWaypointLabel.ts";

test("waypoint labels follow arrivals instead of terrain-phase segments", () => {
  const segmentWaypointArrivals = [null, null, 0, null, null, 1, null];

  assert.equal(
    getLastReachedWaypointIndex(segmentWaypointArrivals, 0),
    -1,
  );
  assert.equal(
    getLastReachedWaypointIndex(segmentWaypointArrivals, 2),
    -1,
  );
  assert.equal(
    getLastReachedWaypointIndex(segmentWaypointArrivals, 3),
    0,
  );
  assert.equal(
    getLastReachedWaypointIndex(segmentWaypointArrivals, 6),
    1,
  );
});
