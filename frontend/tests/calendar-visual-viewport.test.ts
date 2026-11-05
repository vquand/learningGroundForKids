import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { KEYBOARD_MIN_SHRINK_PX, visualViewportCssProperties, visualViewportFit } from '../src/lib/calendarVisualViewport.ts';

test('no fit unless the visual viewport is at least 120 px shorter than the layout viewport', () => {
  assert.equal(visualViewportFit({ height: 768, offsetTop: 0 }, 768), null, 'desktop: nothing changes');
  assert.equal(visualViewportFit({ height: 649, offsetTop: 0 }, 768), null, '119 px shorter is not the keyboard');
  assert.equal(visualViewportFit({ height: 648, offsetTop: 0 }, 768)?.height, 648, 'exactly 120 px shorter counts as open');
  assert.equal(KEYBOARD_MIN_SHRINK_PX, 120);
});

test('an open keyboard yields the visible height, the top offset and the inset below the visible area', () => {
  assert.deepEqual(visualViewportFit({ height: 400, offsetTop: 0 }, 820), { height: 400, top: 0, inset: 420 });
  assert.deepEqual(visualViewportFit({ height: 400, offsetTop: 36.4 }, 820), { height: 400, top: 36, inset: 384 });
});

test('invalid samples never produce variables', () => {
  assert.equal(visualViewportFit(null, 820), null);
  assert.equal(visualViewportFit(undefined, 820), null);
  assert.equal(visualViewportFit({ height: Number.NaN, offsetTop: 0 }, 820), null);
  assert.equal(visualViewportFit({ height: 400, offsetTop: Number.POSITIVE_INFINITY }, 820), null);
  assert.equal(visualViewportFit({ height: 0, offsetTop: 0 }, 820), null);
  assert.equal(visualViewportFit({ height: 400, offsetTop: 0 }, 0), null);
});

test('a negative offset clamps to zero and the inset never goes negative', () => {
  assert.deepEqual(visualViewportFit({ height: 400, offsetTop: -10 }, 820), { height: 400, top: 0, inset: 420 });
  assert.equal(visualViewportFit({ height: 400, offsetTop: 500 }, 820)?.inset, 0);
});

test('CSS custom properties exist only for a fit, so clearing them restores the desktop layout', () => {
  assert.equal(visualViewportCssProperties(null), null);
  assert.deepEqual(visualViewportCssProperties({ height: 400, top: 0, inset: 420 }), {
    '--calendar-vv-height': '400px',
    '--calendar-vv-top': '0px',
    '--calendar-vv-inset': '420px',
  });
});

test('calendar dialogs read the viewport variables and fall back to the unchanged desktop geometry', async () => {
  const read = (name: string) => readFile(new URL(`../src/components/Calendar/${name}`, import.meta.url), 'utf8');
  const calendar = await read('Calendar.css');
  const meals = await read('Meals.css');
  assert.match(calendar, /\.calendar-editor \{[^}]*top: var\(--calendar-vv-top, var\(--calendar-header-height\)\)/);
  assert.match(calendar, /\.calendar-editor \{[^}]*bottom: calc\(8px \+ var\(--calendar-vv-inset, 0px\)\)/);
  assert.match(calendar, /\.calendar-editor \{[^}]*max-height: var\(--calendar-vv-height, 100dvh\)/);
  assert.match(calendar, /top: auto; right: 8px; bottom: calc\(8px \+ var\(--calendar-vv-inset, 0px\)\);/, 'portrait drawer follows the keyboard');
  assert.match(meals, /\.meal-dialog-backdrop \{[^}]*top: var\(--calendar-vv-top, 0px\)/);
  assert.match(meals, /\.meal-dialog-backdrop \{[^}]*bottom: var\(--calendar-vv-inset, 0px\)/);
  assert.match(meals, /max-height: calc\(var\(--calendar-vv-height, 100dvh\) - 24px\)/);
});
