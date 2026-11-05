import { worldMercatorPoint } from "./worldProjection.ts";

export type TerrainDetail = "fill" | "detail";

export const WORLD_SURFACE_PALETTE = {
  ocean: "#c7dfe2",
  land: ["#e8edcf", "#e3ead0", "#eef0da"],
  coast: "#d8e9df",
} as const;


interface EllipticalBiomeRegion {
  id: string;
  center: readonly [longitude: number, latitude: number];
  radius: readonly [longitude: number, latitude: number];
  /** Stable biome family metadata; the 2D renderer intentionally uses color only. */
  texture: string;
  fill: string;
}

export type ForestRegion = EllipticalBiomeRegion;
export type TerrainRegion = EllipticalBiomeRegion;

/** Broad, intentionally simplified biome belts clipped to real land geometry. */
export const MAJOR_FOREST_REGIONS: readonly ForestRegion[] = [
  { id: "amazon", center: [-62, -4], radius: [24, 12], texture: "tropical-canopy", fill: "#d4e6c5" },
  { id: "atlantic-forest", center: [-48, -22], radius: [7, 10], texture: "tropical-canopy", fill: "#d4e6c5" },
  { id: "central-america", center: [-87, 15], radius: [7, 9], texture: "tropical-canopy", fill: "#d4e6c5" },
  { id: "eastern-united-states", center: [-82, 37], radius: [12, 10], texture: "seasonal-canopy", fill: "#e5e5c8" },
  { id: "pacific-northwest", center: [-123, 47], radius: [5, 10], texture: "temperate-canopy", fill: "#dce7cd" },
  { id: "canada", center: [-105, 56], radius: [45, 13], texture: "boreal-canopy", fill: "#d8e4d6" },
  { id: "alaska", center: [-151, 61], radius: [13, 8], texture: "boreal-canopy", fill: "#d8e4d6" },
  { id: "congo", center: [21, 0], radius: [14, 10], texture: "tropical-canopy", fill: "#d4e6c5" },
  { id: "west-africa", center: [-6, 8], radius: [10, 5], texture: "tropical-canopy", fill: "#d4e6c5" },
  { id: "madagascar", center: [47, -19], radius: [4, 9], texture: "tropical-canopy", fill: "#d4e6c5" },
  { id: "south-african-coast", center: [27, -30], radius: [7, 5], texture: "seasonal-canopy", fill: "#e5e5c8" },
  { id: "western-europe", center: [0, 50], radius: [9, 7], texture: "seasonal-canopy", fill: "#e5e5c8" },
  { id: "central-europe", center: [14, 50], radius: [10, 7], texture: "seasonal-canopy", fill: "#e5e5c8" },
  { id: "eastern-europe", center: [30, 53], radius: [15, 9], texture: "temperate-canopy", fill: "#dce7cd" },
  { id: "balkan-forests", center: [23, 44], radius: [8, 6], texture: "seasonal-canopy", fill: "#e5e5c8" },
  { id: "mediterranean-woodlands", center: [15, 38], radius: [22, 5], texture: "seasonal-canopy", fill: "#e5e5c8" },
  { id: "scandinavia", center: [18, 63], radius: [13, 10], texture: "boreal-canopy", fill: "#d8e4d6" },
  { id: "siberia", center: [94, 60], radius: [54, 13], texture: "boreal-canopy", fill: "#d8e4d6" },
  { id: "far-east-russia", center: [137, 55], radius: [16, 12], texture: "boreal-canopy", fill: "#d8e4d6" },
  { id: "anatolia-caucasus", center: [41, 41], radius: [11, 5], texture: "seasonal-canopy", fill: "#e5e5c8" },
  { id: "himalayan-foothills", center: [83, 28], radius: [15, 5], texture: "temperate-canopy", fill: "#dce7cd" },
  { id: "india", center: [79, 20], radius: [9, 8], texture: "tropical-canopy", fill: "#d4e6c5" },
  { id: "indochina", center: [104, 16], radius: [8, 10], texture: "tropical-canopy", fill: "#d4e6c5" },
  { id: "malay-peninsula", center: [102, 5], radius: [4, 9], texture: "tropical-canopy", fill: "#d4e6c5" },
  { id: "borneo", center: [114, 1], radius: [7, 7], texture: "tropical-canopy", fill: "#d4e6c5" },
  { id: "sumatra", center: [101, -2], radius: [4, 11], texture: "tropical-canopy", fill: "#d4e6c5" },
  { id: "java", center: [110, -7], radius: [9, 3], texture: "tropical-canopy", fill: "#d4e6c5" },
  { id: "philippines", center: [122, 12], radius: [5, 9], texture: "tropical-canopy", fill: "#d4e6c5" },
  { id: "new-guinea", center: [143, -5], radius: [10, 6], texture: "tropical-canopy", fill: "#d4e6c5" },
  { id: "manchuria-korea", center: [127, 42], radius: [9, 8], texture: "seasonal-canopy", fill: "#e5e5c8" },
  { id: "china", center: [111, 29], radius: [13, 9], texture: "temperate-canopy", fill: "#dce7cd" },
  { id: "japan", center: [138, 37], radius: [5, 7], texture: "seasonal-canopy", fill: "#e5e5c8" },
  { id: "east-african-woodlands", center: [37, -5], radius: [5, 12], texture: "seasonal-canopy", fill: "#e5e5c8" },
  { id: "miombo-woodlands", center: [27, -14], radius: [9, 5], texture: "seasonal-canopy", fill: "#e5e5c8" },
  { id: "northern-australian-woodlands", center: [133, -14], radius: [18, 4], texture: "seasonal-canopy", fill: "#e5e5c8" },
  { id: "eastern-australia", center: [147, -28], radius: [7, 14], texture: "temperate-canopy", fill: "#dce7cd" },
  { id: "southwestern-australian-woodlands", center: [117, -33], radius: [3, 3], texture: "seasonal-canopy", fill: "#e5e5c8" },
  { id: "new-zealand", center: [172, -42], radius: [5, 8], texture: "temperate-canopy", fill: "#dce7cd" },
  { id: "patagonian-forest", center: [-72, -42], radius: [4, 9], texture: "temperate-canopy", fill: "#dce7cd" },
] as const;

