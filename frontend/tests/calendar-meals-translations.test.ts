import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CALENDAR_MEALS_UI_TEXT_KEYS } from '../src/components/Calendar/calendarMealsCopy.ts';

test('every meals and medicine interface string has a Vietnamese translation with placeholders intact', async () => {
  const catalog = JSON.parse(await readFile(new URL('../src/i18n/vi.json', import.meta.url), 'utf8')) as Record<string, string>;
  const placeholders = (value: string) => [...value.matchAll(/\{\w+\}/g)].map((match) => match[0]).sort();
  assert.ok(CALENDAR_MEALS_UI_TEXT_KEYS.length > 40);
  for (const key of new Set(CALENDAR_MEALS_UI_TEXT_KEYS)) {
    assert.ok(catalog[key], `Missing Vietnamese meals label: ${key}`);
    assert.deepEqual(placeholders(catalog[key]!), placeholders(key), `Preserve placeholders in ${key}`);
  }
  assert.equal(catalog['Afternoon snack'], 'Bữa xế');
  assert.equal(catalog['Breakfast'], 'Bữa sáng');
});

test('the library button and dialog are named "My favorites" in both languages', async () => {
  const { CALENDAR_MEALS_COPY } = await import('../src/components/Calendar/calendarMealsCopy.ts');
  assert.equal(CALENDAR_MEALS_COPY.myMeals, 'My favorites');
  const vi = JSON.parse(await readFile(new URL('../src/i18n/vi.json', import.meta.url), 'utf8')) as Record<string, string>;
  assert.equal(vi['My favorites'], 'Món yêu thích');
  assert.equal(vi['Set up my favorites'], 'Thiết lập Món yêu thích');
});
