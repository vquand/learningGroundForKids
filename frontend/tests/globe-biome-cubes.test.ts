import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BIOME_DEFINITIONS,
  classifyBiome,
  FEATURED_VIETNAM_ARCHIPELAGOS,
  generateBiomeCubes,
  getVoxelPolarCapRadius,
  getVoxelOceanShellRadius,
  VOXEL_BLOCK_HEIGHT_METERS,
  VOXEL_EQUATOR_LATITUDE_STEP_DEGREES,
  VOXEL_EARTH_RADIUS_METERS,
  VOXEL_GRID_COLUMNS,
  VOXEL_GRID_ROWS,
  VOXEL_MIDLATITUDE_STEP_DEGREES,
  VOXEL_POLAR_LATITUDE_STEP_DEGREES,
  VOXEL_POLAR_CAP_START_LATITUDE,
} from "../src/components/Journey/globeBiomeData.ts";
import { getGlobeLandPolygons } from "../src/components/Journey/globeWorldGeometry.ts";
import type { Feature, Polygon } from "geojson";

const broadLandmass: Feature<Polygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [[
      [-170, -78],
      [170, -78],
      [170, 78],
      [-170, 78],
      [-170, -78],
    ]],
  },
};

const vietnamMainland: Feature<Polygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [[
      [104.3, 10.5], [106.3, 11], [107.6, 13.5], [107.6, 15.2],
      [105.1, 18.7], [103.2, 20.8], [102.2, 22.5], [105.8, 23],
      [108, 21.6], [105.7, 19.1], [108.9, 15.3], [109.2, 11.7],
      [106.4, 9.5], [105.2, 8.6], [104.3, 10.5],
    ]],
  },
};

const antimeridianIsland: Feature<Polygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [[
      [170, -31],
      [-170, -31],
      [-170, -28],
      [170, -28],
      [170, -31],
    ]],
  },
};

