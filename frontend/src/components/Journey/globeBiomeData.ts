import type { GlobeLandPolygon } from "./globeWorldGeometry.ts";

export type BiomeKind =
  | "ocean"
  | "shallow-ocean"
  | "ice"
  | "tundra"
  | "boreal"
  | "temperate"
  | "grassland"
  | "desert"
  | "savanna"
  | "rainforest"
  | "alpine";

export interface BiomeDefinition {
  label: string;
  color: string;
}

export const BIOME_DEFINITIONS: Record<BiomeKind, BiomeDefinition> = {
  ocean: { label: "Deep ocean", color: "#238FBD" },
  "shallow-ocean": { label: "Coastal sea", color: "#65C5DE" },
  ice: { label: "Polar ice", color: "#F8F4DD" },
  tundra: { label: "Tundra", color: "#C9D7A0" },
  boreal: { label: "Boreal forest", color: "#4A985B" },
  temperate: { label: "Temperate forest", color: "#69AE58" },
  grassland: { label: "Grassland", color: "#AFCB64" },
  desert: { label: "Desert", color: "#E8CE8A" },
  savanna: { label: "Savanna", color: "#D6B866" },
  rainforest: { label: "Rainforest", color: "#2F914F" },
  alpine: { label: "Mountain highlands", color: "#9A6238" },
};

export const BIOME_ORDER: readonly BiomeKind[] = [
  "ocean",
  "shallow-ocean",
  "ice",
  "tundra",
  "boreal",
  "temperate",
  "grassland",
  "desert",
  "savanna",
  "rainforest",
  "alpine",
];

export const VOXEL_EARTH_RADIUS_METERS = 6_378_137;
export const VOXEL_OCEAN_SHELL_HEIGHT_METERS = 8_000;
export const VOXEL_BLOCK_HEIGHT_METERS = 60_000;
export const VOXEL_BLOCK_OVERLAP = 1.025;
export const VOXEL_EQUATOR_LATITUDE_STEP_DEGREES = 1;
export const VOXEL_MIDLATITUDE_STEP_DEGREES = 2;
export const VOXEL_POLAR_LATITUDE_STEP_DEGREES = 5;
export const VOXEL_POLAR_CAP_START_LATITUDE = 80;
export const VOXEL_GRID_ROWS = 98;
export const VOXEL_GRID_COLUMNS = 360;

const METERS_PER_DEGREE = Math.PI * VOXEL_EARTH_RADIUS_METERS / 180;

export interface BiomeCube {
  id: string;
  row: number;
  column: number;
  latitude: number;
  longitude: number;
  latitudeSpan: number;
  longitudeSpan: number;
  shape: "block" | "trapezoid";
  biome: BiomeKind;
  surfaceColor: string;
  width: number;
  depth: number;
  size: number;
  height: number;
}

interface LatitudeRow {
  latitude: number;
  latitudeSpan: number;
}

interface LatitudeBand {
  minimumLatitude: number;
  maximumLatitude: number;
  latitudeSpan: number;
}

const LATITUDE_BANDS: readonly LatitudeBand[] = [
  { minimumLatitude: -VOXEL_POLAR_CAP_START_LATITUDE, maximumLatitude: -60, latitudeSpan: VOXEL_POLAR_LATITUDE_STEP_DEGREES },
  { minimumLatitude: -60, maximumLatitude: -30, latitudeSpan: VOXEL_MIDLATITUDE_STEP_DEGREES },
  { minimumLatitude: -30, maximumLatitude: 30, latitudeSpan: VOXEL_EQUATOR_LATITUDE_STEP_DEGREES },
  { minimumLatitude: 30, maximumLatitude: 60, latitudeSpan: VOXEL_MIDLATITUDE_STEP_DEGREES },
  { minimumLatitude: 60, maximumLatitude: VOXEL_POLAR_CAP_START_LATITUDE, latitudeSpan: VOXEL_POLAR_LATITUDE_STEP_DEGREES },
];

const LATITUDE_ROWS: readonly LatitudeRow[] = LATITUDE_BANDS.flatMap((band) => {
  const rowCount = Math.round(
    (band.maximumLatitude - band.minimumLatitude) / band.latitudeSpan,
  );
  return Array.from({ length: rowCount }, (_, index) => ({
    latitude: band.minimumLatitude + band.latitudeSpan * (index + 0.5),
    latitudeSpan: band.latitudeSpan,
  }));
});

