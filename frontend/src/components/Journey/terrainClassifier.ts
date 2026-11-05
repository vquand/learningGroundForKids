import { distance } from "@turf/distance";
import { point } from "@turf/helpers";
import { feature } from "topojson-client";
import land50m from "world-atlas/land-50m.json";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { TerrainType } from "../../types/journey";

type LngLat = [number, number];
type LatLng = [number, number];

interface LandPolygon {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  outer: LngLat[];
  holes: LngLat[][];
}

interface RegionBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const OCEAN_ROUTE_MIN_DISTANCE_KM = 500;
const COASTAL_LAND_BUFFER_RATIO = 0.06;
const COASTAL_LAND_BUFFER_MAX_KM = 140;
const MIN_OCEAN_SPAN_KM = 220;
const MIN_UNDERSEA_SPAN_KM = 500;
const MIN_MOUNTAIN_AIR_SPAN_KM = 180;
const MIN_HOT_DESERT_SPAN_KM = 180;
const MIN_COLD_DESERT_SPAN_KM = 160;

const MOUNTAIN_REGION_BOXES: RegionBox[] = [
  // Himalayas / Tibetan Plateau
  { minLat: 26, maxLat: 37, minLng: 72, maxLng: 101 },
  // Andes spine
  { minLat: -55, maxLat: 11, minLng: -79, maxLng: -67 },
  // Alps / central European highlands
  { minLat: 44, maxLat: 48.8, minLng: 5, maxLng: 16.5 },
];

const DEEP_OCEAN_REGION_BOXES: RegionBox[] = [
  { minLat: -42, maxLat: 22, minLng: -158, maxLng: -112 },
  { minLat: -45, maxLat: 18, minLng: 150, maxLng: 179 },
  { minLat: -46, maxLat: 18, minLng: -42, maxLng: -12 },
  { minLat: -42, maxLat: 8, minLng: 62, maxLng: 96 },
];

const HOT_DESERT_REGION_BOXES: RegionBox[] = [
  // Sahara
  { minLat: 14, maxLat: 33, minLng: -17, maxLng: 35 },
  // Arabian Desert
  { minLat: 16, maxLat: 31, minLng: 36, maxLng: 58 },
  // Iranian plateau / Lut-Kavir
  { minLat: 27, maxLat: 38, minLng: 51, maxLng: 63 },
  // Thar
  { minLat: 23, maxLat: 30, minLng: 68, maxLng: 76 },
  // Kalahari / Namib inland
  { minLat: -31, maxLat: -16, minLng: 14, maxLng: 28 },
  // Australian interior
  { minLat: -31, maxLat: -18, minLng: 120, maxLng: 141 },
  // Atacama
  { minLat: -29, maxLat: -17, minLng: -72, maxLng: -67 },
  // Sonoran / Mojave
  { minLat: 24, maxLat: 38, minLng: -117, maxLng: -107 },
];

const COLD_DESERT_REGION_BOXES: RegionBox[] = [
  // Gobi
  { minLat: 37, maxLat: 47, minLng: 89, maxLng: 116 },
  // Taklamakan
  { minLat: 35, maxLat: 42, minLng: 75, maxLng: 92 },
  // Great Basin
  { minLat: 36, maxLat: 43, minLng: -121, maxLng: -111 },
  // Patagonian Desert
  { minLat: -50, maxLat: -39, minLng: -72, maxLng: -65 },
  // Greenland interior ice desert
  { minLat: 66, maxLat: 84, minLng: -53, maxLng: -20 },
  // Antarctic fringe for overland silliness
  { minLat: -85, maxLat: -68, minLng: -180, maxLng: 180 },
];

function normalizeLng(lng: number): number {
  return (((lng + 180) % 360) + 360) % 360 - 180;
}

function toLandPolygons(): LandPolygon[] {
  const topology = land50m as unknown as Topology<{ land: GeometryCollection }>;
  const geo = feature(topology, topology.objects.land);

  const polygons: LandPolygon[] = [];

  const pushPolygon = (rings: LngLat[][]) => {
    const outer = rings[0];
    if (!outer || outer.length < 3) return;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const [lng, lat] of outer) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    polygons.push({
      minLat,
      maxLat,
      minLng,
      maxLng,
      outer,
      holes: rings.slice(1),
    });
  };

  for (const featureItem of geo.features) {
    if (!featureItem.geometry) continue;
    if (featureItem.geometry.type === "Polygon") {
      pushPolygon(featureItem.geometry.coordinates as LngLat[][]);
      continue;
    }
    if (featureItem.geometry.type === "MultiPolygon") {
      for (const polygon of featureItem.geometry.coordinates) {
        pushPolygon(polygon as LngLat[][]);
      }
    }
  }

  return polygons;
}

const LAND_POLYGONS = toLandPolygons();

function pointInRing(lng: number, lat: number, ring: LngLat[]): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

export function isOnLand(lat: number, lng: number): boolean {
  const normalizedLng = normalizeLng(lng);

  for (const polygon of LAND_POLYGONS) {
    if (
      lat < polygon.minLat ||
      lat > polygon.maxLat ||
      normalizedLng < polygon.minLng ||
      normalizedLng > polygon.maxLng
    ) {
      continue;
    }

    if (!pointInRing(normalizedLng, lat, polygon.outer)) {
      continue;
    }

    let insideHole = false;
    for (const hole of polygon.holes) {
      if (pointInRing(normalizedLng, lat, hole)) {
        insideHole = true;
        break;
      }
    }

    if (!insideHole) return true;
  }

  return false;
}

