import assert from "node:assert/strict";
import test from "node:test";
import { getJourneySegmentBearing } from "../src/components/Journey/journeyBearing.ts";
import {
  createVehicleBillboard,
  JOURNEY_VEHICLE_DISABLE_DEPTH_TEST_DISTANCE,
  getVehicleBillboardRenderKey,
} from "../src/components/Journey/VehicleBillboard.ts";
import {
  VEHICLE_SWAP_DURATION_MS,
  getVehicleFacingScaleX,
  getVehicleCameraView,
  getVehicleMotionKind,
  getVehicleMotionTransform,
  getVehicleSpriteView,
  getVehicleTransitionProgress,
} from "../src/components/Journey/vehicleMotion.ts";
import { updateVehicleIconElement } from "../src/components/Journey/vehicleIconDom.ts";
import {
  VEHICLE_BACK_SVGS,
  VEHICLE_FRONT_SVGS,
  VEHICLE_SVGS,
} from "../src/components/Journey/vehicleSprites.ts";

const VEHICLES = ["car", "boat", "submarine", "zeppelin", "camel", "sled"] as const;

test("journey sprite catalog is cohesive and readable at map scale", () => {
  assert.deepEqual(Object.keys(VEHICLE_SVGS).sort(), [...VEHICLES].sort());

  for (const vehicle of VEHICLES) {
    const sprite = VEHICLE_SVGS[vehicle];
    assert.match(sprite, /viewBox="0 0 48 48"/);
    assert.match(sprite, /stroke="#17324D"/);
    assert.doesNotMatch(sprite, /stroke="#333"/);
    assert.match(sprite, /stroke-width="2\.6"/);
  }
});

test("every vehicle source silhouette has an explicit east-facing contract", () => {
  for (const vehicle of VEHICLES) {
    assert.match(
      VEHICLE_SVGS[vehicle],
      /data-facing="east"/,
      `${vehicle} side artwork must be authored facing east before directional selection`,
    );
  }
});

test("every vehicle has compact front and rear artwork", () => {
  for (const vehicle of VEHICLES) {
    for (const [view, catalog] of [
      ["front", VEHICLE_FRONT_SVGS],
      ["back", VEHICLE_BACK_SVGS],
    ] as const) {
      const sprite = catalog[vehicle];
      assert.match(sprite, /viewBox="0 0 48 48"/);
      assert.match(sprite, new RegExp(`data-view="${view}"`));
      assert.match(sprite, /stroke="#17324D"/);
      assert.match(sprite, /stroke-width="2\.6"/);
    }
  }
});

test("motion family follows the journey terrain", () => {
  assert.equal(getVehicleMotionKind("car"), "land");
  assert.equal(getVehicleMotionKind("camel"), "land");
  assert.equal(getVehicleMotionKind("sled"), "land");
  assert.equal(getVehicleMotionKind("boat"), "water");
  assert.equal(getVehicleMotionKind("submarine"), "water");
  assert.equal(getVehicleMotionKind("zeppelin"), "air");

  const water = getVehicleMotionTransform("boat", 250);
  const land = getVehicleMotionTransform("car", 250);
  assert.ok(Math.abs(water.rotation) > Math.abs(land.rotation));
  assert.ok(Math.abs(water.y) > Math.abs(land.y));
});

test("bearings select side, front, and rear artwork without turning sprites upside down", () => {
  const cardinalCases = [
    { bearing: 90, expectedView: "side", expectedScaleX: 1 },
    { bearing: 0, expectedView: "back", expectedScaleX: 1 },
    { bearing: -90, expectedView: "side", expectedScaleX: -1 },
    { bearing: 180, expectedView: "front", expectedScaleX: 1 },
  ];

  for (const vehicle of VEHICLES) {
    for (const { bearing, expectedView, expectedScaleX } of cardinalCases) {
      assert.equal(getVehicleSpriteView(bearing), expectedView);
      assert.equal(
        getVehicleFacingScaleX(bearing),
        expectedScaleX,
        `${vehicle} must remain upright and face the horizontal component of ${bearing}°`,
      );
    }
  }

  assert.equal(getVehicleSpriteView(30), "back");
  assert.equal(getVehicleSpriteView(60), "side");
  assert.equal(getVehicleSpriteView(120), "side");
  assert.equal(getVehicleSpriteView(150), "front");
  assert.equal(getVehicleFacingScaleX(-60), -1);
});

test("camera position selects the vehicle side facing the viewer", () => {
  const cases = [
    { vehicleBearing: 0, cameraBearing: 0, expectedView: "front", expectedScaleX: 1 },
    { vehicleBearing: 0, cameraBearing: 180, expectedView: "back", expectedScaleX: 1 },
    { vehicleBearing: 0, cameraBearing: 90, expectedView: "side", expectedScaleX: 1 },
    { vehicleBearing: 0, cameraBearing: -90, expectedView: "side", expectedScaleX: -1 },
  ] as const;

  for (const testCase of cases) {
    assert.deepEqual(
      getVehicleCameraView(testCase.vehicleBearing, testCase.cameraBearing),
      { view: testCase.expectedView, scaleX: testCase.expectedScaleX },
    );
  }
});

