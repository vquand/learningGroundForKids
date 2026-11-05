import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';
import { STUDY_CATALOG, STUDY_GROUP_BY_KEY, STUDY_KEYS, WEATHER_ICON_CATALOG, WEATHER_ICON_KEYS, WEATHER_ICON_LOOKUP } from '../src/lib/calendarCatalog.ts';

test('calendar study catalog has the 55 unique manifest entries and artwork', async () => {
  assert.equal(STUDY_CATALOG.length, 55);
  assert.equal(new Set(STUDY_KEYS).size, 55);
  assert.deepEqual(Object.keys(STUDY_GROUP_BY_KEY).sort(), [...STUDY_KEYS].sort());
  assert.deepEqual(
    Object.values(STUDY_GROUP_BY_KEY).reduce<Record<string, number>>((counts, group) => ({ ...counts, [group]: (counts[group] ?? 0) + 1 }), {}),
    { subject: 24, pe: 12, club: 19 },
  );
  for (const entry of STUDY_CATALOG) {
    assert.ok(entry.art.endsWith(`/calendar/icons/study/${entry.key}.webp`));
    await access(new URL(`../public/calendar/icons/study/${entry.key}.webp`, import.meta.url));
  }
});

test('calendar weather catalog mirrors all twelve icon labels and artwork', async () => {
  assert.equal(WEATHER_ICON_KEYS.length, 12);
  assert.equal(new Set(WEATHER_ICON_KEYS).size, 12);
  assert.equal(WEATHER_ICON_CATALOG.length, 12);
  for (const key of WEATHER_ICON_KEYS) {
    const entry = WEATHER_ICON_LOOKUP[key];
    assert.equal(entry.key, key);
    assert.ok(entry.en);
    assert.ok(entry.vi);
    assert.equal(entry.art, `/calendar/icons/weather/${key}.webp`);
    await access(new URL(`../public${entry.art}`, import.meta.url));
  }
});
