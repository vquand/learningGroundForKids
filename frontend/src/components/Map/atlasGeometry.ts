import type { Feature, GeometryObject } from 'geojson';
import { worldCountries, worldLand } from './worldMapData.ts';
import { worldMercatorRingPath } from './worldProjection.ts';
import { WORLD_SURFACE_PALETTE } from './illustratedEarth.ts';
import { prepareSolidBorder } from './solidBorder.ts';

const WORLD_OFFSETS = [-720, 0, 720] as const;

function geometryPolygons(feature: Feature<GeometryObject>): readonly (readonly (readonly number[])[][])[] {
  if (feature.geometry.type === "Polygon") {
    return [feature.geometry.coordinates] as readonly (readonly (readonly number[])[][])[];
  }
  if (feature.geometry.type === "MultiPolygon") {
    return feature.geometry.coordinates as readonly (readonly (readonly number[])[][])[];
  }
  return [];
}

export function featurePath(feature: Feature<GeometryObject>): string {
  return geometryPolygons(feature)
    .flatMap((polygon) => {
      const path = polygon.map((ring) => worldMercatorRingPath(ring)).join(" ");
      const xs = [...path.matchAll(/[ML]([^, ]+),/g)].map((match) => Number(match[1]));
      const minimumX = Math.min(...xs);
      const maximumX = Math.max(...xs);
      // Include only copies intersecting this world. Eurasia's unwrapped ring
      // starts west of x=0, so its +720 copy is essential for the land mask.
      return WORLD_OFFSETS.filter((offset) =>
        maximumX + offset > 0 && minimumX + offset < 720,
      ).map((offset) => path.replace(
        /([ML])([^, ]+),/g,
        (_match, command: string, x: string) => `${command}${Number(x) + offset},`,
      ));
    })
    .join(" ");
}

function buildGeometry() {
  const COUNTRY_PATHS = worldCountries.features
    .map((country, index) => ({
      key: `${String(country.id ?? "country")}-${index}`,
      path: featurePath(country),
      fill: WORLD_SURFACE_PALETTE.land[
        Math.abs(Number(country.id) || index) % WORLD_SURFACE_PALETTE.land.length
      ],
    }))
    .filter((country) => country.path.length > 0)
    .map(country => ({ ...country, border: prepareSolidBorder(country.path) }));

  const LAND_PATH = worldLand.features.map(featurePath).filter(Boolean).join(" ");
  const LAND_BORDER = prepareSolidBorder(LAND_PATH);
  return { COUNTRY_PATHS, LAND_PATH, LAND_BORDER };
}

let geometry: ReturnType<typeof buildGeometry> | undefined;
export function atlasGeometry() {
  return geometry ??= buildGeometry();
}
