import assert from "node:assert/strict";
import test from "node:test";

import {
  beginMapPointer,
  beginMapTouch,
  clusterTapAction,
  isCompletedMapTap,
  mapTapAction,
} from "../src/components/Map/mapTouchInteraction.ts";

test("touching a leaf marker opens its detail page immediately", () => {
  assert.equal(mapTapAction("touch", "item"), "open-detail");
});

test("clicking a leaf marker with a mouse keeps the preview flow", () => {
  assert.equal(mapTapAction("mouse", "item"), "show-preview");
});

test("touching a numbered cluster expands it immediately", () => {
  assert.equal(mapTapAction("touch", "cluster"), "expand-cluster");
});

test("a cluster whose children share one point spiderfies without a max-zoom jump", () => {
  assert.equal(
    clusterTapAction({
      currentZoom: 2,
      maxZoom: 18,
      hasGeographicSpread: false,
    }),
    "spiderfy",
  );
});

test("a geographically spread cluster zooms to reveal its sub-clusters", () => {
  assert.equal(
    clusterTapAction({
      currentZoom: 2,
      maxZoom: 18,
      hasGeographicSpread: true,
    }),
    "zoom-to-bounds",
  );
});

test("a cluster at maximum zoom spiderfies instead of requesting another zoom", () => {
  assert.equal(
    clusterTapAction({
      currentZoom: 18,
      maxZoom: 18,
      hasGeographicSpread: true,
    }),
    "spiderfy",
  );
});

test("a short real-touch gesture is treated as a map tap", () => {
  const start = beginMapTouch({
    pointerId: 7,
    pointerType: "touch",
    clientX: 120,
    clientY: 240,
    timeStamp: 1_000,
  });

  assert.notEqual(start, null);
  assert.equal(
    isCompletedMapTap(start, {
      pointerId: 7,
      pointerType: "touch",
      clientX: 126,
      clientY: 246,
      timeStamp: 1_250,
    }),
    true,
  );
});

test("dragging a touch pointer does not activate a map marker", () => {
  const start = beginMapTouch({
    pointerId: 9,
    pointerType: "touch",
    clientX: 80,
    clientY: 90,
    timeStamp: 2_000,
  });

  assert.equal(
    isCompletedMapTap(start, {
      pointerId: 9,
      pointerType: "touch",
      clientX: 112,
      clientY: 124,
      timeStamp: 2_300,
    }),
    false,
  );
});

test("mouse input does not enable the touch-specific interaction path", () => {
  assert.equal(
    beginMapTouch({
      pointerId: 1,
      pointerType: "mouse",
      clientX: 40,
      clientY: 50,
      timeStamp: 3_000,
    }),
    null,
  );
});

test("a short mouse pointer gesture is treated as a map tap", () => {
  const start = beginMapPointer({
    pointerId: 11,
    pointerType: "mouse",
    clientX: 120,
    clientY: 240,
    timeStamp: 5_000,
  });

  assert.notEqual(start, null);
  assert.equal(
    isCompletedMapTap(start, {
      pointerId: 11,
      pointerType: "mouse",
      clientX: 124,
      clientY: 243,
      timeStamp: 5_150,
    }),
    true,
  );
});

test("a different pointer cannot complete another touch gesture", () => {
  const start = beginMapTouch({
    pointerId: 3,
    pointerType: "touch",
    clientX: 100,
    clientY: 100,
    timeStamp: 4_000,
  });

  assert.equal(
    isCompletedMapTap(start, {
      pointerId: 4,
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
      timeStamp: 4_100,
    }),
    false,
  );
});
