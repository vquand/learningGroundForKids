import type { Deposit, Excavation, LaserShot } from './types.ts';

/** Columns are visible 3-metre tiles, centred on column zero. */
export function diggingColumns(tier: number, side: number): Pick<Excavation, 'left' | 'right'> {
  const half = 1 + Math.floor(tier / 2);
  return { left: -half - (tier % 2 && side < .5 ? 1 : 0), right: half + (tier % 2 && side >= .5 ? 1 : 0) };
}

/** Coordinate hashing keeps ore stable across camera movement, resize and reload.
 * Each tile has 4% nugget and 1% diamond probability; quantities remain whole. */
export function depositAt(seed: number, row: number, column: number): Deposit['kind'] | null {
  if (row < 0 || row >= 360 || column < -12 || column > 12) return null;
  let hash = seed ^ Math.imul(Math.round(row * 2) + 1, 73856093) ^ Math.imul(column + 11, 19349663);
  hash = Math.imul(hash ^ hash >>> 16, 0x45d9f3b);
  hash = Math.imul(hash ^ hash >>> 16, 0x45d9f3b);
  const roll = ((hash ^ hash >>> 16) >>> 0) / 2 ** 32;
  return roll < .04 ? 'nuggets' : roll < .05 ? 'crystals' : null;
}

export function mineDeposits(seed: number, from: number, to: number, columns: Pick<Excavation, 'left' | 'right'>): Deposit[] {
  const deposits: Deposit[] = [];
  for (let row = from; row < to; row += .5) for (let column = columns.left; column <= columns.right; column++) {
    const kind = depositAt(seed, row, column);
    if (kind) deposits.push({ row, column, kind });
  }
  return deposits;
}

const LASER_DEPTH_TILES = [2, 4, 4, 6] as const;

export function laserHorizontalReach(headTier: number, laserTier: number): number {
  return laserTier ? 1 + Math.ceil(headTier / 2) + LASER_DEPTH_TILES[laserTier - 1]! + (laserTier >= 3 ? 2 : 0) : 0;
}

export function laserShotFromCuts(steps: readonly Excavation[]): LaserShot | null {
  return steps.length ? { from: steps[0]!.from, to: steps.at(-1)!.to, left: Math.min(...steps.map(step => step.left)), right: Math.max(...steps.map(step => step.right)), steps } : null;
}

export function laserCut(tier: number, from: number, side: number, limit: number, footprint: Pick<Excavation, 'left' | 'right'>): LaserShot | null {
  if (!tier || from >= limit) return null;
  const radius = Math.max(Math.abs(footprint.left), Math.abs(footprint.right));
  const width = tier >= 3 ? 3 : 1;
  const steps: Excavation[] = [];
  for (let row = 0; row < LASER_DEPTH_TILES[tier - 1]! && from + row / 2 < limit; row++) {
    const right = side < .5 ? -radius - 1 - row : radius + row + width;
    steps.push({ from: from + row / 2, to: Math.min(limit, from + (row + 1) / 2), left: right - width + 1, right });
  }
  return laserShotFromCuts(steps);
}

/** Both the main cutter and laser share the same deposit map and deduplication. */
export function newlyMinedDeposits(seed: number, cuts: readonly Excavation[], previousCuts: readonly Excavation[]): Deposit[] {
  const seen = new Set<string>();
  return cuts.flatMap(cut => mineDeposits(seed, cut.from, cut.to, cut)).filter(deposit => {
    const key = `${deposit.row}:${deposit.column}`;
    if (seen.has(key) || previousCuts.some(cut => deposit.row >= cut.from && deposit.row < cut.to && deposit.column >= cut.left && deposit.column <= cut.right)) return false;
    seen.add(key);
    return true;
  });
}
