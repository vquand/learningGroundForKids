import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashSessionToken } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import type { AppDatabase } from '../src/contracts/db.js';
import { AppError } from '../src/errors.js';
import { addDays, todayInVietnam } from '../src/calendar/dates.js';
import { assertStartDateChange, type CalendarEvent, type CalendarEventsRepository } from '../src/calendar/events.js';

const today = todayInVietnam(new Date());

// In-memory stand-in: the route contract (ownership, revisions, 404s) without the database.
function fakeEvents() {
  const rows = new Map<string, { profile: string; event: CalendarEvent }>();
  const calls: string[] = [];
  let sequence = 0;
  // Mirrors the repository's rules through the shared helper; DB tests cover the real transaction.
  const owned = (profile: string, id: string) => {
    const row = rows.get(id);
    if (!row || row.profile !== profile) throw new AppError(404, 'CALENDAR_EVENT_NOT_FOUND', 'Calendar event not found.');
    return row;
  };
  const check = (expected: number, row: { event: CalendarEvent }) => {
    if (expected !== row.event.revision) throw new AppError(409, 'CALENDAR_REVISION_CONFLICT', 'The calendar event has changed.', { current: row.event });
  };
  const repository: CalendarEventsRepository = {
    async create(profile, input) {
      calls.push('create');
      sequence += 1;
      const event: CalendarEvent = { id: `event-${sequence}`, ...(input as Omit<CalendarEvent, 'id' | 'revision' | 'repeat_ended_on'>), repeat_ended_on: null, revision: 1 };
      rows.set(event.id, { profile, event });
      return event;
    },
    async update(profile, id, input) {
      calls.push('update');
      const row = owned(profile, id);
      const { expected_revision, ...fields } = input as CalendarEvent & { expected_revision: number };
      check(expected_revision, row);
      assertStartDateChange(row.event, fields.start_date, today);
      row.event = { ...row.event, title: fields.title, icon_key: fields.icon_key, start_date: fields.start_date, repeat: fields.repeat, revision: row.event.revision + 1 };
      return row.event;
    },
    async delete(profile, id, expectedRevision) {
      calls.push('delete');
      const row = owned(profile, id);
      check(expectedRevision, row);
      rows.delete(id);
    },
    async stopRepeat(profile, id, input) {
      calls.push('stop-repeat');
      const row = owned(profile, id);
      check((input as { expected_revision: number }).expected_revision, row);
      row.event = { ...row.event, repeat: 'none', revision: row.event.revision + 1 };
      return row.event;
    },
  };
  const seed = (profile: string, event: CalendarEvent) => { rows.set(event.id, { profile, event }); };
  return { repository, rows, calls, seed };
}

