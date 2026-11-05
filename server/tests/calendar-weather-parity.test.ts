import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { WEATHER_ICONS } from '../src/calendar/weather-contracts.js';

const catalogUrl = new URL('../../frontend/src/lib/calendarCatalog.ts', import.meta.url);

test('frontend weather icon keys match the server contract in both directions and have artwork', async context => {
  try { await access(catalogUrl); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') { context.skip('Frontend calendar catalog has not been added yet'); return; }
    throw error;
  }
  const frontend = await import(catalogUrl.href) as { WEATHER_ICON_KEYS?: readonly string[] };
  assert.ok(frontend.WEATHER_ICON_KEYS, 'Frontend catalog must export WEATHER_ICON_KEYS');
  assert.equal(new Set(frontend.WEATHER_ICON_KEYS).size, frontend.WEATHER_ICON_KEYS.length);
  assert.deepEqual([...frontend.WEATHER_ICON_KEYS].sort(), [...WEATHER_ICONS].sort());
  assert.deepEqual([...WEATHER_ICONS].sort(), [...frontend.WEATHER_ICON_KEYS].sort());
  for (const key of frontend.WEATHER_ICON_KEYS) {
    await access(new URL(`../../frontend/public/calendar/icons/weather/${key}.webp`, import.meta.url));
  }
});
