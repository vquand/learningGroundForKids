import type { Feature, GeometryObject, MultiPolygon, Polygon } from "geojson";

type GlobeRing = readonly (readonly [number, number])[];

export interface GlobeLandPolygon {
  outer: GlobeRing;
  holes: readonly GlobeRing[];
}

function geometryPolygons(geometry: GeometryObject | null): readonly unknown[] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [(geometry as Polygon).coordinates];
  if (geometry.type === "MultiPolygon") return (geometry as MultiPolygon).coordinates;
  return [];
}

function validRing(value: unknown): GlobeRing | null {
  if (!Array.isArray(value)) return null;
  const coordinates = value
    .filter((point): point is readonly [number, number] =>
      Array.isArray(point) &&
      typeof point[0] === "number" &&
      typeof point[1] === "number" &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]),
    )
    .map(([longitude, latitude]) => [longitude, latitude] as const);
  if (coordinates.length < 3) return null;
  return coordinates;
}

export function getGlobeLandPolygons(
  features: readonly Feature<GeometryObject | null>[],
): readonly GlobeLandPolygon[] {
  return features.flatMap((feature) =>
    geometryPolygons(feature.geometry).flatMap((polygon) => {
      if (!Array.isArray(polygon)) return [];
      const rings = polygon.map(validRing).filter(
        (ring): ring is GlobeRing => ring !== null,
      );
      const [outer, ...holes] = rings;
      return outer ? [{ outer, holes }] : [];
    }),
  );
}
