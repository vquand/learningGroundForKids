import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CALENDAR_UI_TEXT_KEYS, CALENDAR_WEEKDAY_KEYS } from '../src/components/Calendar/calendarCopy.ts';

test('every new calendar interface string has a Vietnamese translation with placeholders intact', async () => {
  const catalog = JSON.parse(await readFile(new URL('../src/i18n/vi.json', import.meta.url), 'utf8')) as Record<string, string>;
  const placeholders = (value: string) => [...value.matchAll(/\{\w+\}/g)].map((match) => match[0]).sort();
  for (const key of new Set([...CALENDAR_UI_TEXT_KEYS, ...CALENDAR_WEEKDAY_KEYS])) {
    assert.ok(catalog[key], `Missing Vietnamese calendar label: ${key}`);
    assert.deepEqual(placeholders(catalog[key]!), placeholders(key), `Preserve values in ${key}`);
  }
  assert.equal(catalog['Calendar'], 'Lịch');
  assert.equal(catalog['Plan your study time for this week and next week.'], 'Lên kế hoạch học tập cho tuần này và tuần tới.');
});
