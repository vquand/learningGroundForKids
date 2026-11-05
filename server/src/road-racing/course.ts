export const COURSE_LENGTH = 1200;

export const TERRAIN = ['land', 'water', 'fence', 'land', 'water', 'fence', 'land', 'water'] as const;

export function terrainAt(distance: number) {
  return TERRAIN[Math.min(TERRAIN.length - 1, Math.floor(distance / 150))]!;
}