test("biome blocks are deterministic and span the child-friendly color palette", () => {
  const land = getGlobeLandPolygons([broadLandmass]);
  const first = generateBiomeCubes(land);
  const second = generateBiomeCubes(land);

  assert.deepEqual(first, second);
  assert.ok(new Set(first.map((cube) => cube.biome)).size >= 6);
  assert.ok(first.every((cube) => cube.width > 0 && cube.depth > 0));
  assert.ok(first.every((cube) => /^#[0-9A-F]{6}$/i.test(cube.surfaceColor)));
  assert.ok(new Set(first.map((cube) => cube.surfaceColor)).size > 20);
  assert.ok(first.every((cube) => BIOME_DEFINITIONS[cube.biome].color.startsWith("#")));
});

test("natural-atlas colors distinguish coastal water, forests, deserts, and relief", () => {
  assert.equal(BIOME_DEFINITIONS.ocean.color, "#238FBD");
  assert.equal(BIOME_DEFINITIONS["shallow-ocean"].color, "#65C5DE");
  assert.equal(BIOME_DEFINITIONS.desert.color, "#E8CE8A");
  assert.equal(BIOME_DEFINITIONS.rainforest.color, "#2F914F");
  assert.equal(BIOME_DEFINITIONS.alpine.color, "#9A6238");
});

test("painted climate regions resemble the natural-world reference", () => {
  assert.equal(classifyBiome(0, -60, 0.5), "rainforest");
  assert.equal(classifyBiome(25, 15, 0.5), "desert");
  assert.equal(classifyBiome(-25, 135, 0.5), "desert");
  assert.equal(classifyBiome(60, 100, 0.5), "boreal");
  assert.equal(classifyBiome(68, 100, 0.5), "tundra");
  assert.equal(classifyBiome(29, 82, 0.5), "alpine");
});

test("coastal seas form a lighter shelf around land", () => {
  const cubes = generateBiomeCubes(getGlobeLandPolygons([vietnamMainland]));

  assert.ok(cubes.some((cube) => cube.biome === "shallow-ocean"));
  assert.ok(cubes.some((cube) => cube.biome === "ocean"));
});

test("the adaptive grid is finest in the tropics and coarsest near the poles", () => {
  const land = getGlobeLandPolygons([broadLandmass]);
  const cubes = generateBiomeCubes(land);
  const equatorialRow = cubes.find(
    (candidate) => Math.abs(candidate.latitude) < 0.6,
  )?.row;
  const midLatitudeRow = cubes.find(
    (candidate) => candidate.latitude > 40 && candidate.latitude < 42,
  )?.row;
  const polarRow = cubes.find((candidate) => candidate.latitude > 75)?.row;
  const equatorial = cubes.filter((cube) => cube.row === equatorialRow);
  const midLatitude = cubes.filter((cube) => cube.row === midLatitudeRow);
  const polar = cubes.filter((cube) => cube.row === polarRow);

  assert.equal(VOXEL_EQUATOR_LATITUDE_STEP_DEGREES, 1);
  assert.equal(VOXEL_MIDLATITUDE_STEP_DEGREES, 2);
  assert.equal(VOXEL_POLAR_LATITUDE_STEP_DEGREES, 5);
  assert.equal(VOXEL_POLAR_CAP_START_LATITUDE, 80);
  assert.equal(VOXEL_GRID_ROWS, 98);
  assert.equal(VOXEL_GRID_COLUMNS, 360);
  assert.ok(cubes.length > 20_000 && cubes.length < 30_000);
  assert.equal(new Set(cubes.map((cube) => cube.row)).size, VOXEL_GRID_ROWS);
  assert.equal(equatorial[0]?.latitudeSpan, 1);
  assert.equal(midLatitude[0]?.latitudeSpan, 2);
  assert.equal(polar[0]?.latitudeSpan, 5);
  assert.ok(cubes.every((cube) => Math.abs(cube.latitude) < 80));
  assert.ok(cubes.every((cube) =>
    cube.shape === (Math.abs(cube.latitude) >= 60 ? "trapezoid" : "block")
  ));
  assert.ok(equatorial.length > midLatitude.length * 2);
  assert.ok(midLatitude.length > polar.length * 4);
  assert.ok((polar[0]?.longitudeSpan ?? 0) > (equatorial[0]?.longitudeSpan ?? 0) * 10);
});

test("every globe block uses one fixed height and contains no terrain topology", () => {
  const land = getGlobeLandPolygons([broadLandmass]);
  const cubes = generateBiomeCubes(land);

  assert.equal(new Set(cubes.map((cube) => cube.height)).size, 1);
  assert.ok(cubes.every((cube) => cube.height === VOXEL_BLOCK_HEIGHT_METERS));
  assert.ok(cubes.every((cube) => !("topology" in cube)));
  assert.ok(cubes.every((cube) => !("coastMask" in cube)));
  assert.ok(cubes.every((cube) => !("mountainAxis" in cube)));
});

test("adaptive blocks retain globe curvature with near-square surface footprints", () => {
  const land = getGlobeLandPolygons([broadLandmass]);
  const cubes = generateBiomeCubes(land);
  const equatorial = cubes.find((cube) => Math.abs(cube.latitude) < 2);
  const polar = cubes.find((cube) => cube.latitude > 75);

  assert.ok(equatorial && polar);
  assert.ok(equatorial.depth > 110_000 && equatorial.depth < 112_000);
  assert.ok(Math.abs(equatorial.width - equatorial.depth) < 2_000);
  assert.ok(polar.depth > equatorial.depth * 4);
  assert.ok(polar.width > equatorial.width * 3);
});

test("each pole is closed by one circular cap after the trapezoid zone", () => {
  const expectedRadius =
    VOXEL_EARTH_RADIUS_METERS * (10 * Math.PI / 180);

  assert.equal(VOXEL_POLAR_CAP_START_LATITUDE, 80);
  assert.ok(Math.abs(getVoxelPolarCapRadius() - expectedRadius) < 1);
});

test("Vietnam keeps its S-shaped mainland while island groups use image decals", () => {
  const cubes = generateBiomeCubes(getGlobeLandPolygons([vietnamMainland]));
  const oceanOnlyCubes = generateBiomeCubes([]);
  const landNear = (longitude: number, latitude: number, radius = 0.8) =>
    cubes.some((cube) =>
      cube.biome !== "ocean" &&
      Math.abs(cube.longitude - longitude) <= radius &&
      Math.abs(cube.latitude - latitude) <= radius,
    );

  // North, narrow central coast, and southern delta preserve the long S silhouette.
  assert.ok(landNear(106, 21));
  assert.ok(landNear(108, 16));
  assert.ok(landNear(106, 10));

  for (const archipelago of FEATURED_VIETNAM_ARCHIPELAGOS) {
    const [west, south, east, north] = archipelago.rectangle;
    const coveredBlocks = oceanOnlyCubes.filter((cube) =>
      cube.longitude >= west && cube.longitude <= east &&
      cube.latitude >= south && cube.latitude <= north,
    );

    assert.ok(coveredBlocks.length > 0);
    assert.ok(coveredBlocks.every((cube) => cube.biome === "ocean"));
    assert.match(archipelago.imageUrl, /^\/map\/.+-block-map\.svg$/);
    assert.match(
      readFileSync(new URL(`../public${archipelago.imageUrl}`, import.meta.url), "utf8"),
      /<svg[\s\S]+shape-rendering="crispEdges"/,
    );
  }
});

test("Vietnam archipelago decals render without duplicate globe text labels", () => {
  const rendererSource = readFileSync(
    new URL("../src/components/Journey/globeBiomeCubes.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(rendererSource, /new LabelCollection\(\)/);
  assert.doesNotMatch(rendererSource, /text:\s*archipelago\.label/);
});

test("land crossing the antimeridian does not become a worldwide stripe", () => {
  const cubes = generateBiomeCubes(
    getGlobeLandPolygons([antimeridianIsland]),
  );
  const centerOcean = cubes.find((cube) =>
    Math.abs(cube.longitude) < 1 &&
    cube.latitude > -31 && cube.latitude < -28
  );
  const datelineLand = cubes.find((cube) =>
    Math.abs(cube.longitude) > 175 &&
    cube.latitude > -31 && cube.latitude < -28
  );

  assert.equal(centerOcean?.biome, "ocean");
  assert.notEqual(datelineLand?.biome, "ocean");
});

test("biome blocks keep readable labels and approximate mountain colors", () => {
  const land = getGlobeLandPolygons([broadLandmass]);
  const cubes = generateBiomeCubes(land);

  for (const cube of cubes) {
    assert.ok(BIOME_DEFINITIONS[cube.biome].label.length > 0);
  }
  assert.equal(classifyBiome(29, 82, 0.5), "alpine");
});

test("the gap-filling ocean shell sits beneath the uniform block tops", () => {
  assert.ok(getVoxelOceanShellRadius() > VOXEL_EARTH_RADIUS_METERS);
  assert.ok(
    getVoxelOceanShellRadius() <
      VOXEL_EARTH_RADIUS_METERS + VOXEL_BLOCK_HEIGHT_METERS,
  );
});
