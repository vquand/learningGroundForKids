import type { Excavation } from './types';
import { diggingColumns } from '../../../../server/src/infinidrill/mining.ts';
export interface Cave { readonly start: number; readonly end: number }
export interface WorldViewport {
  readonly width: number; readonly height: number; readonly tileSize: number; readonly cellSize: number;
  readonly columns: number; readonly rows: readonly number[];
  readonly cameraRow: number; readonly skyHeight: number; readonly drillY: number;
}

export function terrainMaterial(row: number): number {
  if (row < 60) return 0;
  if (row < 120) return 1;
  if (row < 200) return 2;
  if (row < 280) return 3;
  if (row < 340) return 4;
  return 5;
}

export function worldViewport(depth: number, width: number, height: number, horizontalReach = 0): WorldViewport {
  const tileSize = Math.min(Math.max(48, height / 10), horizontalReach ? width * 2 / (horizontalReach * 2 + 3) : Infinity);
  const cellSize = tileSize / 2;
  const minimumColumns = Math.ceil(width / cellSize);
  const columns = minimumColumns % 2 ? minimumColumns : minimumColumns + 1;
  const drillY = height * .62;
  const cameraRow = depth - drillY / tileSize;
  const first = Math.floor(cameraRow * 2) / 2;
  const last = (Math.ceil((cameraRow + height / tileSize) * 2) - 1) / 2;
  return {
    width, height, tileSize, cellSize, columns, cameraRow, drillY,
    rows: Array.from({ length: Math.round((last - first) * 2) + 1 }, (_, index) => first + index / 2),
    skyHeight: Math.max(0, Math.min(height, -cameraRow * tileSize)),
  };
}

export function pruneCaves(caves: readonly Cave[], firstVisibleRow: number): readonly Cave[] {
  return caves.filter(cave => cave.end > firstVisibleRow);
}

export function worldCells(view: WorldViewport, depth: number, caves: readonly Cave[], excavations?: readonly Excavation[], laserCuts: readonly Excavation[] = []) {
  const half = Math.floor(view.columns / 2);
  const cells: { row: number; column: number; material: number; cleared: boolean; mined: boolean }[] = [];
  for (const row of view.rows) {
    if (row < 0) continue;
    const behindTip = depth - (row + .25);
    const band = excavations?.find(area => row >= area.from && row < area.to);
    const width = band ?? diggingColumns(0, 0);
    const tipWidth = Math.max(0, Math.floor(behindTip * 2));
    const rowLaserCuts = laserCuts.filter(cut => row >= cut.from && row < cut.to);
    for (let column = -half; column <= half; column++) {
      const x = column / 2;
      const shaft = row + .5 <= depth && (!excavations || !!band) && column >= Math.max(width.left, -tipWidth) && column <= Math.min(width.right, behindTip < 1 ? 0 : tipWidth);
      const cave = caves.some(area => row >= area.start && row < area.end && Math.abs(x) <= (row < area.start + 1 || row >= area.end - 1 ? 2.5 : 3.5));
      const laser = rowLaserCuts.some(cut => column >= cut.left && column <= cut.right);
      const mined = row + .5 <= depth && (!excavations || !!band) && column >= width.left && column <= width.right;
      cells.push({ row, column, material: terrainMaterial(row), cleared: shaft || cave || laser, mined: mined || laser });
    }
  }
  return cells;
}

/** Only boundaries adjacent to visible solid tiles get decorative fragments. */
export function tunnelEdges(cells: ReturnType<typeof worldCells>) {
  const lookup = new Map(cells.map(cell => [`${cell.row}:${cell.column}`, cell]));
  const edges: { row: number; column: number; material: number; side: 'left' | 'right' | 'top' | 'bottom' }[] = [];
  for (const cell of cells) {
    if (!cell.cleared) continue;
    for (const [side, row, column] of [['left', cell.row, cell.column - 1], ['right', cell.row, cell.column + 1], ['top', cell.row - .5, cell.column], ['bottom', cell.row + .5, cell.column]] as const) {
      const adjacent = lookup.get(`${row}:${column}`);
      if (adjacent && !adjacent.cleared) edges.push({ row: cell.row, column: cell.column, material: adjacent.material, side });
    }
  }
  return edges;
}

/** Stable variants stick to world coordinates as rows enter/leave the viewport. */
export function worldVariant(row: number, column: number): number {
  return ((Math.imul(Math.round(row * 2) + 1, 73856093) ^ Math.imul(column + 11, 19349663)) >>> 0) % 3;
}
