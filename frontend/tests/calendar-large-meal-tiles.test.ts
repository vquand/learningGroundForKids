import assert from 'node:assert/strict';
import test from 'node:test';
import { largeMealTileLayout } from '../src/lib/calendarMealHelpers.ts';

test('tablet meals use larger tiles and no more than two columns', () => {
  assert.deepEqual(largeMealTileLayout(166, 180, 4), { tileSize: 64, visible: 4 });
  assert.deepEqual(largeMealTileLayout(104, 106, 8), { tileSize: 51, visible: 3 });
  assert.equal(largeMealTileLayout(300, 300, 8).visible, 8);
});
test('tablet overflow reserves a visible tile for +N and handles empty cells', () => {
  assert.deepEqual(largeMealTileLayout(104, 106, 0), { tileSize: 51, visible: 0 });
  const layout = largeMealTileLayout(104, 106, 8);
  assert.ok(layout.tileSize * 2 + 2 <= 104);
  assert.ok(layout.tileSize * 2 + 2 <= 106);
  assert.equal(layout.visible + 1, 4);
});
