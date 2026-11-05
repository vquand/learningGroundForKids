import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { createCalendarRepository } from '../../src/calendar/repository.js';
import type { CalendarWindow, CalendarArea } from '../../src/calendar/contracts.js';
import { AppError } from '../../src/errors.js';
const configured = process.env.TEST_DATABASE_URL;
const skip = configured ? false : 'TEST_DATABASE_URL is not configured';
function cell(window: CalendarWindow, date: string, area: CalendarArea = 'study_morning') {
  const day = window.weeks.flatMap(week => week.days).find(day => day.date === date);
  assert.ok(day); return day.lists[area];
}
const conflict = (error: unknown) => error instanceof AppError && error.status === 409 && error.code === 'CALENDAR_REVISION_CONFLICT';
test('calendar transactions resolve, freeze, serialize revisions, restore, validate and prune profile lists', { skip }, async () => {
  const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(configured!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((value): value is string => !!value)) });
  const family = randomUUID(), profile = randomUUID(), sibling = randomUUID();
  const warnings: string[] = [];
  const repo = createCalendarRepository(pool, { warn: (_message, details) => { warnings.push(details.id); } });
  const monday = new Date('2026-10-26T00:00:00Z'), thursday = new Date('2026-10-29T00:00:00Z');
  const template = { scope: 'template' as const, weekday: 1, area: 'study_morning' as const, items: [{ subject: 'math' }], expected_revision: 0 };
  try {
    await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)', [family, `${family}@calendar.test`, 'Test', 'unused']);
    for (const id of [profile, sibling]) await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)', [id, family, 'Kid', '⭐', '#456']);
    const created = await repo.upsert(profile, template, monday);
    const extraItems = [{ subject: 'math', teaching_language: 'en' }, { subject: 'math', name: 'Math A+', teaching_language: 'vi' }, { subject: 'reading' }];
    const extraInput = { ...template, area: 'study_extra' as const, items: extraItems };
    const extra = await repo.upsert(profile, extraInput, monday);
    assert.deepEqual(extra.items, extraItems);
    const nextExtra = [{ subject: 'science', teaching_language: 'vi' }];
    await repo.upsert(profile, { ...extraInput, items: nextExtra, expected_revision: extra.revision }, thursday);
    const extraWindow = await repo.read(profile, thursday);
    assert.deepEqual(cell(extraWindow, '2026-10-26', 'study_extra').items, extraItems, 'old Extra plan is frozen');
    assert.deepEqual(cell(extraWindow, '2026-11-02', 'study_extra').items, nextExtra);
    const extraOverride = await repo.upsert(profile, { scope: 'date', date: '2026-11-02', area: 'study_extra', items: extraItems, expected_revision: 0 }, thursday);
    assert.deepEqual(cell(await repo.read(profile, thursday), '2026-11-02', 'study_extra').items, extraItems);
    await repo.deleteOverride(profile, { date: '2026-11-02', area: 'study_extra', expected_revision: extraOverride.revision }, thursday);
    assert.deepEqual(cell(await repo.read(profile, thursday), '2026-11-02', 'study_extra').items, nextExtra);
    assert.equal(created.revision, 1); assert.equal(created.source, 'template');
    let window = await repo.read(profile, thursday);
    assert.equal(window.weeks.length, 2); assert.ok(window.weeks.every(week => week.days.length === 7));
    assert.deepEqual(Object.keys(window).sort(), ['today','timezone','weeks','templates','meal_library','study_library','events','system_events'].sort());
    assert.deepEqual(Object.keys(window.templates), ['1','2','3','4','5','6','7']);
    assert.deepEqual(window.templates['1'].study_morning, created);
    assert.deepEqual(window.templates['2'].study_morning, { id: null, items: [], revision: 0, source: 'empty' });
    assert.deepEqual(cell(window, '2026-11-02'), created);
    assert.deepEqual(cell(window, '2026-10-27'), { id: null, items: [], revision: 0, source: 'empty' });
    const changed = await repo.upsert(profile, { ...template, expected_revision: 1, items: [{ subject: 'english' }] }, thursday);
    window = await repo.read(profile, thursday);
    assert.equal(cell(window, '2026-10-26').source, 'override');
    assert.deepEqual(cell(window, '2026-10-26').items, [{ subject: 'math' }]);
    assert.deepEqual(cell(window, '2026-11-02'), changed);
    await repo.upsert(profile, { ...template, expected_revision: 2, items: [{ subject: 'science' }] }, thursday);
    assert.deepEqual(cell(await repo.read(profile, thursday), '2026-10-26').items, [{ subject: 'math' }], 'existing past override stays frozen');
    // Creating a previously empty past weekday freezes the old empty list too.
    await repo.upsert(profile, { ...template, weekday: 2 }, thursday);
    assert.deepEqual(cell(await repo.read(profile, thursday), '2026-10-27').items, []);
    const override = { scope: 'date' as const, date: '2026-11-02', area: 'study_morning' as const, items: [], expected_revision: 0 };
    const saved = await repo.upsert(profile, override, thursday);
    assert.equal(cell(await repo.read(profile, thursday), override.date).source, 'override');
    // The Monday override hides the day list, but the weekly template keeps its id and revision (science, rev 3).
    const withOverride = await repo.read(profile, thursday);
    assert.deepEqual(withOverride.templates['1'].study_morning, { id: created.id, items: [{ subject: 'science' }], revision: 3, source: 'template' });
    assert.equal(withOverride.templates['2'].study_morning.revision, 1);
    assert.deepEqual(withOverride.templates['3'].study_morning, { id: null, items: [], revision: 0, source: 'empty' });
    assert.deepEqual(cell(await repo.read(profile, thursday), override.date).items, []);
    await assert.rejects(() => repo.upsert(profile, override, thursday), error => {
      assert.ok(conflict(error)); assert.deepEqual((error as AppError).details, { current: saved }); return true;
    });
    const deletion = { date: override.date, area: override.area, expected_revision: 0 };
    await assert.rejects(() => repo.deleteOverride(profile, deletion, thursday), conflict);
    await repo.deleteOverride(profile, { ...deletion, expected_revision: 1 }, thursday);
    assert.equal(cell(await repo.read(profile, thursday), override.date).source, 'template');
    assert.deepEqual(cell(await repo.read(profile, thursday), override.date).items, [{ subject: 'science' }]);
    const race = await Promise.allSettled([0,1].map(() => repo.upsert(profile, override, thursday)));
    assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(race.filter(result => result.status === 'rejected' && conflict(result.reason)).length, 1);
    await assert.rejects(() => repo.upsert(profile, { ...template, items: Array(9).fill({ subject: 'math' }) }, thursday), error => error instanceof AppError && error.status === 422);
    for (const date of ['2026-10-28', '2026-11-09']) {
      await assert.rejects(() => repo.upsert(profile, { ...override, date }, thursday), error => error instanceof AppError && error.code === 'CALENDAR_DATE_NOT_EDITABLE');
      await assert.rejects(() => repo.deleteOverride(profile, { ...deletion, date }, thursday), error => error instanceof AppError && error.code === 'CALENDAR_DATE_NOT_EDITABLE');
    }
    await assert.rejects(() => repo.upsert(profile, { ...template, area: 'medicine', items: [{ subject: 'math' }] }, thursday), error => error instanceof AppError && error.status === 422 && error.code === 'VALIDATION_ERROR');
    const siblingList = await repo.upsert(sibling, template, monday);
    assert.equal(cell(await repo.read(sibling, thursday), '2026-11-02').id, siblingList.id);
    assert.notEqual(cell(await repo.read(profile, thursday), '2026-11-02').id, siblingList.id);
    await assert.rejects(() => repo.deleteOverride(sibling, { ...deletion, expected_revision: 1 }, thursday), error => error instanceof AppError && error.status === 404);
    // Corrupt an override: drop the entire list, never resurrect its template.
    await pool.query("UPDATE calendar_plan_lists SET items=$1::jsonb WHERE profile_id=$2 AND scope='date' AND local_date=$3::date", [JSON.stringify([{ subject: 'math' }, { food: 'wrong-area' }]), profile, override.date]);
    const malformed = cell(await repo.read(profile, thursday), override.date);
    assert.deepEqual(malformed.items, []); assert.equal(malformed.source, 'override'); assert.ok(warnings.includes(malformed.id!));
    // A corrupt weekday template is dropped the same way: items [] while id and revision stay.
    await pool.query("UPDATE calendar_plan_lists SET items=$1::jsonb WHERE profile_id=$2 AND scope='template' AND weekday=2 AND area='study_morning'", [JSON.stringify([{ food: 'wrong-area' }]), profile]);
    const corruptTemplate = (await repo.read(profile, thursday)).templates['2'].study_morning;
    assert.deepEqual(corruptTemplate.items, []); assert.equal(corruptTemplate.revision, 1); assert.equal(corruptTemplate.source, 'template');
    assert.ok(corruptTemplate.id && warnings.includes(corruptTemplate.id));
    for (const id of [profile, sibling]) for (const date of ['2026-10-14', '2026-10-15']) await pool.query("INSERT INTO calendar_plan_lists(id,profile_id,scope,local_date,area,items) VALUES($1,$2,'date',$3::date,'study_afternoon','[]')", [randomUUID(), id, date]);
    await repo.upsert(profile, { ...template, weekday: 7 }, thursday);
    const retained = await pool.query("SELECT to_char(local_date,'YYYY-MM-DD') AS date FROM calendar_plan_lists WHERE profile_id=$1 AND local_date<'2026-10-20' ORDER BY local_date", [profile]);
    assert.deepEqual(retained.rows, [{ date: '2026-10-15' }]);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM calendar_plan_lists WHERE profile_id=$1 AND local_date<'2026-10-20'", [sibling])).rows[0].n, 2);
    for (const [instant, today, start, end] of [
      ['2026-10-25T16:59:00Z', '2026-10-25', '2026-10-19', '2026-11-01'],
      ['2026-10-25T17:00:00Z', '2026-10-26', '2026-10-26', '2026-11-08'],
      ['2027-01-01T00:00:00Z', '2027-01-01', '2026-12-28', '2027-01-10'],
    ]) {
      window = await repo.read(profile, new Date(instant!));
      assert.equal(window.today, today); assert.equal(window.weeks[0]!.start, start); assert.equal(window.weeks[1]!.days[6]!.date, end);
    }
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end();
  }
});