export const DESERT_REGIONS: readonly TerrainRegion[] = [
  { id: "sahara", center: [14, 24], radius: [31, 11], texture: "sandy-desert", fill: "#d9bd87" },
  { id: "arabian", center: [47, 23], radius: [13, 8], texture: "rocky-desert", fill: "#c9a576" },
  { id: "gobi", center: [103, 42], radius: [16, 7], texture: "rocky-desert", fill: "#c7aa7a" },
  { id: "australian-outback", center: [133, -25], radius: [18, 11], texture: "sandy-desert", fill: "#d3ad78" },
  { id: "kalahari", center: [22, -24], radius: [10, 8], texture: "sandy-desert", fill: "#d2ae79" },
  { id: "atacama", center: [-70, -23], radius: [4, 11], texture: "rocky-desert", fill: "#c49d70" },
  { id: "north-american-deserts", center: [-113, 33], radius: [12, 8], texture: "rocky-desert", fill: "#cba778" },
  { id: "thar", center: [71, 27], radius: [7, 5], texture: "sandy-desert", fill: "#d9bd87" },
  { id: "central-asian-deserts", center: [62, 41], radius: [12, 7], texture: "rocky-desert", fill: "#c7aa7a" },
  { id: "namib", center: [15, -24], radius: [4, 9], texture: "sandy-desert", fill: "#d2ae79" },
  { id: "patagonian-desert", center: [-68, -44], radius: [7, 8], texture: "rocky-desert", fill: "#c49d70" },
] as const;

export const ICE_REGIONS: readonly TerrainRegion[] = [
  { id: "greenland", center: [-42, 74], radius: [20, 14], texture: "polar-ice", fill: "#e8eeee" },
  { id: "canadian-arctic", center: [-103, 76], radius: [31, 9], texture: "tundra", fill: "#cbd0c4" },
  { id: "eurasian-arctic", center: [83, 74], radius: [55, 9], texture: "tundra", fill: "#cbd0c4" },
  { id: "antarctica", center: [0, -82], radius: [180, 15], texture: "polar-ice", fill: "#edf2f1" },
] as const;

export function terrainDetailForZoom(zoom: number): TerrainDetail {
  return zoom >= 5 ? "detail" : "fill";
}

export function ellipticalRegionPoints(region: EllipticalBiomeRegion): [number, number][] {
  return Array.from({ length: 40 }, (_, index) => {
    const angle = (index / 40) * Math.PI * 2;
    return worldMercatorPoint(
      region.center[0] + Math.cos(angle) * region.radius[0],
      region.center[1] + Math.sin(angle) * region.radius[1],
    );
  });
}

export function ellipticalRegionPath(region: EllipticalBiomeRegion): string {
  const points = ellipticalRegionPoints(region);
  return `${points.map(([x, y], index) => `${index ? "L" : "M"}${x},${y}`).join(" ")} Z`;
}

export function forestRegionPath(region: ForestRegion): string {
  return ellipticalRegionPath(region);
}
