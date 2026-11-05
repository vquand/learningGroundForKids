import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CALENDAR_EVENTS_UI_TEXT_KEYS } from '../src/components/Calendar/calendarEventsCopy.ts';

test('every Events view and kid-event editor string has a Vietnamese translation with placeholders intact', async () => {
  const catalog = JSON.parse(await readFile(new URL('../src/i18n/vi.json', import.meta.url), 'utf8')) as Record<string, string>;
  const placeholders = (value: string) => [...value.matchAll(/\{\w+\}/g)].map((match) => match[0]).sort();
  for (const key of new Set(CALENDAR_EVENTS_UI_TEXT_KEYS)) {
    assert.ok(catalog[key], `Missing Vietnamese events label: ${key}`);
    assert.deepEqual(placeholders(catalog[key]!), placeholders(key), `Preserve values in ${key}`);
  }
  assert.equal(catalog['Add event'], 'Thêm sự kiện');
});
