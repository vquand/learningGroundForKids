import assert from 'node:assert/strict';
import test from 'node:test';
import { popupViewportShift, EXPLORE_POPUP_PADDING } from '../src/components/Map/popupViewport.ts';

test('popup fitting preserves an already usable position and keeps edge controls within the reserved play area', () => {
  const viewport = { left: 0, top: 0, right: 1024, bottom: 768 };
  assert.deepEqual(popupViewportShift({ left: 400, top: 200, right: 650, bottom: 450 }, viewport, EXPLORE_POPUP_PADDING), { x: 0, y: 0 });
  for (const popup of [{ left: -100, top: 20, right: 150, bottom: 270 }, { left: 930, top: 550, right: 1180, bottom: 800 }]) {
    const shift = popupViewportShift(popup, viewport, EXPLORE_POPUP_PADDING);
    assert.ok(popup.left + shift.x >= 96 && popup.right + shift.x <= 1000);
    assert.ok(popup.top + shift.y >= 148 && popup.bottom + shift.y <= 640);
  }
});
