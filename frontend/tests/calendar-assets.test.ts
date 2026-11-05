import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { CALENDAR_TIME_ICONS, STUDY_CATALOG, WEATHER_ICON_CATALOG } from '../src/lib/calendarCatalog.ts';
import { GENERIC_EVENT_CATALOG, SYSTEM_EVENT_CATALOG } from '../src/lib/calendarEventCatalog.ts';
import { MEAL_FOOD_CATALOG, MEDICINE_METHOD_CATALOG } from '../src/lib/calendarMealCatalog.ts';

const publicDir = new URL('../public', import.meta.url).pathname;
const file = (art: string) => `${publicDir}${art}`;

const groups: [string, readonly { key: string; art: string }[]][] = [
  ['study', STUDY_CATALOG], ['weather', WEATHER_ICON_CATALOG], ['meals', MEAL_FOOD_CATALOG],
  ['medicine', MEDICINE_METHOD_CATALOG], ['system events', SYSTEM_EVENT_CATALOG], ['generic events', GENERIC_EVENT_CATALOG],
];

for (const [name, entries] of groups) {
  test(`every ${name} catalog entry has its icon file`, () => {
    assert.ok(entries.length > 0);
    const missing = entries.filter((entry) => !existsSync(file(entry.art))).map((entry) => entry.key);
    assert.deepEqual(missing, [], `missing ${name} icons`);
    for (const entry of entries) assert.ok(statSync(file(entry.art)).size < 40_000, `${entry.art} is too large`);
  });
}

test('sunrise and sunset icons exist', () => {
  for (const art of Object.values(CALENDAR_TIME_ICONS)) assert.ok(existsSync(file(art)), art);
});

test('the icon manifest lists exactly the icons the catalogs reference', () => {
  const manifest = JSON.parse(readFileSync(`${publicDir}/calendar/icons/manifest.json`, 'utf8')) as { key: string; group: string }[];
  const keys = new Map<string, number>();
  for (const entry of manifest) keys.set(`${entry.group}:${entry.key}`, (keys.get(`${entry.group}:${entry.key}`) ?? 0) + 1);
  assert.deepEqual([...keys].filter(([, count]) => count > 1).map(([key]) => key), [], 'duplicate manifest entries');
  const referenced = new Set<string>([
    ...STUDY_CATALOG.map((e) => `study:${e.key}`), ...WEATHER_ICON_CATALOG.map((e) => `weather:${e.key}`),
    ...MEAL_FOOD_CATALOG.map((e) => `meal:${e.key}`), ...MEDICINE_METHOD_CATALOG.map((e) => `medicine:${e.key}`),
    ...SYSTEM_EVENT_CATALOG.map((e) => `system_event:${e.key}`), ...GENERIC_EVENT_CATALOG.map((e) => `event:${e.key}`),
    'time:sunrise', 'time:sunset',
  ]);
  const listed = new Set(keys.keys());
  assert.deepEqual([...referenced].filter((key) => !listed.has(key)), [], 'catalog icons missing from the manifest');
  assert.deepEqual([...listed].filter((key) => !referenced.has(key)), [], 'manifest entries nothing references');
});

test('the Study, Meals and Events tab icons exist', () => {
  for (const name of ['tab_study', 'tab_meals', 'tab_events']) assert.ok(existsSync(file(`/calendar/icons/ui/${name}.webp`)), name);
});

test('the empty-dish artwork exists and the Meals view uses it for empty cells', () => {
  assert.ok(existsSync(file('/calendar/icons/ui/empty_dish.webp')));
  const source = readFileSync(new URL('../src/components/Calendar/MealsView.tsx', import.meta.url), 'utf8');
  assert.match(source, /MEAL_EMPTY_DISH_ART = '\/calendar\/icons\/ui\/empty_dish\.webp'/);
  assert.match(source, /className="meal-empty-dish"/);
  // The text stays available to screen readers instead of being removed.
  assert.match(source, /className="meal-empty-label"/);
});
