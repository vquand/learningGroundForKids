import assert from 'node:assert/strict';
import test from 'node:test';
import { earthViewport } from '../src/components/Map/earthViewport.ts';

test('bounded overview and viewport surfaces preserve their Mercator scale', () => {
  for (const zoom of [2, 2.5, 3, 3.01, 4.75, 5, 11, 18]) {
    const world = 256 * 2 ** zoom;
    const min = { x: world * .49, y: world * .45 };
    const max = { x: min.x + 1366, y: min.y + 768 };
    const viewport = earthViewport(min, max, world);
    const [x, y, width, height] = viewport.viewBox.split(' ').map(Number);
    assert.ok(viewport.max.x - viewport.min.x <= (zoom <= 3 ? world : 1366 + 514));
    assert.ok(viewport.max.y - viewport.min.y <= (zoom <= 3 ? world : 768 + 514));
    assert.ok(Math.abs(x! / 720 * world - viewport.min.x) < 1e-6);
    assert.ok(Math.abs(y! / 360 * world - viewport.min.y) < 1e-6);
    assert.ok(Math.abs(width! / 720 * world - (viewport.max.x - viewport.min.x)) < 1e-6);
    assert.ok(Math.abs(height! / 360 * world - (viewport.max.y - viewport.min.y)) < 1e-6);
  }
});

test('the surface clips padding to the canonical world at the date line and Mercator poles', () => {
  const viewport = earthViewport({ x: -100, y: -100 }, { x: 1266, y: 1100 }, 1024);
  assert.equal(viewport.min.x, 0);
  assert.equal(viewport.max.x, 1024);
  assert.equal(viewport.min.y, 0);
  assert.equal(viewport.max.y, 1024);
  assert.equal(viewport.viewBox, '0 0 720 360');
});

test('small overview worlds retain a stable viewBox across button zooms and pans', () => {
  for (const world of [1024, 1448, 2048]) for (const pan of [-256, 0, 256]) {
    const view = earthViewport({ x: world / 2 - 512 + pan, y: world / 2 - 384 + pan },
      { x: world / 2 + 512 + pan, y: world / 2 + 384 + pan }, world);
    assert.equal(view.viewBox, '0 0 720 360');
    assert.equal(view.max.x - view.min.x, world);
  }
});