test('kid event routes authenticate, enforce ownership, validate strictly and keep structured private responses', async () => {
  let expired = false;
  const family = { id: 'family-a', role: 'family' };
  const fake = fakeEvents();
  const db = {
    auth: { async findFamilyBySessionHash(hash: string) { return !expired && hash === hashSessionToken('token') ? family : null; } },
    profiles: { async get(owner: string, id: string) { return owner === family.id && ['kid-a', 'sibling'].includes(id) ? { id } : null; } },
    calendarEvents: fake.repository,
  } as unknown as AppDatabase;
  const app = createApp({ db, config: loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@localhost/test', ALLOWED_ORIGINS: 'https://app.example.com', ALLOWED_FORWARDED_HOSTS: 'app.example.com', MAX_BODY_BYTES: '1024' }), logger: { info() {}, warn() {}, error() {} } });
  const base = (child: string) => `https://app.example.com/api/v1/profiles/${child}/calendar/events`;
  const validEvent = { title: 'Piano', icon_key: 'music_lesson', start_date: addDays(today, 1), repeat: 'weekly' };
  const send = (method: string, path: string, options: { child?: string; cookie?: string; body?: unknown; raw?: string } = {}) => app.request(`${base(options.child ?? 'kid-a')}${path}`, {
    method,
    headers: { origin: 'https://app.example.com', cookie: options.cookie === undefined ? 'plg_session=token' : options.cookie, 'content-type': 'application/json' },
    ...(options.raw !== undefined ? { body: options.raw } : options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const json = async (response: Response) => (await response.json()) as { error: { code: string; details?: { current?: CalendarEvent } } };
  const routes: [string, string][] = [['POST', ''], ['PUT', '/event-x'], ['DELETE', '/event-x'], ['POST', '/event-x/stop-repeat']];

  // Anonymous, expired and foreign-family requests never reach the repository.
  for (const [method, path] of routes) {
    assert.equal((await send(method, path, { cookie: '' })).status, 401);
    expired = true; assert.equal((await send(method, path)).status, 401); expired = false;
    const foreign = await send(method, path, { child: 'foreign-child', body: validEvent });
    assert.equal(foreign.status, 404); assert.equal((await json(foreign)).error.code, 'PROFILE_NOT_FOUND');
  }
  for (const path of ['', '/event-x', '/event-x/stop-repeat']) assert.equal((await send('POST', path, { cookie: '' })).status, 401);
  assert.deepEqual(fake.calls, []);

  // Create: strict shape, cleaned title, no-store, 201.
  const created = await send('POST', '', { body: { ...validEvent, title: '  Piano\u0000\u0007 ' } });
  assert.equal(created.status, 201); assert.equal(created.headers.get('cache-control'), 'no-store');
  const piano = await created.json() as CalendarEvent;
  assert.deepEqual(piano, { id: 'event-1', title: 'Piano', icon_key: 'music_lesson', start_date: addDays(today, 1), repeat: 'weekly', repeat_ended_on: null, revision: 1 });

  // A sibling's event id is 404 on every mutating route, and the sibling's row is untouched.
  const siblingEvent = await (await send('POST', '', { child: 'sibling', body: { ...validEvent, title: 'Swim' } })).json() as CalendarEvent;
  assert.equal(siblingEvent.id, 'event-2');
  const sibling = (path: string, method: string, body?: unknown) => send(method, `/${siblingEvent.id}${path}`, { body, child: 'kid-a' });
  for (const response of [
    await sibling('', 'PUT', { ...validEvent, expected_revision: 1 }),
    await send('DELETE', `/${siblingEvent.id}?expected_revision=1`),
    await sibling('/stop-repeat', 'POST', { expected_revision: 1 }),
  ]) {
    assert.equal(response.status, 404); assert.equal((await json(response)).error.code, 'CALENDAR_EVENT_NOT_FOUND');
  }
  assert.equal(fake.rows.get(siblingEvent.id)?.profile, 'sibling');
  assert.equal(fake.rows.get(siblingEvent.id)?.event.title, 'Swim');

  // Revision conflicts keep the current event for the client draft.
  const stale = await send('PUT', `/${piano.id}`, { body: { ...validEvent, title: 'Violin', expected_revision: 2 } });
  assert.equal(stale.status, 409); assert.equal((await json(stale)).error.details?.current?.revision, 1);
  const staleDelete = await send('DELETE', `/${piano.id}?expected_revision=2`);
  assert.equal(staleDelete.status, 409); assert.equal((await json(staleDelete)).error.details?.current?.id, piano.id);
  const staleStop = await send('POST', `/${piano.id}/stop-repeat`, { body: { expected_revision: 2 } });
  assert.equal(staleStop.status, 409); assert.equal((await json(staleStop)).error.code, 'CALENDAR_REVISION_CONFLICT');
  // Sibling probes and stale attempts reach the repository (which enforces ownership and revisions), nothing else.
  assert.deepEqual(fake.calls, ['create', 'create', 'update', 'delete', 'stop-repeat', 'update', 'delete', 'stop-repeat']);

  // Successful update, stop-repeat and delete.
  const updated = await send('PUT', `/${piano.id}`, { body: { ...validEvent, title: 'Violin', expected_revision: 1 } });
  assert.equal(updated.status, 200); assert.equal((await updated.json() as CalendarEvent).revision, 2);
  const stopped = await send('POST', `/${piano.id}/stop-repeat`, { body: { expected_revision: 2 } });
  assert.equal(stopped.status, 200); assert.equal((await stopped.json() as CalendarEvent).repeat, 'none');
  const deleted = await send('DELETE', `/${piano.id}?expected_revision=3`);
  assert.equal(deleted.status, 204); assert.equal(await deleted.text(), '');
  assert.equal((await send('DELETE', `/${piano.id}?expected_revision=3`)).status, 404);

  // Create and update validation: 422 before the repository is called.
  const callsBefore = fake.calls.length;
  const invalidCreates: unknown[] = [
    { ...validEvent, title: '' },
    { ...validEvent, title: ' \u0007\u0008 ' },
    { ...validEvent, title: 'x'.repeat(41) },
    { ...validEvent, title: 42 },
    { ...validEvent, icon_key: 'unknown_icon' },
    { ...validEvent, icon_key: 'tablet' },
    { ...validEvent, start_date: addDays(today, -1) },
    { ...validEvent, start_date: addDays(today, 366) },
    { ...validEvent, start_date: '2026-02-30' },
    { ...validEvent, start_date: '2026-10-1' },
    { ...validEvent, start_date: 20261029 },
    { ...validEvent, repeat: 'daily' },
    { title: 'Piano', icon_key: 'music_lesson', start_date: today },
    { ...validEvent, id: 'event-9' },
    { ...validEvent, profile_id: 'foreign' },
    { ...validEvent, family_id: 'foreign' },
    { ...validEvent, expected_revision: 1 },
    { ...validEvent, repeat_ended_on: today },
    ['not', 'an', 'object'],
  ];
  for (const body of invalidCreates) assert.equal((await send('POST', '', { body })).status, 422, JSON.stringify(body));
  for (const body of [{ ...validEvent }, { ...validEvent, expected_revision: undefined }, { ...validEvent, expected_revision: 0 }, { ...validEvent, expected_revision: '1' }, { ...validEvent, expected_revision: 2147483647 }, { ...validEvent, expected_revision: 1.5 }]) {
    assert.equal((await send('PUT', `/${piano.id}`, { body })).status, 422, JSON.stringify(body));
  }
  assert.equal((await send('POST', `/${piano.id}/stop-repeat`, { body: {} })).status, 422);
  assert.equal((await send('POST', `/${piano.id}/stop-repeat`, { body: { expected_revision: 1, extra: true } })).status, 422);
  assert.equal(fake.calls.length, callsBefore);

  // Boundary dates and title length are accepted.
  for (const body of [{ ...validEvent, title: 'x'.repeat(40), start_date: today }, { ...validEvent, start_date: addDays(today, 365), repeat: 'yearly' }]) {
    assert.equal((await send('POST', '', { body })).status, 201);
  }

  // DELETE query strictness.
  const callsBeforeDeleteQueries = fake.calls.length;
  for (const query of ['', '?expected_revision=0', '?expected_revision=01', '?expected_revision=1&expected_revision=1', '?expected_revision=1&other=1', '?expected_revision=abc']) {
    assert.equal((await send('DELETE', `/${piano.id}${query}`)).status, 422, query);
  }
  assert.equal(fake.calls.length, callsBeforeDeleteQueries);

  // Malformed path ids, method mismatches and bodies.
  assert.equal((await send('PUT', '/bad%20id', { body: { ...validEvent, expected_revision: 1 } })).status, 400);
  for (const [method, path] of [['PUT', ''], ['DELETE', ''], ['GET', ''], ['POST', `/${piano.id}`], ['GET', `/${piano.id}`], ['PATCH', `/${piano.id}`], ['GET', `/${piano.id}/stop-repeat`], ['DELETE', `/${piano.id}/stop-repeat`]] as const) {
    const response = await send(method, path, method === 'GET' ? {} : { body: validEvent });
    assert.equal(response.status, 405, `${method} ${path}`); assert.equal((await json(response)).error.code, 'METHOD_NOT_ALLOWED');
  }
  assert.equal((await send('POST', '', { raw: '{not json' })).status, 400);
  const oversized = await send('POST', '', { body: { ...validEvent, padding: 'x'.repeat(2_000_000) } });
  assert.equal(oversized.status, 413);
});

test('editing a started series keeps its anchor while future events follow the creation range', async () => {
  const family = { id: 'family-a', role: 'family' };
  const fake = fakeEvents();
  const started = addDays(today, -28); // A weekly series that began four weeks ago.
  fake.seed('kid-a', { id: 'started-1', title: 'Swim', icon_key: 'swimming_pool', start_date: started, repeat: 'weekly', repeat_ended_on: null, revision: 3 });
  fake.seed('kid-a', { id: 'future-1', title: 'Dentist', icon_key: 'dentist', start_date: addDays(today, 2), repeat: 'none', repeat_ended_on: null, revision: 1 });
  const db = {
    auth: { async findFamilyBySessionHash(hash: string) { return hash === hashSessionToken('token') ? family : null; } },
    profiles: { async get(owner: string, id: string) { return owner === family.id && id === 'kid-a' ? { id } : null; } },
    calendarEvents: fake.repository,
  } as unknown as AppDatabase;
  const app = createApp({ db, config: loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@localhost/test', ALLOWED_ORIGINS: 'https://app.example.com', ALLOWED_FORWARDED_HOSTS: 'app.example.com', MAX_BODY_BYTES: '1024' }), logger: { info() {}, warn() {}, error() {} } });
  const put = (id: string, body: object) => app.request(`https://app.example.com/api/v1/profiles/kid-a/calendar/events/${id}`, {
    method: 'PUT', headers: { origin: 'https://app.example.com', cookie: 'plg_session=token', 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const base = { title: 'Swim', icon_key: 'swimming_pool', start_date: started, repeat: 'weekly' };

  const edited = await put('started-1', { ...base, title: 'Laps', icon_key: 'beach', expected_revision: 3 });
  assert.equal(edited.status, 200);
  assert.deepEqual(await edited.json(), { id: 'started-1', title: 'Laps', icon_key: 'beach', start_date: started, repeat: 'weekly', repeat_ended_on: null, revision: 4 });

  const moved = await put('started-1', { ...base, start_date: addDays(today, 1), expected_revision: 4 });
  assert.equal(moved.status, 422); assert.equal((await moved.json() as { error: { code: string } }).error.code, 'VALIDATION_ERROR');
  assert.equal(fake.rows.get('started-1')?.event.start_date, started);

  const futureMoved = await put('future-1', { title: 'Dentist', icon_key: 'dentist', start_date: addDays(today, 10), repeat: 'none', expected_revision: 1 });
  assert.equal(futureMoved.status, 200); assert.equal((await futureMoved.json() as CalendarEvent).start_date, addDays(today, 10));
  const tooFar = await put('future-1', { title: 'Dentist', icon_key: 'dentist', start_date: addDays(today, 400), repeat: 'none', expected_revision: 2 });
  assert.equal(tooFar.status, 422);
  const yesterday = await put('future-1', { title: 'Dentist', icon_key: 'dentist', start_date: addDays(today, -1), repeat: 'none', expected_revision: 2 });
  assert.equal(yesterday.status, 422);
  const malformed = await put('future-1', { title: 'Dentist', icon_key: 'dentist', start_date: '2026-02-30', repeat: 'none', expected_revision: 2 });
  assert.equal(malformed.status, 422);
});

test('kid event routes fail closed when the calendar store is unavailable', async () => {
  const family = { id: 'family-a', role: 'family' };
  const db = {
    auth: { async findFamilyBySessionHash(hash: string) { return hash === hashSessionToken('token') ? family : null; } },
    profiles: { async get(owner: string, id: string) { return owner === family.id && id === 'kid-a' ? { id } : null; } },
  } as unknown as AppDatabase;
  const app = createApp({ db, config: loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@localhost/test', ALLOWED_ORIGINS: 'https://app.example.com', ALLOWED_FORWARDED_HOSTS: 'app.example.com', MAX_BODY_BYTES: '1024' }), logger: { info() {}, warn() {}, error() {} } });
  const response = await app.request('https://app.example.com/api/v1/profiles/kid-a/calendar/events', {
    method: 'POST', headers: { origin: 'https://app.example.com', cookie: 'plg_session=token', 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(((await response.json()) as { error: { code: string } }).error.code, 'CALENDAR_UNAVAILABLE');
});
