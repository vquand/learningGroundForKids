import assert from 'node:assert/strict';
import test from 'node:test';
import { minecraftLayout } from '../src/features/math-quiz-wall/minecraftLayout.ts';

test('block wall fills its area with square tiles and adds rows/columns on larger screens', () => {
  const phone = minecraftLayout(225, 71), desktop = minecraftLayout(674, 221);
  for (const [width, height, layout] of [[225, 71, phone], [674, 221, desktop]] as const) {
    assert.ok(Math.abs(layout.rows * layout.blockSize - height) < .001);
    assert.ok(layout.columns * layout.blockSize >= width);
    assert.ok((layout.columns - 1) * layout.blockSize < width);
    assert.ok(layout.rows >= 2);
  }
  assert.ok(desktop.rows > phone.rows);
  assert.ok(desktop.columns > phone.columns);
});
