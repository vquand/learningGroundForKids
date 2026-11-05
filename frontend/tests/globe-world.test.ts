import assert from "node:assert/strict";
import test from "node:test";
import { getGlobeLandPolygons } from "../src/components/Journey/globeWorldGeometry.ts";
import type { Feature, Polygon } from "geojson";

test("globe converts bundled land geometry into renderable polygons", () => {
  const polygon: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-10, 0],
        [10, 0],
        [10, 10],
        [-10, 10],
        [-10, 0],
      ], [
        [-2, 2],
        [2, 2],
        [2, 4],
        [-2, 4],
        [-2, 2],
      ]],
    },
  };
  const polygons = getGlobeLandPolygons([polygon]);

  assert.equal(polygons.length, 1);
  assert.equal(polygons[0]?.outer.length, 5);
  assert.equal(polygons[0]?.holes.length, 1);
});

test("globe preserves every point of long coastlines for narrow peninsulas", () => {
  const coastline = Array.from({ length: 128 }, (_, index) => [
    100 + index * 0.05,
    8 + Math.sin(index * 0.2) * 0.5,
  ] as [number, number]);
  coastline.push(coastline[0]!);
  const polygon: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [coastline],
    },
  };

  const [converted] = getGlobeLandPolygons([polygon]);

  assert.deepEqual(converted?.outer, coastline);
});
