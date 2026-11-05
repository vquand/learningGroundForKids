import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DESERT_REGIONS,
  ICE_REGIONS,
  MAJOR_FOREST_REGIONS,
  WORLD_SURFACE_PALETTE,
  terrainDetailForZoom,
} from "../src/components/Map/illustratedEarth.ts";
import { WORLD_MERCATOR_BOUNDS, worldMercatorRingPath } from "../src/components/Map/worldProjection.ts";

test("the exploration map uses bundled geography instead of an authenticated tile provider", async () => {
  const source = (await Promise.all(['WorldMap', 'LocalWorldMap', 'PreparedWorldMap'].map(name => readFile(
    new URL(`../src/components/Map/${name}.tsx`, import.meta.url), 'utf8',
  )))).join('\n');

  assert.match(source, /IllustratedEarthLayer/);
  assert.doesNotMatch(source, /GeoJSON/);
  assert.doesNotMatch(source, /tiles\.stadiamaps\.com/);
  assert.doesNotMatch(source, /VITE_STADIA_API_KEY/);
});

test("map taps navigate touch leaves and expand clusters without synthetic clicks", async () => {
  const source = (await Promise.all(['WorldMap', 'LocalWorldMap', 'PreparedWorldMap'].map(name => readFile(
    new URL(`../src/components/Map/${name}.tsx`, import.meta.url), 'utf8',
  )))).join('\n');

  const interactions = await readFile(new URL("../src/components/Map/MapInteractions.tsx", import.meta.url), "utf8");
  const clusterInteractions = await readFile(new URL('../src/components/Map/localClusterInteraction.ts', import.meta.url), 'utf8');
  const combined = source + interactions + clusterInteractions;
  assert.match(combined, /onOpenDetail\(item\)/);
  assert.match(combined, /clusterTapAction/);
  assert.match(combined, /nextClusterSplitZoom/);
  assert.match(combined, /map\.setView/);
  assert.match(source, /animate=\{false\}/);
  assert.doesNotMatch(source, /dispatchEvent/);
});

test("terrain detail becomes more legible at close zoom without loading assets", () => {
  assert.equal(terrainDetailForZoom(4.75), "fill");
  assert.equal(terrainDetailForZoom(5), "detail");
  assert.equal(terrainDetailForZoom(12), "detail");
});

test("the entire world has distinct pastel land and sea surfaces", () => {
  const landColors: readonly string[] = WORLD_SURFACE_PALETTE.land;
  assert.match(WORLD_SURFACE_PALETTE.ocean, /^#[0-9a-f]{6}$/i);
  assert.equal(WORLD_SURFACE_PALETTE.land.length, 3);
  assert.ok(WORLD_SURFACE_PALETTE.land.every((color) => /^#[0-9a-f]{6}$/i.test(color)));
  assert.ok(!landColors.includes(WORLD_SURFACE_PALETTE.ocean));
});

test("biome fills are framed by a soft dotted geographic boundary", async () => {
  const source = await readFile(
    new URL("../src/components/Map/IllustratedEarthLayer.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /illustrated-earth__biome-border/);
  assert.match(source, /strokeDasharray="1\.5 4\.5"/);
});

test("the 2D map retains biome surfaces without standalone geographic details", async () => {
  const source = await readFile(
    new URL("../src/components/Map/IllustratedEarthLayer.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /<BiomeRegions/);
  assert.doesNotMatch(source, /GeographicDetails|AtlasSymbol|showCanopyAnchors/);
  assert.doesNotMatch(
    source,
    /illustrated-earth__mountains|illustrated-earth__rivers|illustrated-earth__water-bodies|illustrated-earth__settlements/,
  );
});

test("the world illustration covers the retained biome families", () => {
  assert.ok(MAJOR_FOREST_REGIONS.length >= 16);
  assert.ok(DESERT_REGIONS.length >= 6);
  assert.ok(ICE_REGIONS.length >= 3);
});

test("Europe, Asia, and Southeast Asia have explicit forest coverage", () => {
  const forestIds = new Set(MAJOR_FOREST_REGIONS.map((region) => region.id));

  for (const id of [
    "scandinavia",
    "central-europe",
    "eastern-europe",
    "siberia",
    "far-east-russia",
    "himalayan-foothills",
    "indochina",
    "malay-peninsula",
    "borneo",
    "sumatra",
    "philippines",
  ]) {
    assert.ok(forestIds.has(id), `missing forest region: ${id}`);
  }
});

test("retained biome regions have stable geometry and colors", () => {
  const regions = [...MAJOR_FOREST_REGIONS, ...DESERT_REGIONS, ...ICE_REGIONS];
  assert.ok(regions.length >= 40);
  assert.ok(regions.every((region) => (
    region.id.length > 0
    && region.fill.startsWith("#")
    && region.radius[0] > 0
    && region.radius[1] > 0
  )));
});

test("the interactive world layer uses Leaflet-compatible Web Mercator bounds", () => {
  assert.deepEqual(WORLD_MERCATOR_BOUNDS, [[-85.0511287798, -180], [85.0511287798, 180]]);
  assert.match(
    worldMercatorRingPath([[179, 60], [-179, 60], [-179, 59], [179, 59], [179, 60]]),
    /^M718,/,
  );
});