export interface FeaturedVietnamArchipelago {
  label: string;
  rectangle: readonly [west: number, south: number, east: number, north: number];
  imageUrl: string;
}

// The bundled 110m world map intentionally omits islands this small. These
// transparent pixel-map decals keep the two Vietnamese-named archipelagos
// legible without exaggerating each island into a full one-degree land block.
export const FEATURED_VIETNAM_ARCHIPELAGOS: readonly FeaturedVietnamArchipelago[] = [
  {
    label: "Hoàng Sa",
    rectangle: [110.3, 15, 114.1, 17.5],
    imageUrl: "/map/hoang-sa-block-map.svg",
  },
  {
    label: "Trường Sa",
    rectangle: [111, 7, 117.5, 12],
    imageUrl: "/map/truong-sa-block-map.svg",
  },
];

type MountainRangeAxis = "east-west" | "north-south";

interface MountainRangeDefinition {
  axis: MountainRangeAxis;
  minimumLongitude: number;
  maximumLongitude: number;
  minimumLatitude: number;
  maximumLatitude: number;
  centerLongitude: number;
  centerLatitude: number;
  corridorHalfWidth: number;
  waviness: number;
  phase: number;
}

const MOUNTAIN_RANGES: readonly MountainRangeDefinition[] = [
  {
    axis: "east-west",
    minimumLongitude: 65,
    maximumLongitude: 105,
    minimumLatitude: 22,
    maximumLatitude: 40,
    centerLongitude: 85,
    centerLatitude: 29.5,
    corridorHalfWidth: 5.5,
    waviness: 1.4,
    phase: 0.7,
  },
  {
    axis: "east-west",
    minimumLongitude: -10,
    maximumLongitude: 35,
    minimumLatitude: 38,
    maximumLatitude: 55,
    centerLongitude: 12,
    centerLatitude: 46,
    corridorHalfWidth: 4.5,
    waviness: 1.2,
    phase: 2.4,
  },
  {
    axis: "north-south",
    minimumLongitude: -130,
    maximumLongitude: -100,
    minimumLatitude: 25,
    maximumLatitude: 58,
    centerLongitude: -114,
    centerLatitude: 41,
    corridorHalfWidth: 5.5,
    waviness: 2.2,
    phase: 1.3,
  },
  {
    axis: "north-south",
    minimumLongitude: -82,
    maximumLongitude: -64,
    minimumLatitude: -55,
    maximumLatitude: 10,
    centerLongitude: -72,
    centerLatitude: -20,
    corridorHalfWidth: 4.5,
    waviness: 1.8,
    phase: 3.1,
  },
  {
    axis: "north-south",
    minimumLongitude: 135,
    maximumLongitude: 155,
    minimumLatitude: -40,
    maximumLatitude: -15,
    centerLongitude: 147,
    centerLatitude: -27,
    corridorHalfWidth: 4,
    waviness: 1.4,
    phase: 4.2,
  },
];