test("real billboard output preserves direction for every vehicle and cardinal bearing", () => {
  const cardinalCases = [
    { bearing: 90, expectedView: "side", expectedScaleX: 1 },
    { bearing: 0, expectedView: "back", expectedScaleX: 1 },
    { bearing: -90, expectedView: "side", expectedScaleX: -1 },
    { bearing: 180, expectedView: "front", expectedScaleX: 1 },
  ];

  for (const vehicle of VEHICLES) {
    for (const { bearing, expectedView, expectedScaleX } of cardinalCases) {
      const billboard = decodeURIComponent(createVehicleBillboard(
        vehicle,
        "⭐",
        "#F4C45B",
        bearing,
        1,
        0,
      ).split(",")[1]!);
      assert.match(
        billboard,
        new RegExp(`data-vehicle="${vehicle}"[^>]*data-view="${expectedView}"[^>]*>[\\s\\S]*?scale\\(${expectedScaleX} 1\\)`),
      );
      assert.doesNotMatch(billboard, /rotate\((?:-?90|-?180) 24 24\)/);
    }
  }
});

test("billboard output can switch sprite views independently of travel bearing", () => {
  const billboard = decodeURIComponent(createVehicleBillboard(
    "car",
    "⭐",
    "#F4C45B",
    0,
    1,
    0,
    undefined,
    180,
  ).split(",")[1]!);

  assert.match(billboard, /data-vehicle="car"[^>]*data-view="back"/);
  assert.match(billboard, /scale\(1 1\)/);
});

test("3D journey vehicles remain visible above the globe surface", () => {
  assert.equal(JOURNEY_VEHICLE_DISABLE_DEPTH_TEST_DISTANCE, Number.POSITIVE_INFINITY);
});

test("3D billboard updates are stable between discrete render frames", () => {
  const firstKey = getVehicleBillboardRenderKey("car", 90, 1200, undefined, 90);
  const sameFrameKey = getVehicleBillboardRenderKey("car", 90, 1250, undefined, 90);
  const nextFrameKey = getVehicleBillboardRenderKey("car", 90, 1320, undefined, 90);

  assert.equal(firstKey, sameFrameKey);
  assert.notEqual(firstKey, nextFrameKey);
});

test("route sampling points forward for cardinal and antimeridian journeys", () => {
  const routeCases = [
    { from: [0, 0], to: [20, 0], expectedBearing: 90, expectedView: "side", label: "eastbound" },
    { from: [20, 0], to: [0, 0], expectedBearing: -90, expectedView: "side", label: "westbound" },
    { from: [0, 0], to: [0, 20], expectedBearing: 0, expectedView: "back", label: "northbound" },
    { from: [0, 20], to: [0, 0], expectedBearing: 180, expectedView: "front", label: "southbound" },
    { from: [179, 0], to: [-179, 0], expectedBearing: 90, expectedView: "side", label: "eastbound across the antimeridian" },
    { from: [-179, 0], to: [179, 0], expectedBearing: -90, expectedView: "side", label: "westbound across the antimeridian" },
  ] as const;

  for (const routeCase of routeCases) {
    const bearing = getJourneySegmentBearing(
      [...routeCase.from],
      [...routeCase.to],
    );
    assert.ok(
      Math.abs(bearing - routeCase.expectedBearing) < 0.000001,
      `${routeCase.label} should point ${routeCase.expectedBearing}°, got ${bearing}°`,
    );

    for (const vehicle of VEHICLES) {
      assert.equal(getVehicleSpriteView(bearing), routeCase.expectedView);
      assert.equal(
        getVehicleFacingScaleX(bearing),
        routeCase.expectedBearing === -90 ? -1 : 1,
        `${vehicle} should remain forward-facing for ${routeCase.label}`,
      );
    }
  }
});

test("vehicle transitions progress predictably and render both sprites during the crossfade", () => {
  assert.equal(getVehicleTransitionProgress(1000, 1000), 0);
  assert.equal(getVehicleTransitionProgress(1000, 1000 + VEHICLE_SWAP_DURATION_MS / 2), 0.5);
  assert.equal(getVehicleTransitionProgress(1000, 1000 + VEHICLE_SWAP_DURATION_MS * 2), 1);

  const halfTransition = decodeURIComponent(createVehicleBillboard(
    "boat",
    "⭐",
    "#F4C45B",
    90,
    1,
    250,
    { from: "car", progress: 0.5 },
  ).split(",")[1]!);
  assert.match(halfTransition, /data-vehicle="car"[^>]*opacity="0\.5"/);
  assert.match(halfTransition, /data-vehicle="boat"[^>]*opacity="0\.5"/);
});

test("mounted vehicle layers update in place for motion and transitions", () => {
  const heading = { style: {} as Record<string, string> };
  const layers = [
    { dataset: { vehicle: "car" }, style: {} as Record<string, string> },
    { dataset: { vehicle: "boat" }, style: {} as Record<string, string> },
  ];
  const element = {
    querySelector: () => heading,
    querySelectorAll: () => layers,
  } as unknown as HTMLElement;

  updateVehicleIconElement(element, "boat", 90, 500, { from: "car", progress: 0.5 });

  assert.equal(heading.style.transform, "translateX(-50%) rotate(90deg)");
  assert.equal(layers[0]!.style.opacity, "0.5");
  assert.equal(layers[1]!.style.opacity, "0.5");
  assert.match(layers[1]!.style.transform, /^translate\(/);
});
