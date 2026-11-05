import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { createCalendarRepository } from '../../src/calendar/repository.js';
import { createMealLibraryRepository } from '../../src/calendar/meals.js';
import { LIBRARY_CAP as MEAL_LIBRARY_CAP, MEAL_FOOD_KEYS } from '../../src/calendar/catalog.js';
import type { CalendarWindow } from '../../src/calendar/contracts.js';
import { AppError } from '../../src/errors.js';

const configured = process.env.TEST_DATABASE_URL;
const skip = configured ? false : 'TEST_DATABASE_URL is not configured';
const monday = new Date('2026-10-26T00:00:00Z');
const isError = (code: string, status: number) => (error: unknown) => error instanceof AppError && error.code === code && error.status === status;

// Each test gets its own family and profiles, so runs never share library or list rows.
async function fixture(count: number) {
  const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(configured!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((value): value is string => !!value)) });
  const family = randomUUID();
  const profiles = Array.from({ length: count }, () => randomUUID());
  await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
  await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)', [family, `${family}@calendar-meals.test`, 'Test', 'unused']);
  for (const id of profiles) await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)', [id, family, 'Kid', '⭐', '#456']);
  return {
    pool, profiles,
    meals: createMealLibraryRepository(pool),
    calendar: createCalendarRepository(pool),
    async count(profileId: string) { return (await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM calendar_meal_library WHERE profile_id=$1', [profileId])).rows[0]?.n; },
    async close() { await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end(); },
  };
}

function day(window: CalendarWindow, date: string) {
  const found = window.weeks.flatMap(week => week.days).find(entry => entry.date === date);
  assert.ok(found, `missing ${date}`);
  return found;
}

test('favorites and eye/nose-drop reminders survive independent repository reads', { skip }, async () => {
  const f = await fixture(2);
  const [profile, sibling] = f.profiles as [string, string];
  const otherPool = new Pool({ connectionString: assertSafeTestDatabaseUrl(configured!, []) });
  try {
    const saved = (await f.meals.add(profile, { food: 'pho', custom_name: 'Phở bò' })).item;
    const otherDevice = createCalendarRepository(otherPool);
    assert.deepEqual((await otherDevice.read(profile, monday)).meal_library, [saved]);
    assert.deepEqual((await otherDevice.read(sibling, monday)).meal_library, []);
    const second = (await createMealLibraryRepository(otherPool).add(profile, { food: 'eggs' })).item;
    assert.deepEqual((await f.calendar.read(profile, monday)).meal_library, [saved, second]);
    const items = [{ medicine: { method: 'eye_nose_drops' as const, color: 'blue' as const, qty: 1 } }];
    await f.calendar.upsert(profile, { scope: 'template', weekday: 1, area: 'medicine', items, expected_revision: 0 }, monday);
    assert.deepEqual(day(await otherDevice.read(profile, monday), '2026-10-26').lists.medicine.items, items);
  } finally { await otherPool.end(); await f.close(); }
});

test('favorite name/icon edits are owned, detect conflicts, deduplicate and preserve scheduled names', { skip }, async () => {
  const f = await fixture(2);
  const [profile, sibling] = f.profiles as [string, string];
  try {
    const saved = (await f.meals.add(profile, { food: 'fish', custom_name: 'Fish rice' })).item;
    await f.calendar.upsert(profile, { scope: 'template', weekday: 1, area: 'meal_lunch', items: [{ food: 'custom', icon: 'fish', name: 'Fish rice' }], expected_revision: 0 }, monday);
    assert.ok(f.meals.update);
    const input = { food: 'grilled_fish' as const, custom_name: 'Grilled fish rice', expected_food: saved.food_key, expected_name: saved.custom_name };
    await assert.rejects(f.meals.update(sibling, saved.id, input), isError('CALENDAR_MEAL_NOT_FOUND', 404));
    const updated = await f.meals.update(profile, saved.id, input);
    assert.equal(updated.food_key, 'grilled_fish');
    await assert.rejects(f.meals.update(profile, saved.id, input), isError('CALENDAR_REVISION_CONFLICT', 409));
    const window = await f.calendar.read(profile, monday);
    assert.deepEqual(day(window, '2026-10-26').lists.meal_lunch.items, [{ food: 'custom', icon: 'fish', name: 'Fish rice' }]);
    const duplicate = (await f.meals.add(profile, { food: 'rice' })).item;
    const merged = await f.meals.update(profile, saved.id, { food: 'rice', expected_food: updated.food_key, expected_name: updated.custom_name });
    assert.equal(merged.id, duplicate.id);
    assert.equal(await f.count(profile), 1);
  } finally { await f.close(); }
});

test('library add is idempotent per food and custom name and lists rows in creation order', { skip }, async () => {
  const f = await fixture(1);
  const [profile] = f.profiles as [string];
  try {
    const first = await f.meals.add(profile, { food: 'rice' });
    assert.equal(first.created, true);
    assert.deepEqual(first.item, { id: first.item.id, food_key: 'rice', custom_name: null });
    const again = await f.meals.add(profile, { food: 'rice' });
    assert.equal(again.created, false); assert.deepEqual(again.item, first.item);
    const named = await f.meals.add(profile, { food: 'rice', custom_name: 'Grandma rice' });
    assert.equal(named.created, true); assert.notEqual(named.item.id, first.item.id);
    assert.equal((await f.meals.add(profile, { food: 'rice', custom_name: 'Grandma rice' })).created, false);
    const window = await f.calendar.read(profile, monday);
    assert.deepEqual(window.meal_library, [first.item, named.item]);
    assert.deepEqual(Object.keys(window.meal_library[0] ?? {}).sort(), ['custom_name', 'food_key', 'id']);
  } finally { await f.close(); }
});

test('library cap rejects the 61st row while existing entries stay idempotent', { skip }, async () => {
  const f = await fixture(1);
  const [profile] = f.profiles as [string];
  try {
    for (let index = 0; index < MEAL_LIBRARY_CAP; index++) {
      const food = MEAL_FOOD_KEYS[index % MEAL_FOOD_KEYS.length]!;
      const result = await f.meals.add(profile, index < MEAL_FOOD_KEYS.length ? { food } : { food, custom_name: `Name ${index}` });
      assert.equal(result.created, true, `row ${index}`);
    }
    assert.equal(await f.count(profile), MEAL_LIBRARY_CAP);
    await assert.rejects(() => f.meals.add(profile, { food: 'cake', custom_name: 'Extra' }), isError('CALENDAR_LIBRARY_FULL', 422));
    assert.equal((await f.meals.add(profile, { food: 'rice' })).created, false, 'existing entries are not new cap usage');
    assert.equal(await f.count(profile), MEAL_LIBRARY_CAP);
    assert.equal((await f.calendar.read(profile, monday)).meal_library.length, MEAL_LIBRARY_CAP);
  } finally { await f.close(); }
});

test('parallel adds at the cap never exceed 60 rows and identical parallel adds create one row', { skip }, async () => {
  const f = await fixture(2);
  const [profile, other] = f.profiles as [string, string];
  try {
    const distinct = await Promise.allSettled(Array.from({ length: 80 }, (_, index) => f.meals.add(profile, { food: 'pho', custom_name: `Dish ${index}` })));
    assert.equal(distinct.filter(result => result.status === 'fulfilled').length, MEAL_LIBRARY_CAP);
    for (const result of distinct) if (result.status === 'rejected') assert.ok(isError('CALENDAR_LIBRARY_FULL', 422)(result.reason));
    assert.equal(await f.count(profile), MEAL_LIBRARY_CAP);
    const identical = await Promise.all(Array.from({ length: 12 }, () => f.meals.add(other, { food: 'noodles', custom_name: 'Mì' })));
    assert.equal(identical.filter(result => result.created).length, 1);
    assert.equal(new Set(identical.map(result => result.item.id)).size, 1);
    assert.equal(await f.count(other), 1);
  } finally { await f.close(); }
});

test('library remove deletes only the owner row and returns 404 for foreign, sibling or repeated ids', { skip }, async () => {
  const f = await fixture(2);
  const [profile, sibling] = f.profiles as [string, string];
  try {
    const mine = await f.meals.add(profile, { food: 'pho' });
    const theirs = await f.meals.add(sibling, { food: 'pho' });
    await assert.rejects(() => f.meals.remove(profile, theirs.item.id), isError('CALENDAR_MEAL_NOT_FOUND', 404));
    await assert.rejects(() => f.meals.remove(profile, 'unknown-meal'), isError('CALENDAR_MEAL_NOT_FOUND', 404));
    assert.equal(await f.count(sibling), 1);
    await f.meals.remove(profile, mine.item.id);
    assert.equal(await f.count(profile), 0);
    await assert.rejects(() => f.meals.remove(profile, mine.item.id), isError('CALENDAR_MEAL_NOT_FOUND', 404));
    assert.equal((await f.calendar.read(sibling, monday)).meal_library.length, 1);
    assert.equal((await f.calendar.read(profile, monday)).meal_library.length, 0);
  } finally { await f.close(); }
});

test('meal and medicine lists round trip through the calendar window, and library removal never edits them', { skip }, async () => {
  const f = await fixture(1);
  const [profile] = f.profiles as [string];
  const lunch = [
    { food: 'rice' },
    { food: 'custom', icon: 'pho', name: 'Grandma soup' },
    { medicine: { method: 'tablet', color: 'red', qty: 2, dose: '100 ml' } },
  ];
  const medicineRow = [{ medicine: { method: 'drops', color: 'blue', qty: 1 } }];
  try {
    const rice = await f.meals.add(profile, { food: 'rice' });
    await f.meals.add(profile, { food: 'pho', custom_name: 'Mom soup' });
    const savedLunch = await f.calendar.upsert(profile, { scope: 'template', weekday: 1, area: 'meal_lunch', items: lunch, expected_revision: 0 }, monday);
    assert.equal(savedLunch.revision, 1); assert.deepEqual(savedLunch.items, lunch);
    const savedMedicine = await f.calendar.upsert(profile, { scope: 'template', weekday: 1, area: 'medicine', items: medicineRow, expected_revision: 0 }, monday);
    assert.deepEqual(savedMedicine.items, medicineRow);

    let window = await f.calendar.read(profile, monday);
    assert.deepEqual(window.templates['1'].meal_lunch.items, lunch);
    assert.deepEqual(window.templates['1'].medicine.items, medicineRow);
    assert.deepEqual(day(window, '2026-10-26').lists.meal_lunch.items, lunch);
    assert.deepEqual(day(window, '2026-10-26').lists.medicine.items, medicineRow);
    assert.equal(window.meal_library.length, 2);

    // Medicine entries are also valid inside a meal slot, with the same strict shape.
    const dinner = await f.calendar.upsert(profile, { scope: 'date', date: '2026-10-27', area: 'meal_dinner', items: [{ food: 'soup' }, { medicine: { method: 'syrup', color: 'pink', qty: 1, dose: '5 ml' } }], expected_revision: 0 }, monday);
    assert.equal(dinner.source, 'override');
    window = await f.calendar.read(profile, monday);
    assert.equal(day(window, '2026-10-27').lists.meal_dinner.source, 'override');
    assert.deepEqual(day(window, '2026-10-27').lists.meal_dinner.items, [{ food: 'soup' }, { medicine: { method: 'syrup', color: 'pink', qty: 1, dose: '5 ml' } }]);

    // Removing a library row (lists store catalog keys) leaves every list untouched.
    await f.meals.remove(profile, rice.item.id);
    const after = await f.calendar.read(profile, monday);
    assert.deepEqual(after.templates['1'].meal_lunch.items, lunch);
    assert.deepEqual(day(after, '2026-10-26').lists.meal_lunch.items, lunch);
    assert.deepEqual(after.meal_library.map(item => item.food_key), ['pho']);
  } finally { await f.close(); }
});

test('library reads are scoped to the authorized profile and drop corrupt stored rows', { skip }, async () => {
  const f = await fixture(2);
  const [profile, sibling] = f.profiles as [string, string];
  try {
    const first = await f.meals.add(profile, { food: 'banh_mi' });
    await f.meals.add(profile, { food: 'tea', custom_name: 'Green tea' });
    await f.pool.query("INSERT INTO calendar_meal_library(id,profile_id,food_key,custom_name) VALUES($1,$2,'not_a_food',NULL)", [randomUUID(), profile]);
    await f.pool.query("INSERT INTO calendar_meal_library(id,profile_id,food_key,custom_name) VALUES($1,$2,'rice',$3)", [randomUUID(), profile, 'x'.repeat(41)]);
    const window = await f.calendar.read(profile, monday);
    assert.deepEqual(window.meal_library.map(item => item.food_key), ['banh_mi', 'tea']);
    assert.deepEqual(window.meal_library[0], first.item);
    assert.deepEqual((await f.calendar.read(sibling, monday)).meal_library, []);
  } finally { await f.close(); }
});