function hashGrid(row: number, column: number): number {
  const value = Math.sin(row * 127.1 + column * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function climateNoise(longitude: number, latitude: number): number {
  const value =
    Math.sin((longitude + latitude * 0.7) * Math.PI / 34) * 0.22 +
    Math.cos((longitude * 0.55 - latitude) * Math.PI / 29) * 0.18;
  return Math.max(0, Math.min(1, 0.5 + value));
}

function shadeColor(color: string, amount: number): string {
  const value = Number.parseInt(color.slice(1), 16);
  const channel = (shift: number) => Math.max(
    0,
    Math.min(255, Math.round(((value >> shift) & 0xff) * (1 + amount))),
  );
  return `#${[channel(16), channel(8), channel(0)]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")}`;
}

function paintedBiomeColor(biome: BiomeKind, row: number, column: number): string {
  const variation = (hashGrid(row, column) - 0.5) *
    (biome === "ocean" || biome === "shallow-ocean" ? 0.06 : 0.12);
  return shadeColor(BIOME_DEFINITIONS[biome].color, variation);
}

function inRegion(
  longitude: number,
  latitude: number,
  minimumLongitude: number,
  maximumLongitude: number,
  minimumLatitude: number,
  maximumLatitude: number,
): boolean {
  return (
    longitude >= minimumLongitude &&
    longitude <= maximumLongitude &&
    latitude >= minimumLatitude &&
    latitude <= maximumLatitude
  );
}

function isMountainPatch(longitude: number, latitude: number): boolean {
  return MOUNTAIN_RANGES.some((range) => {
    if (!inRegion(
      longitude,
      latitude,
      range.minimumLongitude,
      range.maximumLongitude,
      range.minimumLatitude,
      range.maximumLatitude,
    )) {
      return false;
    }

    const along = range.axis === "east-west"
      ? longitude - range.minimumLongitude
      : latitude - range.minimumLatitude;
    const centerLine = range.axis === "east-west"
      ? range.centerLatitude + Math.sin((along + range.phase) * 0.22) * range.waviness
      : range.centerLongitude + Math.sin((along + range.phase) * 0.16) * range.waviness;
    const distance = range.axis === "east-west"
      ? Math.abs(latitude - centerLine)
      : Math.abs(longitude - centerLine);

    return distance <= range.corridorHalfWidth;
  });
}

function isPointInRing(
  longitude: number,
  latitude: number,
  ring: readonly (readonly [number, number])[],
): boolean {
  const [firstLongitude, firstLatitude] = ring[0]!;
  const queryLongitude = firstLongitude +
    ((((longitude - firstLongitude) + 180) % 360) + 360) % 360 - 180;
  let inside = false;
  let previousLongitude = firstLongitude;
  let previousLatitude = firstLatitude;

  for (let index = 1; index <= ring.length; index += 1) {
    const [rawLongitude, currentLatitude] = ring[index % ring.length]!;
    const currentLongitude = previousLongitude +
      ((((rawLongitude - previousLongitude) + 180) % 360) + 360) % 360 - 180;
    const crossesLatitude =
      (currentLatitude > latitude) !== (previousLatitude > latitude);
    if (crossesLatitude) {
      const crossingLongitude =
        ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
          (previousLatitude - currentLatitude) +
        currentLongitude;
      if (queryLongitude < crossingLongitude) inside = !inside;
    }

    previousLongitude = currentLongitude;
    previousLatitude = currentLatitude;
  }

  return inside;
}

function isPointOnLand(
  longitude: number,
  latitude: number,
  landPolygons: readonly GlobeLandPolygon[],
): boolean {
  return landPolygons.some((polygon) =>
    isPointInRing(longitude, latitude, polygon.outer) &&
    !polygon.holes.some((hole) => isPointInRing(longitude, latitude, hole)),
  );
}

export function classifyBiome(
  latitude: number,
  longitude: number,
  noise: number,
): BiomeKind {
  const absoluteLatitude = Math.abs(latitude);

  if (isMountainPatch(longitude, latitude)) return "alpine";
  if (absoluteLatitude >= 72) return "ice";
  if (absoluteLatitude >= 66) return "tundra";

  const dryRegion =
    inRegion(longitude, latitude, -18, 35, 15, 35) ||
    inRegion(longitude, latitude, 35, 60, 12, 32) ||
    inRegion(longitude, latitude, 112, 155, -36, -17) ||
    inRegion(longitude, latitude, -125, -98, 20, 38) ||
    inRegion(longitude, latitude, -78, -65, -32, -15) ||
    inRegion(longitude, latitude, 10, 31, -34, -16) ||
    inRegion(longitude, latitude, 42, 105, 32, 49);

  if (dryRegion && (absoluteLatitude >= 18 || noise > 0.42)) return "desert";

  const rainforestRegion =
    inRegion(longitude, latitude, -82, -45, -16, 10) ||
    inRegion(longitude, latitude, 8, 32, -12, 10) ||
    inRegion(longitude, latitude, 92, 155, -12, 19) ||
    inRegion(longitude, latitude, -93, -77, 5, 18);

  if (absoluteLatitude <= 18 && (rainforestRegion || noise > 0.58)) {
    return "rainforest";
  }

  if (absoluteLatitude >= 52) return noise > 0.28 ? "boreal" : "tundra";
  if (absoluteLatitude >= 38) return noise > 0.72 ? "grassland" : "temperate";
  if (absoluteLatitude <= 30) return noise > 0.57 ? "grassland" : "savanna";
  return noise > 0.58 ? "grassland" : "temperate";
}

export function getVoxelOceanShellRadius(): number {
  return VOXEL_EARTH_RADIUS_METERS + VOXEL_OCEAN_SHELL_HEIGHT_METERS;
}

export function getVoxelPolarCapRadius(): number {
  const angularRadius = 90 - VOXEL_POLAR_CAP_START_LATITUDE;
  return VOXEL_EARTH_RADIUS_METERS * angularRadius * Math.PI / 180;
}

export function generateBiomeCubes(
  landPolygons: readonly GlobeLandPolygon[],
): readonly BiomeCube[] {
  const cubes: BiomeCube[] = [];

  for (let row = 0; row < LATITUDE_ROWS.length; row += 1) {
    const { latitude, latitudeSpan } = LATITUDE_ROWS[row]!;
    const localLongitudeScale = Math.cos((latitude * Math.PI) / 180);
    const columnCount = Math.max(
      4,
      Math.round((360 * localLongitudeScale) / latitudeSpan),
    );
    const longitudeSpan = 360 / columnCount;
    const firstLongitude = -180 + longitudeSpan / 2;
    const depth = METERS_PER_DEGREE * latitudeSpan;
    const width = METERS_PER_DEGREE * longitudeSpan * localLongitudeScale;

    for (let column = 0; column < columnCount; column += 1) {
      const longitude = firstLongitude + column * longitudeSpan;
      const onLand = isPointOnLand(longitude, latitude, landPolygons);
      const biome = onLand
        ? classifyBiome(latitude, longitude, climateNoise(longitude, latitude))
        : "ocean";

      cubes.push({
        id: `biome-cube-${row}-${column}`,
        row,
        column,
        latitude,
        longitude,
        latitudeSpan,
        longitudeSpan,
        shape: Math.abs(latitude) >= 60 ? "trapezoid" : "block",
        biome,
        surfaceColor: BIOME_DEFINITIONS[biome].color,
        width,
        depth,
        size: depth,
        height: VOXEL_BLOCK_HEIGHT_METERS,
      });
    }
  }

  const bucketSize = 4;
  const longitudeBucketCount = 360 / bucketSize;
  const landBuckets = new Map<string, BiomeCube[]>();
  const bucketKey = (latitudeBucket: number, longitudeBucket: number) =>
    `${latitudeBucket}:${(longitudeBucket + longitudeBucketCount) % longitudeBucketCount}`;

  for (const cube of cubes) {
    if (cube.biome === "ocean") continue;
    const latitudeBucket = Math.floor((cube.latitude + 90) / bucketSize);
    const longitudeBucket = Math.floor((cube.longitude + 180) / bucketSize);
    const key = bucketKey(latitudeBucket, longitudeBucket);
    const bucket = landBuckets.get(key);
    if (bucket) bucket.push(cube);
    else landBuckets.set(key, [cube]);
  }

  for (const cube of cubes) {
    if (cube.biome === "ocean") {
      const latitudeBucket = Math.floor((cube.latitude + 90) / bucketSize);
      const longitudeBucket = Math.floor((cube.longitude + 180) / bucketSize);
      const coastalRadius = Math.max(2.2, cube.latitudeSpan * 1.35);
      let coastal = false;

      for (let latitudeOffset = -1; latitudeOffset <= 1 && !coastal; latitudeOffset += 1) {
        for (let longitudeOffset = -1; longitudeOffset <= 1 && !coastal; longitudeOffset += 1) {
          const nearby = landBuckets.get(bucketKey(
            latitudeBucket + latitudeOffset,
            longitudeBucket + longitudeOffset,
          )) ?? [];
          coastal = nearby.some((landCube) => {
            const latitudeDistance = Math.abs(landCube.latitude - cube.latitude);
            const rawLongitudeDistance = Math.abs(landCube.longitude - cube.longitude);
            const longitudeDistance = Math.min(rawLongitudeDistance, 360 - rawLongitudeDistance) *
              Math.cos(cube.latitude * Math.PI / 180);
            return latitudeDistance <= coastalRadius && longitudeDistance <= coastalRadius;
          });
        }
      }

      if (coastal) cube.biome = "shallow-ocean";
    }

    cube.surfaceColor = paintedBiomeColor(cube.biome, cube.row, cube.column);
  }

  return cubes;
}
