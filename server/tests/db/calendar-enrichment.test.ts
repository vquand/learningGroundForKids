import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { createCalendarRepository } from '../../src/calendar/repository.js';
import { createCalendarEventsRepository } from '../../src/calendar/events.js';
import { createCalendarNotificationsRepository } from '../../src/calendar/notifications.js';
import type { CalendarArea, CalendarWindow } from '../../src/calendar/contracts.js';
import { AppError } from '../../src/errors.js';

const configured = process.env.TEST_DATABASE_URL;
const skip = configured ? false : 'TEST_DATABASE_URL is not configured';
const now = new Date('2026-10-30T03:00:00Z');
function list(window: CalendarWindow, date: string, area: CalendarArea = 'study_morning') {
  const day = window.weeks.flatMap(week => week.days).find(day => day.date === date);
  assert.ok(day); return day.lists[area];
}

test('renames follow only the selected weekday/area/entry series and preserve earlier names', { skip }, async () => {
  const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(configured!) });
  const family = randomUUID(), child = randomUUID(), sibling = randomUUID();
  const repo = createCalendarRepository(pool);
  try {
    await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)', [family, `${family}@calendar.test`, 'Test', 'unused']);
    for (const id of [child, sibling]) await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)', [id, family, 'Kid', '⭐', '#456']);
    for (const profile of [child, sibling]) {
      for (const weekday of [2, 3]) await repo.upsert(profile, { scope: 'template', weekday, area: 'study_morning', items: [{ subject: 'math' }], expected_revision: 0 }, new Date('2026-10-26T03:00:00Z'));
    }
    assert.ok(repo.renameItem);
    await repo.renameItem(child, { date: '2026-11-03', area: 'study_morning', index: 0, name: 'Math in English', expected_revision: 1, expected_template_revision: 1 }, now);
    let window = await repo.read(child, now);
    assert.equal((list(window, '2026-10-27').items[0] as { subject: string }).subject, 'math');
    assert.equal((list(window, '2026-10-27').items[0] as { name?: string }).name, undefined);
    assert.equal((list(window, '2026-11-03').items[0] as { name: string }).name, 'Math in English');
    assert.deepEqual(list(window, '2026-11-04').items, [{ subject: 'math' }]);
    assert.deepEqual(list(await repo.read(sibling, now), '2026-11-03').items, [{ subject: 'math' }]);
    const next = list(window, '2026-11-03');
    await repo.renameItem(child, { date: '2026-11-03', area: 'study_morning', index: 0, name: 'Math club', expected_revision: next.revision, expected_template_revision: 2 }, now);
    window = await repo.read(child, now);
    assert.equal((list(window, '2026-11-03').items[0] as { name: string }).name, 'Math club');
    assert.equal((list(window, '2026-10-27').items[0] as { subject: string }).subject, 'math');
    assert.equal((list(window, '2026-10-27').items[0] as { name?: string }).name, undefined);
    assert.ok(window.study_library?.some(entry => entry.name === 'Math club'));
    assert.ok(!window.study_library?.some(entry => entry.name === 'Math in English'));
    await assert.rejects(repo.renameItem(child, { date: '2026-11-03', area: 'study_morning', index: 0, name: 'Stale', expected_revision: 1, expected_template_revision: 1 }, now), error => error instanceof AppError && error.status === 409);
    const earlier = list(window, '2026-10-27');
    await repo.renameItem(child, { date: '2026-10-27', area: 'study_morning', index: 0, name: 'Math in Vietnamese', expected_revision: earlier.revision, expected_template_revision: 3 }, now);
    window = await repo.read(child, now);
    assert.equal((list(window, '2026-11-03').items[0] as { name: string }).name, 'Math in Vietnamese');
    assert.deepEqual(list(window, '2026-11-04').items, [{ subject: 'math' }]);
    // An explicit date override is a one-time plan, even when it uses the same icon as the weekly template.
    await repo.upsert(child, { scope: 'date', date: '2026-11-04', area: 'study_morning', items: [{ subject: 'math' }], expected_revision: 0 }, now);
    await repo.renameItem(child, { date: '2026-11-04', area: 'study_morning', index: 0, name: 'One lesson', expected_revision: 1, expected_template_revision: 1 }, now);
    window = await repo.read(child, now);
    assert.deepEqual(window.templates['3'].study_morning.items, [{ subject: 'math' }]);
    assert.equal((list(window, '2026-11-04').items[0] as { name: string }).name, 'One lesson');
    // Renaming a past Tuesday affects only that Tuesday series from the selected date.
    await repo.upsert(child, { scope: 'template', weekday: 2, area: 'meal_lunch', items: [{ food: 'fish' }, { food: 'fish' }], expected_revision: 0 }, new Date('2026-10-26T03:00:00Z'));
    await repo.renameItem(child, { date: '2026-10-27', area: 'meal_lunch', index: 0, name: 'Fish with rice', expected_revision: 1, expected_template_revision: 1 }, now);
    window = await repo.read(child, now);
    for (const date of ['2026-10-27', '2026-11-03']) {
      const items = list(window, date, 'meal_lunch').items;
      assert.equal((items[0] as { name: string }).name, 'Fish with rice');
      assert.equal((items[1] as { food: string }).food, 'fish');
      assert.equal((items[1] as { name?: string }).name, undefined);
    }
    await assert.rejects(repo.renameItem(sibling, { date: '2026-10-27', area: 'meal_lunch', index: 0, name: 'Foreign', expected_revision: 2, expected_template_revision: 2 }, now), error => error instanceof AppError && error.status === 409);
  } finally { await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end(); }
});

test('past events persist and event name versions are used by both the calendar and reminders', { skip }, async () => {
  const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(configured!) });
  const family = randomUUID(), child = randomUUID();
  const repo = createCalendarRepository(pool), events = createCalendarEventsRepository(pool);
  try {
    await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)', [family, `${family}@calendar.test`, 'Test', 'unused']);
    await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)', [child, family, 'Kid', '⭐', '#456']);
    const record = await events.create(child, { title: 'Past trip', icon_key: 'school_trip', start_date: '2026-10-27', repeat: 'none' }, now);
    const recurring = await events.create(child, { title: 'Math', icon_key: 'math', start_date: '2026-10-30', repeat: 'weekly' }, now);
    await events.update(child, recurring.id, { title: 'Math club', icon_key: 'math', start_date: '2026-10-30', repeat: 'weekly', expected_revision: 1, from_date: '2026-11-06' }, now);
    const window = await repo.read(child, now);
    assert.equal(window.events.find(event => event.date === '2026-10-30')?.title, 'Math');
    assert.equal(window.events.find(event => event.date === '2026-11-06')?.title, 'Math club');
    assert.ok(window.events.some(event => event.event_id === record.id));
    const feed = await createCalendarNotificationsRepository(pool).list(family, new Date('2026-11-06T03:00:00Z'));
    assert.equal(feed.items.find(item => item.kind === 'kid')?.title, 'Math club');
    assert.ok(!feed.items.some(item => item.title === 'Past trip'));
    // A later write must not prune the old record.
    await events.create(child, { title: 'Later', icon_key: 'star', start_date: '2027-02-01', repeat: 'none' }, new Date('2027-02-01T03:00:00Z'));
    assert.equal((await pool.query('SELECT id FROM calendar_events WHERE id=$1', [record.id])).rowCount, 1);
  } finally { await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end(); }
});
