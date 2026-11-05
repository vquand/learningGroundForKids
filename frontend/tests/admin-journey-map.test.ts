import assert from "node:assert/strict";
import test from "node:test";
import { worldRingPath } from "../src/components/admin/adminJourneyProjection.ts";

test("world map coastlines crossing the date line do not draw through the whole map", () => {
  assert.equal(worldRingPath([[179, 10], [-179, 10], [-179, 9], [179, 9], [179, 10]]),
    "M718,160 L722,160 L722,162 L718,162 L718,160 Z");
});

test("polar land rings close along the pole rather than cutting across the coastline", () => {
  assert.match(worldRingPath([[0, -80], [179, -80], [-1, -80], [0, -80]]), /L1080,360 L360,360 Z$/);
  assert.equal(worldRingPath([]), "");
});
