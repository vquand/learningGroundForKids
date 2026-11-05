import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { createCalendarEventsRepository, type CalendarEvent } from '../../src/calendar/events.js';
import { createCalendarRepository } from '../../src/calendar/repository.js';
import { systemEventsInWindow } from '../../src/calendar/system-events.js';
import type { CalendarWindow } from '../../src/calendar/contracts.js';
import { AppError } from '../../src/errors.js';

const configured = process.env.TEST_DATABASE_URL;
const skip = configured ? false : 'TEST_DATABASE_URL is not configured';
const TODAY_INSTANT = new Date('2026-10-29T03:00:00Z'); // Asia/Ho_Chi_Minh 2026-10-29 10:00 (Thursday)
const WINDOW_START = '2026-10-26', WINDOW_END = '2026-11-08';
const appError = (status: number, code: string) => (error: unknown) => error instanceof AppError && error.status === status && error.code === code;

async function openPool(): Promise<Pool> {
  const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(configured!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((value): value is string => !!value)) });
  await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
  return pool;
}

async function seedFamily(pool: Pool, profiles: string[]): Promise<{ family: string; profiles: string[] }> {
  const family = randomUUID();
  await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)', [family, `${family}@calendar-events.test`, 'Test', 'unused']);
  for (const id of profiles) await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)', [id, family, 'Kid', '⭐', '#456']);
  return { family, profiles };
}

async function insertEvent(pool: Pool, profile: string, row: { title?: string; start: string; repeat?: string; ended?: string | null; revision?: number }): Promise<string> {
  const id = randomUUID();
  await pool.query(`INSERT INTO calendar_events(id,profile_id,title,icon_key,start_date,"repeat",repeat_ended_on,revision)
    VALUES($1,$2,$3,'birthday',$4::date,$5,$6::date,$7)`, [id, profile, row.title ?? 'Event', row.start, row.repeat ?? 'none', row.ended ?? null, row.revision ?? 1]);
  return id;
}

