import assert from 'node:assert/strict';
import test from 'node:test';
import { worldViewport, terrainMaterial, worldCells, pruneCaves, tunnelEdges } from '../src/features/infinidrill/world.ts';

test('the camera follows depth smoothly and removes the surface from deep views', () => {
  const start = worldViewport(0, 560, 668);
  assert.ok(start.skyHeight > 0);
  const middle = worldViewport(2.5, 560, 668);
  assert.equal(middle.cameraRow - start.cameraRow, 2.5);
  assert.ok(Math.abs(middle.skyHeight - (start.skyHeight - 2.5 * start.tileSize)) < .000001);
  assert.equal(worldViewport(30, 560, 668).skyHeight, 0);
  assert.equal(worldViewport(8, 588, 1230).skyHeight, 0, 'A tall viewport does not keep showing the surface at depth');
});

test('all rendered rows intersect the viewport and work stays bounded at any depth', () => {
  for (const [width, height] of [[894, 668], [560, 668], [728, 720], [588, 1230]]) {
    const initial = worldViewport(0, width!, height!);
    for (const depth of [0, 2.5, 8, 30, 100, 359, 10_000]) {
      const view = worldViewport(depth, width!, height!);
      assert.ok(view.rows.length <= initial.rows.length + 1);
      for (const row of view.rows) {
        const y = (row - view.cameraRow) * view.tileSize;
        assert.ok(y < height! && y + view.cellSize > 0);
      }
      assert.ok(worldCells(view, depth, []).length <= view.rows.length * view.columns);
    }
  }
});

test('drilled center cells leave a persistent trail with solid material ahead and around it', () => {
  const view = worldViewport(30, 560, 668);
  const cells = worldCells(view, 30, []);
  assert.ok(cells.some(cell => cell.row < 30 && Math.abs(cell.column) === 1 && cell.cleared));
  assert.ok(cells.some(cell => cell.row < 30 && Math.abs(cell.column) >= 4 && !cell.cleared));
  assert.ok(cells.some(cell => cell.row >= 30 && cell.column === 0 && !cell.cleared));
});

test('visual tiles are a 2-by-2 subdivision and excavation narrows to a V', () => {
  const view = worldViewport(30, 560, 668);
  assert.equal(view.cellSize * 2, view.tileSize);
  assert.equal(view.rows[1]! - view.rows[0]!, .5);
  const cells = worldCells(view, 30, []);
  const clearedWidth = (row: number) => cells.filter(cell => cell.row === row && cell.cleared).length;
  assert.equal(clearedWidth(29.5), 1);
  assert.equal(clearedWidth(29), 2);
  assert.equal(clearedWidth(28.5), 3);
  assert.equal(clearedWidth(28), 3);
  assert.equal(clearedWidth(30), 0);
});

test('caves are naturally hollow before arrival and passed cave metadata is removed', () => {
  const caves = [{ start: 10, end: 20 }, { start: 30, end: 40 }];
  const view = worldViewport(8, 560, 668);
  assert.ok(worldCells(view, 8, caves).some(cell => cell.row >= 10 && Math.abs(cell.column) === 2 && cell.cleared));
  assert.deepEqual(pruneCaves(caves, 21), [caves[1]]);
});

test('world materials follow physical depth, including boundaries', () => {
  assert.deepEqual([0, 59, 60, 119, 120, 199, 200, 279, 280, 339, 340].map(terrainMaterial), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
});

test('recorded cuts preserve old widths when a wider head is equipped', () => {
  const view = worldViewport(10, 560, 668);
  const cuts = [{ from: 0, to: 5, left: -1, right: 1 }, { from: 5, to: 10, left: -3, right: 3 }];
  const cells = worldCells(view, 10, [], cuts);
  assert.equal(cells.filter(cell => cell.row === 4 && cell.cleared).length, 3);
  assert.equal(cells.filter(cell => cell.row === 7 && cell.cleared).length, 7);
  assert.equal(cells.filter(cell => cell.row === 10 && cell.cleared).length, 0);
});

test('laser cuts ahead of the machine and tunnel fragments cover the sides and V tip', () => {
  const view = worldViewport(10, 560, 668);
  const cuts = [{ from: 0, to: 10, left: -1, right: 1 }];
  const laser = [{ from: 10, to: 12, left: 1, right: 1 }];
  const cells = worldCells(view, 10, [], cuts, laser);
  assert.ok(cells.find(cell => cell.row === 11 && cell.column === 1)?.cleared);
  assert.equal(cells.find(cell => cell.row === 11 && cell.column === 0)?.cleared, false);
  const edges = tunnelEdges(cells);
  for (const side of ['left', 'right', 'bottom']) assert.ok(edges.some(edge => edge.side === side));
  assert.ok(edges.length <= cells.length * 4);
});

test('untouched wall tiles are never marked mined merely because their depth was passed', () => {
  const cells = worldCells(worldViewport(2, 560, 668), 2, [], [{ from: 0, to: 2, left: -1, right: 1 }]);
  const untouched = cells.find(cell => cell.row === 1 && cell.column === 3)!;
  assert.equal(untouched.cleared, false); assert.equal(untouched.mined, false);
});

test('outer laser range stays visible on laptop and iPad landscape screens', () => {
  for (const [width, height] of [[894, 668], [558, 668], [728, 720]]) {
    const view = worldViewport(20, width!, height!, 11);
    assert.ok(view.columns >= 25);
    assert.ok(width! / 2 - 11.5 * view.cellSize >= 0);
    assert.ok(width! / 2 + 11.5 * view.cellSize <= width!);
  }
});