test('calendar migration up/down enforces scope shape, partial uniqueness and cascade FKs', { skip }, async () => {
  const { readFile } = await import('node:fs/promises');
  const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(configured!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((value): value is string => !!value)) });
  const client = await pool.connect();
  // Isolated schema in the disposable DB: no drops of shared public tables.
  const schema = `calendar_test_${randomUUID().replaceAll('-', '')}`;
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    await client.query('CREATE TABLE profiles (id text PRIMARY KEY)');
    const migration = (await readFile(new URL('../../drizzle/0033_kid_calendar.sql', import.meta.url), 'utf8')).replaceAll('"public"."profiles"', `"${schema}"."profiles"`);
    await client.query(migration);
    await client.query("INSERT INTO profiles VALUES ('kid')");
    await client.query("INSERT INTO calendar_plan_lists(id,profile_id,scope,weekday,area,items) VALUES('template','kid','template',1,'study_morning','[]')");
    await client.query("INSERT INTO calendar_plan_lists(id,profile_id,scope,local_date,area,items) VALUES('date','kid','date','2026-10-26','study_morning','[]')");
    for (const [statement, code] of [
      ["INSERT INTO calendar_plan_lists(id,profile_id,scope,weekday,area,items) VALUES('duplicate','kid','template',1,'study_morning','[]')", '23505'],
      ["INSERT INTO calendar_plan_lists(id,profile_id,scope,local_date,area,items) VALUES('duplicate','kid','date','2026-10-26','study_morning','[]')", '23505'],
      ["INSERT INTO calendar_plan_lists(id,profile_id,scope,area,items) VALUES('bad','kid','template','study_morning','[]')", '23514'],
      ["INSERT INTO calendar_plan_lists(id,profile_id,scope,weekday,area,items) VALUES('bad','kid','template',8,'study_morning','[]')", '23514'],
      ["INSERT INTO calendar_plan_lists(id,profile_id,scope,weekday,local_date,area,items) VALUES('bad','kid','date',1,'2026-10-26','study_morning','[]')", '23514'],
    ]) {
      await client.query('SAVEPOINT rejected_write');
      await assert.rejects(() => client.query(statement!), error => (error as { code?: string }).code === code);
      await client.query('ROLLBACK TO SAVEPOINT rejected_write');
    }
    await client.query("INSERT INTO calendar_meal_library(id,profile_id,food_key) VALUES('meal','kid','rice')");
    await client.query('SAVEPOINT rejected_write');
    await assert.rejects(() => client.query("INSERT INTO calendar_meal_library(id,profile_id,food_key,custom_name) VALUES('duplicate','kid','rice','')"), error => (error as { code?: string }).code === '23505');
    await client.query('ROLLBACK TO SAVEPOINT rejected_write');
    await client.query("INSERT INTO calendar_events(id,profile_id,title,icon_key,start_date) VALUES('event','kid','Party','birthday','2026-10-29')");
    await client.query("DELETE FROM profiles WHERE id='kid'");
    for (const table of ['calendar_plan_lists', 'calendar_meal_library', 'calendar_events']) {
      assert.equal((await client.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, 0);
    }
    await client.query(await readFile(new URL('../../drizzle/rollbacks/0033_kid_calendar.sql', import.meta.url), 'utf8'));
    for (const table of ['calendar_plan_lists', 'calendar_meal_library', 'calendar_events']) {
      assert.equal((await client.query('SELECT to_regclass($1) AS name', [`${schema}.${table}`])).rows[0].name, null);
    }
  } finally {
    await client.query('ROLLBACK'); client.release(); await pool.end();
  }
});