/** Check if a lat/lng point falls in open water based on land polygons. */
export function isInOcean(lat: number, lng: number): boolean {
  return !isOnLand(lat, lng);
}

function isInRegionBoxes(
  lat: number,
  lng: number,
  boxes: RegionBox[],
): boolean {
  const normalizedLng = normalizeLng(lng);
  return boxes.some(
    (box) =>
      lat >= box.minLat &&
      lat <= box.maxLat &&
      normalizedLng >= box.minLng &&
      normalizedLng <= box.maxLng,
  );
}

export function classifyPointTerrain(lat: number, lng: number): TerrainType {
  if (isOnLand(lat, lng)) {
    if (isInRegionBoxes(lat, lng, HOT_DESERT_REGION_BOXES)) {
      return "hot_desert";
    }
    if (isInRegionBoxes(lat, lng, COLD_DESERT_REGION_BOXES)) {
      return "cold_desert";
    }
    if (isInRegionBoxes(lat, lng, MOUNTAIN_REGION_BOXES)) {
      return "mountain_air";
    }
    return "land";
  }

  if (isInRegionBoxes(lat, lng, DEEP_OCEAN_REGION_BOXES)) {
    return "undersea";
  }

  return "ocean";
}

function distanceKmBetween(from: LatLng, to: LatLng): number {
  return distance(
    point([normalizeLng(from[1]), from[0]]),
    point([normalizeLng(to[1]), to[0]]),
  );
}

function getCumulativeDistances(latLngs: LatLng[]): number[] {
  const cumulative = [0];
  for (let i = 1; i < latLngs.length; i++) {
    cumulative.push(
      cumulative[i - 1]! + distanceKmBetween(latLngs[i - 1]!, latLngs[i]!),
    );
  }
  return cumulative;
}

/**
 * Builds a smoothed terrain profile for a generated route polyline.
 * Endpoints are forced to land and short open-water runs are ignored so the
 * vehicle swaps only after the route is clearly offshore.
 */
export function classifyPathTerrains(latLngs: LatLng[]): TerrainType[] {
  if (latLngs.length === 0) return [];
  if (latLngs.length === 1) return ["land"];

  const cumulativeDistances = getCumulativeDistances(latLngs);
  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1] ?? 0;

  if (totalDistance <= OCEAN_ROUTE_MIN_DISTANCE_KM) {
    return latLngs.map(() => "land");
  }

  const coastalLandBuffer = Math.min(
    COASTAL_LAND_BUFFER_MAX_KM,
    totalDistance * COASTAL_LAND_BUFFER_RATIO,
  );

  const terrains = latLngs.map(([lat, lng], index) => {
    const distanceFromStart = cumulativeDistances[index] ?? 0;
    const distanceToEnd = totalDistance - distanceFromStart;

    if (
      index === 0 ||
      index === latLngs.length - 1 ||
      distanceFromStart <= coastalLandBuffer ||
      distanceToEnd <= coastalLandBuffer
    ) {
      return "land";
    }

    return classifyPointTerrain(lat, lng);
  });

  let runStart = 0;
  while (runStart < terrains.length) {
    const terrain = terrains[runStart]!;
    let runEnd = runStart + 1;
    while (runEnd < terrains.length && terrains[runEnd] === terrain) {
      runEnd += 1;
    }

    if (
      terrain === "ocean" ||
      terrain === "undersea" ||
      terrain === "mountain_air" ||
      terrain === "hot_desert" ||
      terrain === "cold_desert"
    ) {
      const runDistance =
        (cumulativeDistances[runEnd - 1] ?? 0) -
        (cumulativeDistances[runStart] ?? 0);
      const minDistance =
        terrain === "undersea"
          ? MIN_UNDERSEA_SPAN_KM
          : terrain === "mountain_air"
            ? MIN_MOUNTAIN_AIR_SPAN_KM
            : terrain === "hot_desert"
              ? MIN_HOT_DESERT_SPAN_KM
              : terrain === "cold_desert"
                ? MIN_COLD_DESERT_SPAN_KM
            : MIN_OCEAN_SPAN_KM;
      if (runDistance < minDistance) {
        for (let i = runStart; i < runEnd; i++) {
          terrains[i] = terrain === "undersea" ? "ocean" : "land";
        }
      }
    }

    runStart = runEnd;
  }

  terrains[0] = "land";
  terrains[terrains.length - 1] = "land";
  return terrains;
}

/**
 * Classify the terrain between two waypoints using midpoint land detection.
 * Long legs whose midpoint is offshore are treated as ocean.
 */
export function classifySegment(from: LatLng, to: LatLng): TerrainType {
  const midLat = (from[0] + to[0]) / 2;
  const midLng = normalizeLng((from[1] + to[1]) / 2);
  const dist = distance(point([from[1], from[0]]), point([to[1], to[0]]));

  if (dist > OCEAN_ROUTE_MIN_DISTANCE_KM && isInOcean(midLat, midLng)) {
    return "ocean";
  }

  return "land";
}
