/**
 * Generated art contracts for Infinidrill.
 *
 * Generated terrain rows and drill sprites have uneven spacing; measured source
 * rectangles prevent clipping or showing a neighboring material or part.
 * Every drill row lists starter, tier 1, tier 2, tier 3, tier 4.
 */

export const INFINIDRILL_ASSET_ROOT = '/minigames/infinidrill';

export const LASER_ACCESSORIES_ATLAS = { src: `${INFINIDRILL_ASSET_ROOT}/laser-accessories.png`, width: 2172, height: 724 } as const;
export function laserAccessorySourceRect(tier: number) {
  const x = [25, 564, 1098, 1638][Math.max(0, Math.min(3, tier - 1))]!;
  return { x, y: 97, width: 521, height: 527 };
}

export const DRILL_HEAD_SPIN_ATLAS = {
  src: `${INFINIDRILL_ASSET_ROOT}/drill-head-spin.png`, width: 1402, height: 1122,
  /** Measured rows and mounting-collar offsets, not an assumed regular grid. */
  rows: [
    { y: 33, height: 181, width: 253, x: [72, 415, 753, 1094] },
    { y: 239, height: 183, width: 254, x: [73, 415, 751, 1094] },
    { y: 448, height: 173, width: 265, x: [73, 417, 751, 1090] },
    { y: 659, height: 196, width: 284, x: [68, 415, 751, 1092] },
    { y: 870, height: 215, width: 255, x: [65, 414, 755, 1096] },
  ],
} as const;

export function drillHeadSpinSourceRect(tier: number, frame: number) {
  const row = DRILL_HEAD_SPIN_ATLAS.rows[Math.max(0, Math.min(4, tier))]!;
  return { x: row.x[frame % 4]!, y: row.y, width: row.width, height: row.height };
}

export const TUNNEL_EDGES_ATLAS = {
  src: `${INFINIDRILL_ASSET_ROOT}/tunnel-edges.png`, width: 887, height: 1774,
  columnBounds: [[8, 286], [304, 580], [600, 880]],
  rowBounds: [[104, 263], [348, 525], [620, 819], [899, 1118], [1192, 1406], [1487, 1702]],
} as const;

export function tunnelEdgeSourceRect(material: number, variant: number) {
  const [top, bottom] = TUNNEL_EDGES_ATLAS.rowBounds[Math.max(0, Math.min(5, material))]!;
  const [left, right] = TUNNEL_EDGES_ATLAS.columnBounds[variant % 3]!;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export const TERRAIN_ATLAS = {
  src: `${INFINIDRILL_ASSET_ROOT}/terrain-atlas-v2.png`,
  width: 887,
  height: 1774,
  columns: 3,
  rows: 6,
  rowBounds: [[0, 293], [296, 590], [593, 885], [888, 1181], [1184, 1477], [1480, 1774]],
  columnBounds: [[0, 294], [298, 590], [594, 887]],
  // Row names match increasing Earth depth.
  rowsByDepth: ['dirt', 'packed-dirt', 'rock', 'deep-rock', 'lava-rock', 'core-rock'] as const,
} as const;

export const DRILL_PARTS_ATLAS = {
  src: `${INFINIDRILL_ASSET_ROOT}/drill-parts-atlas-v2.png`,
  width: 1254,
  height: 1254,
  columns: 5,
  rows: 5,
  columnsByTier: ['starter', 'tier-1', 'tier-2', 'tier-3', 'tier-4'] as const,
  rowsBySlot: ['head', 'cabin', 'accessory', 'engine', 'treads'] as const,
  /** Source pixels measured from the alpha mask; this is not a regular grid. */
  sourceRects: {
    head: [[29, 86, 229, 198], [270, 86, 230, 198], [513, 86, 236, 198], [757, 86, 251, 198], [1020, 86, 219, 198]],
    cabin: [[11, 299, 247, 241], [264, 299, 243, 241], [511, 299, 239, 241], [754, 299, 245, 241], [1005, 299, 240, 241]],
    accessory: [[44, 551, 169, 229], [292, 551, 204, 229], [549, 551, 190, 229], [796, 551, 181, 229], [1021, 551, 221, 229]],
    engine: [[11, 800, 241, 188], [262, 800, 239, 188], [513, 800, 240, 188], [763, 800, 240, 188], [1011, 800, 233, 188]],
    treads: [[11, 1017, 253, 165], [265, 1017, 246, 165], [512, 1017, 241, 165], [754, 1017, 249, 165], [1004, 1017, 241, 165]],
  },
  /** Stable normalized attachment anchors, shared by every cell in a row. */
  anchors: {
    head: { x: 0.5, y: 0.5 },
    cabin: { x: 0.5, y: 0.5 },
    accessory: { x: 0.5, y: 0.5 },
    engine: { x: 0.5, y: 0.5 },
    treads: { x: 0.5, y: 0.5 },
  },
} as const;

export type InfinidrillPartSlot = (typeof DRILL_PARTS_ATLAS.rowsBySlot)[number];
export type InfinidrillPartTier = (typeof DRILL_PARTS_ATLAS.columnsByTier)[number];

export function drillPartSourceRect(slot: InfinidrillPartSlot, tier: number) {
  const index = Number.isFinite(tier) ? Math.max(0, Math.min(4, Math.floor(tier))) : 0;
  const rect = DRILL_PARTS_ATLAS.sourceRects[slot][index]!;
  return { x: rect[0], y: rect[1], width: rect[2], height: rect[3] };
}

export function terrainSourceRect(row: number, variant: number) {
  const [top, bottom] = TERRAIN_ATLAS.rowBounds[Math.max(0, Math.min(5, Math.floor(row)))]!;
  const [left, right] = TERRAIN_ATLAS.columnBounds[((Math.floor(variant) % 3) + 3) % 3]!;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