test('medicine weekdays repeat atomically in their original row, retain overrides/history, and deduplicate retries', { skip }, async () => {
  const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(configured!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((value): value is string => !!value)) });
  const family = randomUUID(), profile = randomUUID(), repo = createCalendarRepository(pool);
  const monday = new Date('2026-10-26T00:00:00Z'), now = new Date('2026-10-29T00:00:00Z');
  const area = 'meal_breakfast' as const;
  const item = { medicine: { method: 'tablet' as const, color: 'red' as const, qty: 1 }, series_id: randomUUID() };
  try {
    await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)', [family, `${family}@calendar.test`, 'Test', 'unused']);
    await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)', [profile, family, 'Kid', '⭐', '#456']);
    for (const weekday of [1, 3, 5]) await repo.upsert(profile, { scope: 'template', weekday, area, items: [{ food: 'rice' }], expected_revision: 0 }, monday);
    await repo.upsert(profile, { scope: 'date', date: '2026-10-30', area, items: [{ food: 'noodles' }], expected_revision: 0 }, now);
    const input = { scope: 'date' as const, date: '2026-10-29', area, items: [{ food: 'milk_box' }], expected_revision: 0,
      medicine_repeats: [{ item, weekdays: [1, 3, 5] }], expected_medicine_revisions: [1, 3, 5].map(weekday => ({ weekday, expected_revision: 1 })) };
    await repo.upsert(profile, input, now);
    const result = await repo.read(profile, now);
    assert.deepEqual(cell(result, '2026-10-26', area).items, [{ food: 'rice' }], 'past plans are frozen before recurring medicine is added');
    assert.deepEqual(cell(result, '2026-11-02', area).items, [{ food: 'rice' }, item]);
    assert.deepEqual(cell(result, '2026-11-04', area).items, [{ food: 'rice' }, item]);
    assert.deepEqual(cell(result, '2026-10-30', area).items, [{ food: 'noodles' }, item], 'future date overrides retain their own meals');
    assert.deepEqual(cell(result, '2026-10-29', area).items, [{ food: 'milk_box' }], 'unselected weekday retains ordinary date edits only');
    assert.deepEqual(cell(result, '2026-11-02', 'medicine').items, [], 'medicine stays in the chosen meal row');
    const later = await repo.read(profile, new Date('2026-11-09T00:00:00Z'));
    assert.deepEqual(cell(later, '2026-11-09', area).items, [{ food: 'rice' }, item], 'repeat is not limited to the displayed two weeks');
    await assert.rejects(() => repo.upsert(profile, input, now), conflict);
    await repo.upsert(profile, { ...input, expected_revision: cell(result, '2026-10-29', area).revision,
      expected_medicine_revisions: [1, 3, 5].map(day => ({ weekday: day, expected_revision: result.templates[String(day) as '1'][area].revision })) }, now);
    assert.deepEqual(cell(await repo.read(profile, now), '2026-11-02', area).items, [{ food: 'rice' }, item], 'explicit retries never append the same lineage twice');

    // A full future override must roll back the ordinary draft and every earlier weekday write.
    await repo.upsert(profile, { scope: 'date', date: '2026-11-06', area: 'medicine', items: Array.from({ length: 6 }, () => ({ medicine: { method: 'tablet', color: 'red', qty: 1 } })), expected_revision: 0 }, now);
    const before = await repo.read(profile, now);
    const failing = { scope: 'template' as const, weekday: 4, area: 'medicine' as const, items: [], expected_revision: 0,
      medicine_repeats: [{ item: { ...item, series_id: randomUUID() }, weekdays: [1, 5] }], expected_medicine_revisions: [1, 5].map(weekday => ({ weekday, expected_revision: 0 })) };
    await assert.rejects(() => repo.upsert(profile, failing, now), error => error instanceof AppError && error.code === 'CALENDAR_MEDICINE_FULL');
    assert.deepEqual(await repo.read(profile, now), before, 'cap errors leave every weekday and the ordinary draft untouched');
    await assert.rejects(() => repo.upsert(profile, { ...failing, expected_medicine_revisions: [{ weekday: 1, expected_revision: 0 }, { weekday: 5, expected_revision: 99 }] }, now), conflict);
    assert.deepEqual(await repo.read(profile, now), before, 'a stale secondary weekday is atomic too');
  } finally { await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end(); }
});