async function activeCount(pool: Pool, profile: string, today = '2026-10-29'): Promise<number> {
  return (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM calendar_events WHERE profile_id=$1
    AND (("repeat"='none' AND start_date>=$2::date) OR ("repeat"<>'none' AND (repeat_ended_on IS NULL OR repeat_ended_on>=$2::date)))`, [profile, today])).rows[0]!.n;
}

async function occurrences(pool: Pool, profile: string, now: Date) {
  const window = await createCalendarRepository(pool).read(profile, now);
  return window;
}

test('kid event CRUD round trip with revisions and sibling/foreign ids returning 404', { skip }, async () => {
  const pool = await openPool();
  const sibling = randomUUID(), profile = randomUUID();
  const { family } = await seedFamily(pool, [profile, sibling]);
  const repo = createCalendarEventsRepository(pool);
  try {
    const created = await repo.create(profile, { title: '  Piano\u0007 ', icon_key: 'music_lesson', start_date: '2026-10-29', repeat: 'weekly' }, TODAY_INSTANT);
    assert.deepEqual(created, { id: created.id, title: 'Piano', icon_key: 'music_lesson', start_date: '2026-10-29', repeat: 'weekly', repeat_ended_on: null, revision: 1 });
    const updated = await repo.update(profile, created.id, { title: 'Violin', icon_key: 'music_lesson', start_date: '2026-10-29', repeat: 'weekly', expected_revision: 1 }, TODAY_INSTANT);
    assert.equal(updated.revision, 2); assert.equal(updated.title, 'Violin');
    await assert.rejects(() => repo.update(profile, created.id, { title: 'Stale', icon_key: 'birthday', start_date: '2026-10-29', repeat: 'none', expected_revision: 1 }, TODAY_INSTANT), error => {
      assert.ok(appError(409, 'CALENDAR_REVISION_CONFLICT')(error));
      assert.deepEqual((error as AppError).details, { current: updated }); return true;
    });
    // A sibling profile or another family cannot touch the row: 404 and no change.
    const foreignInput = { title: 'Hijack', icon_key: 'birthday', start_date: '2026-10-29', repeat: 'none' as const, expected_revision: 2 };
    await assert.rejects(() => repo.update(sibling, created.id, foreignInput, TODAY_INSTANT), appError(404, 'CALENDAR_EVENT_NOT_FOUND'));
    await assert.rejects(() => repo.delete(sibling, created.id, 2, TODAY_INSTANT), appError(404, 'CALENDAR_EVENT_NOT_FOUND'));
    await assert.rejects(() => repo.stopRepeat(sibling, created.id, { expected_revision: 2 }, TODAY_INSTANT), appError(404, 'CALENDAR_EVENT_NOT_FOUND'));
    await assert.rejects(() => repo.stopRepeat(profile, randomUUID(), { expected_revision: 1 }, TODAY_INSTANT), appError(404, 'CALENDAR_EVENT_NOT_FOUND'));
    assert.equal((await pool.query('SELECT title,revision FROM calendar_events WHERE id=$1', [created.id])).rows[0]!.title, 'Violin');
    // Delete: stale revision conflicts, the current one removes the row, and a repeat is 404.
    await assert.rejects(() => repo.delete(profile, created.id, 1, TODAY_INSTANT), appError(409, 'CALENDAR_REVISION_CONFLICT'));
    await repo.delete(profile, created.id, 2, TODAY_INSTANT);
    await assert.rejects(() => repo.delete(profile, created.id, 2, TODAY_INSTANT), appError(404, 'CALENDAR_EVENT_NOT_FOUND'));
    await assert.rejects(() => repo.create(profile, { title: 'Before this week', icon_key: 'birthday', start_date: '2026-10-25', repeat: 'none' }, TODAY_INSTANT), appError(422, 'VALIDATION_ERROR'));
    await assert.rejects(() => repo.create(profile, { title: 'Too far', icon_key: 'birthday', start_date: '2027-10-30', repeat: 'none' }, TODAY_INSTANT), appError(422, 'VALIDATION_ERROR'));
    await assert.rejects(() => repo.create(profile, { title: 'Bad icon', icon_key: 'tablet', start_date: '2026-10-30', repeat: 'none' }, TODAY_INSTANT), appError(422, 'VALIDATION_ERROR'));
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end();
  }
});

test('stop-repeat ends past series after today, converts future series to one-offs and leaves one-offs alone', { skip }, async () => {
  const pool = await openPool();
  const profile = randomUUID();
  const { family } = await seedFamily(pool, [profile]);
  const repo = createCalendarEventsRepository(pool);
  try {
    const pastId = await insertEvent(pool, profile, { title: 'Swim', start: '2026-10-01', repeat: 'weekly' });
    const stopped = await repo.stopRepeat(profile, pastId, { expected_revision: 1 }, TODAY_INSTANT);
    assert.deepEqual(stopped, { id: pastId, title: 'Swim', icon_key: 'birthday', start_date: '2026-10-01', repeat: 'weekly', repeat_ended_on: '2026-10-29', revision: 2 });
    let window = await occurrences(pool, profile, TODAY_INSTANT);
    assert.deepEqual(window.events.map(event => event.date), ['2026-10-29'], 'today is included, nothing after it');
    assert.deepEqual(window.events.map(event => event.event_id), [pastId]);
    assert.deepEqual((await occurrences(pool, profile, new Date('2026-10-30T03:00:00Z'))).events.map(event => event.date), ['2026-10-29'], 'the past day stays visible; nothing after the end date');
    // Stopping an already stopped series keeps the end date and the revision.
    assert.deepEqual(await repo.stopRepeat(profile, pastId, { expected_revision: 2 }, TODAY_INSTANT), stopped);
    await assert.rejects(() => repo.stopRepeat(profile, pastId, { expected_revision: 1 }, TODAY_INSTANT), appError(409, 'CALENDAR_REVISION_CONFLICT'));

    const futureId = (await repo.create(profile, { title: 'Dentist', icon_key: 'dentist', start_date: '2026-11-03', repeat: 'weekly' }, TODAY_INSTANT)).id;
    const converted = await repo.stopRepeat(profile, futureId, { expected_revision: 1 }, TODAY_INSTANT);
    assert.deepEqual({ repeat: converted.repeat, repeat_ended_on: converted.repeat_ended_on, revision: converted.revision, start_date: converted.start_date },
      { repeat: 'none', repeat_ended_on: null, revision: 2, start_date: '2026-11-03' });
    window = await occurrences(pool, profile, TODAY_INSTANT);
    assert.deepEqual(window.events.filter(event => event.event_id === futureId).map(event => event.date), ['2026-11-03']);

    const oneOff = await repo.create(profile, { title: 'Party', icon_key: 'party', start_date: '2026-11-02', repeat: 'none' }, TODAY_INSTANT);
    assert.deepEqual(await repo.stopRepeat(profile, oneOff.id, { expected_revision: 1 }, TODAY_INSTANT), oneOff, 'stopping a one-off is a no-op');
    assert.equal((await pool.query('SELECT revision FROM calendar_events WHERE id=$1', [oneOff.id])).rows[0]!.revision, 1);
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end();
  }
});

test('concurrent creates and activations never exceed 50 active events, and ended rows do not count', { skip }, async () => {
  const pool = await openPool();
  const profile = randomUUID();
  const { family } = await seedFamily(pool, [profile]);
  const repo = createCalendarEventsRepository(pool);
  try {
    // Ended series and past one-offs are inactive and must not use up the cap.
    await insertEvent(pool, profile, { title: 'Ended', start: '2026-09-01', repeat: 'weekly', ended: '2026-10-20' });
    const inactive = await insertEvent(pool, profile, { title: 'Past', start: '2026-10-01' });
    for (let index = 0; index < 49; index += 1) await repo.create(profile, { title: `Event ${index}`, icon_key: 'birthday', start_date: '2026-11-01', repeat: 'none' }, TODAY_INSTANT);
    assert.equal(await activeCount(pool, profile), 49);
    const race = await Promise.allSettled(Array.from({ length: 5 }, (_, index) => repo.create(profile, { title: `Race ${index}`, icon_key: 'birthday', start_date: '2026-11-02', repeat: 'none' }, TODAY_INSTANT)));
    assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
    for (const result of race) if (result.status === 'rejected') assert.ok(appError(422, 'CALENDAR_EVENTS_FULL')(result.reason));
    assert.equal(await activeCount(pool, profile), 50);
    await assert.rejects(() => repo.create(profile, { title: 'Full', icon_key: 'birthday', start_date: '2026-11-02', repeat: 'none' }, TODAY_INSTANT), appError(422, 'CALENDAR_EVENTS_FULL'));
    // A historical one-off cannot move its date or become a repeating series.
    await assert.rejects(() => repo.update(profile, inactive, { title: 'Back', icon_key: 'birthday', start_date: '2026-11-03', repeat: 'none', expected_revision: 1 }, TODAY_INSTANT), appError(422, 'VALIDATION_ERROR'));
    await assert.rejects(() => repo.update(profile, inactive, { title: 'Back', icon_key: 'birthday', start_date: '2026-10-01', repeat: 'weekly', expected_revision: 1 }, TODAY_INSTANT), appError(422, 'VALIDATION_ERROR'));
    // Editing an active event at the cap keeps working.
    const someActive = (await pool.query<{ id: string }>("SELECT id FROM calendar_events WHERE profile_id=$1 AND title='Event 0'", [profile])).rows[0]!.id;
    const edited = await repo.update(profile, someActive, { title: 'Event zero', icon_key: 'birthday', start_date: '2026-11-01', repeat: 'none', expected_revision: 1 }, TODAY_INSTANT);
    assert.equal(edited.revision, 2);
    assert.equal(await activeCount(pool, profile), 50);
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end();
  }
});

test('concurrent edits of one event serialize to exactly one winner', { skip }, async () => {
  const pool = await openPool();
  const profile = randomUUID();
  const { family } = await seedFamily(pool, [profile]);
  const repo = createCalendarEventsRepository(pool);
  try {
    const event = await repo.create(profile, { title: 'Race', icon_key: 'birthday', start_date: '2026-11-02', repeat: 'none' }, TODAY_INSTANT);
    const results = await Promise.allSettled([0, 1, 2].map(index => repo.update(profile, event.id, { title: `Edit ${index}`, icon_key: 'birthday', start_date: '2026-11-02', repeat: 'none', expected_revision: 1 }, TODAY_INSTANT)));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    for (const result of results) if (result.status === 'rejected') assert.ok(appError(409, 'CALENDAR_REVISION_CONFLICT')(result.reason));
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end();
  }
});

test('writes retain custom event history, including one-offs and ended series', { skip }, async () => {
  const pool = await openPool();
  const profile = randomUUID();
  const { family } = await seedFamily(pool, [profile]);
  const repo = createCalendarEventsRepository(pool);
  try {
    // Today is 2026-10-29; 60 days earlier is 2026-08-30.
    const oldOneOff = await insertEvent(pool, profile, { start: '2026-08-29' });
    const keptOneOff = await insertEvent(pool, profile, { start: '2026-08-30' });
    const oldEnded = await insertEvent(pool, profile, { start: '2026-01-05', repeat: 'weekly', ended: '2026-08-29' });
    const keptEnded = await insertEvent(pool, profile, { start: '2026-01-05', repeat: 'weekly', ended: '2026-08-30' });
    const openSeries = await insertEvent(pool, profile, { start: '2026-01-05', repeat: 'weekly' });
    await repo.create(profile, { title: 'Trigger', icon_key: 'birthday', start_date: '2026-11-01', repeat: 'none' }, TODAY_INSTANT);
    const remaining = (await pool.query<{ id: string }>('SELECT id FROM calendar_events WHERE profile_id=$1', [profile])).rows.map(row => row.id);
    assert.ok(remaining.includes(oldOneOff));
    assert.ok(remaining.includes(oldEnded));
    for (const id of [keptOneOff, keptEnded, openSeries]) assert.ok(remaining.includes(id));
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end();
  }
});

test('read() expands kid events for the 14-day window and exposes system events', { skip }, async () => {
  const pool = await openPool();
  const profile = randomUUID(), sibling = randomUUID();
  const { family } = await seedFamily(pool, [profile, sibling]);
  const repo = createCalendarEventsRepository(pool);
  try {
    const piano = await repo.create(profile, { title: 'Piano', icon_key: 'music_lesson', start_date: '2026-10-29', repeat: 'weekly' }, TODAY_INSTANT);
    const zoo = await repo.create(profile, { title: 'Zoo', icon_key: 'zoo', start_date: '2026-11-02', repeat: 'none' }, TODAY_INSTANT);
    const art = await repo.create(profile, { title: 'Art', icon_key: 'painting', start_date: '2026-11-02', repeat: 'none' }, TODAY_INSTANT);
    const rent = await insertEvent(pool, profile, { title: 'Rent', start: '2026-08-31', repeat: 'monthly' });
    await insertEvent(pool, profile, { title: 'Old', start: '2026-10-01', repeat: 'weekly', ended: '2026-10-28' });
    await insertEvent(pool, profile, { title: 'Past', start: '2026-10-20' });
    await repo.create(sibling, { title: 'Sibling', icon_key: 'birthday', start_date: '2026-10-30', repeat: 'none' }, TODAY_INSTANT);
    const window: CalendarWindow = await occurrences(pool, profile, TODAY_INSTANT);
    assert.equal(window.weeks[0]!.start, WINDOW_START);
    assert.equal(window.weeks[1]!.days[6]!.date, WINDOW_END);
    assert.deepEqual(window.events, [
      { event_id: piano.id, date: '2026-10-29', title: 'Piano', icon_key: 'music_lesson', repeat: 'weekly', repeat_ended_on: null, start_date: '2026-10-29', revision: 1 },
      { event_id: rent, date: '2026-10-31', title: 'Rent', icon_key: 'birthday', repeat: 'monthly', repeat_ended_on: null, start_date: '2026-08-31', revision: 1 },
      { event_id: art.id, date: '2026-11-02', title: 'Art', icon_key: 'painting', repeat: 'none', repeat_ended_on: null, start_date: '2026-11-02', revision: 1 },
      { event_id: zoo.id, date: '2026-11-02', title: 'Zoo', icon_key: 'zoo', repeat: 'none', repeat_ended_on: null, start_date: '2026-11-02', revision: 1 },
      { event_id: piano.id, date: '2026-11-05', title: 'Piano', icon_key: 'music_lesson', repeat: 'weekly', repeat_ended_on: null, start_date: '2026-10-29', revision: 1 },
    ]);
    assert.deepEqual(window.system_events, systemEventsInWindow(WINDOW_START, WINDOW_END));
    assert.ok(window.system_events.some(event => event.key === 'halloween' && event.date === '2026-10-31'));
    // A later window (Nov 9 to Nov 22) only shows occurrences inside it, and the sibling's event never leaks.
    const later = await occurrences(pool, profile, new Date('2026-11-09T03:00:00Z'));
    assert.deepEqual(later.events.map(event => `${event.date} ${event.title}`), ['2026-11-12 Piano', '2026-11-19 Piano']);
    assert.ok(!window.events.some(event => event.title === 'Sibling'));
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end();
  }
});

test('a started series keeps its anchor on title and icon edits; date changes follow the creation range', { skip }, async () => {
  const pool = await openPool();
  const profile = randomUUID();
  const { family } = await seedFamily(pool, [profile]);
  const repo = createCalendarEventsRepository(pool);
  try {
    const started = await insertEvent(pool, profile, { title: 'Swim', start: '2026-10-01', repeat: 'weekly', revision: 3 });
    const edited = await repo.update(profile, started, { title: 'Laps', icon_key: 'beach', start_date: '2026-10-01', repeat: 'weekly', expected_revision: 3 }, TODAY_INSTANT);
    assert.deepEqual(edited, { id: started, title: 'Laps', icon_key: 'beach', start_date: '2026-10-01', repeat: 'weekly', repeat_ended_on: null, revision: 4 });
    await assert.rejects(() => repo.update(profile, started, { title: 'Laps', icon_key: 'beach', start_date: '2026-10-30', repeat: 'weekly', expected_revision: 4 }, TODAY_INSTANT), appError(422, 'VALIDATION_ERROR'));
    await assert.rejects(() => repo.update(profile, started, { title: 'Laps', icon_key: 'beach', start_date: '2026-10-01', repeat: 'weekly', expected_revision: 3 }, TODAY_INSTANT), appError(409, 'CALENDAR_REVISION_CONFLICT'));
    assert.deepEqual((await pool.query('SELECT to_char(start_date,\'YYYY-MM-DD\') AS d, revision FROM calendar_events WHERE id=$1', [started])).rows[0], { d: '2026-10-01', revision: 4 });

    const future = await repo.create(profile, { title: 'Dentist', icon_key: 'dentist', start_date: '2026-11-01', repeat: 'none' }, TODAY_INSTANT);
    const moved = await repo.update(profile, future.id, { title: 'Dentist', icon_key: 'dentist', start_date: '2026-11-10', repeat: 'none', expected_revision: 1 }, TODAY_INSTANT);
    assert.equal(moved.start_date, '2026-11-10'); assert.equal(moved.revision, 2);
    await assert.rejects(() => repo.update(profile, future.id, { title: 'Dentist', icon_key: 'dentist', start_date: '2027-11-01', repeat: 'none', expected_revision: 2 }, TODAY_INSTANT), appError(422, 'VALIDATION_ERROR'));
    await assert.rejects(() => repo.update(profile, future.id, { title: 'Dentist', icon_key: 'dentist', start_date: '2026-10-28', repeat: 'none', expected_revision: 2 }, TODAY_INSTANT), appError(422, 'VALIDATION_ERROR'));
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end();
  }
});

test('editing a past one-off applies to its own date, including a second edit with history', { skip }, async () => {
  const pool = await openPool();
  const profile = randomUUID();
  const { family } = await seedFamily(pool, [profile]);
  const repo = createCalendarEventsRepository(pool);
  try {
    const past = await insertEvent(pool, profile, { title: 'Swim', start: '2026-10-27' });
    const first = await repo.update(profile, past, { title: 'Laps', icon_key: 'beach', start_date: '2026-10-27', repeat: 'none', participants: [{ kind: 'role', key: 'friend' }], expected_revision: 1 }, TODAY_INSTANT);
    const second = await repo.update(profile, past, { title: 'Dive', icon_key: 'beach', start_date: '2026-10-27', repeat: 'none', participants: [{ kind: 'role', key: 'friend' }], expected_revision: first.revision }, TODAY_INSTANT);
    assert.equal(second.title, 'Dive');
    const found = (await createCalendarRepository(pool).read(profile, TODAY_INSTANT)).events.find(event => event.event_id === past);
    assert.equal(found?.date, '2026-10-27'); assert.equal(found?.title, 'Dive');
    assert.deepEqual(found?.participants, [{ kind: 'role', key: 'friend' }]);
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end();
  }
});

test('a one-off edit with a from_date that is not its own occurrence is rejected', { skip }, async () => {
  const pool = await openPool();
  const profile = randomUUID();
  const { family } = await seedFamily(pool, [profile]);
  const repo = createCalendarEventsRepository(pool);
  try {
    const past = await insertEvent(pool, profile, { title: 'Swim', start: '2026-10-27' });
    await assert.rejects(() => repo.update(profile, past, { title: 'Laps', icon_key: 'beach', start_date: '2026-10-27', repeat: 'none', from_date: '2026-10-28', expected_revision: 1 }, TODAY_INSTANT), appError(422, 'VALIDATION_ERROR'));
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end();
  }
});
