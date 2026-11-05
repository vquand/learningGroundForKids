import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashSessionToken } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import type { AppDatabase } from '../src/contracts/db.js';
import { AppError } from '../src/errors.js';
import { mealLibraryAddSchema } from '../src/calendar/meals.js';

test('meal library schema cleans custom names, rejects blank or long names and unknown foods', () => {
  assert.deepEqual(mealLibraryAddSchema.parse({ food: 'rice', custom_name: '\u0007  Grandma rice\n' }), { food: 'rice', custom_name: 'Grandma rice' });
  assert.deepEqual(mealLibraryAddSchema.parse({ food: 'pho' }), { food: 'pho' });
  assert.equal(mealLibraryAddSchema.parse({ food: 'pho', custom_name: 'x'.repeat(40) }).custom_name, 'x'.repeat(40));
  for (const body of [
    { food: 'rice', custom_name: '' }, { food: 'rice', custom_name: '\u0000 \t\n' }, { food: 'rice', custom_name: 'x'.repeat(41) },
    { food: 'rice', custom_name: null }, { food: 'math' }, { food: 'custom' }, { food: 'tablet' }, { food: 'rice', custom_name: 5 },
    { food: 'rice', extra: true }, { food: 'rice', profile_id: 'foreign' }, {}, [],
  ]) assert.equal(mealLibraryAddSchema.safeParse(body).success, false, JSON.stringify(body));
});

test('meal library routes authenticate, enforce ownership, validate input and return structured no-store responses', async () => {
  let expired = false;
  const calls: { add: unknown[]; remove: unknown[] } = { add: [], remove: [] };
  let full = false;
  const family = { id: 'family-a', role: 'family' };
  const db = {
    auth: { async findFamilyBySessionHash(hash: string) { return !expired && hash === hashSessionToken('token') ? family : null; } },
    profiles: { async get(owner: string, id: string) { return owner === family.id && id === 'kid-a' ? { id } : null; } },
    calendarMeals: {
      async add(profileId: string, input: unknown) {
        calls.add.push([profileId, input]);
        if (full) throw new AppError(422, 'CALENDAR_LIBRARY_FULL', 'The meal library is full.');
        const existing = (input as { food: string }).food === 'rice';
        return { created: !existing, item: { id: existing ? 'rice-row' : 'new-row', food_key: (input as { food: string }).food, custom_name: (input as { custom_name?: string }).custom_name ?? null } };
      },
      async remove(profileId: string, mealId: string) {
        calls.remove.push([profileId, mealId]);
        if (mealId !== 'own-meal') throw new AppError(404, 'CALENDAR_MEAL_NOT_FOUND', 'Meal library item not found.');
      },
    },
  } as unknown as AppDatabase;
  const app = createApp({ db, config: loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@localhost/test', ALLOWED_ORIGINS: 'https://app.example.com', ALLOWED_FORWARDED_HOSTS: 'app.example.com', MAX_BODY_BYTES: '1024' }), logger: { info() {}, warn() {}, error() {} } });
  const send = (method: string, child = 'kid-a', cookie = 'token', body: unknown = { food: 'pho' }, suffix = '') => app.request(`https://app.example.com/api/v1/profiles/${child}/calendar/meals${suffix}`, {
    method, headers: { origin: 'https://app.example.com', cookie: cookie ? `plg_session=${cookie}` : '', 'content-type': 'application/json' },
    ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
  for (const [method, suffix] of [['POST', ''], ['DELETE', '/own-meal']] as const) {
    assert.equal((await send(method, 'kid-a', '', undefined, suffix)).status, 401);
    expired = true; assert.equal((await send(method, 'kid-a', 'token', undefined, suffix)).status, 401); expired = false;
    assert.equal((await send(method, 'foreign-child', 'token', undefined, suffix)).status, 404);
    assert.equal((await send(method, 'sibling', 'token', undefined, suffix)).status, 404);
  }
  assert.equal(calls.add.length, 0); assert.equal(calls.remove.length, 0);

  const created = await send('POST', 'kid-a', 'token', { food: 'pho', custom_name: '\u0001 Mom\'s soup ' });
  assert.equal(created.status, 201); assert.equal(created.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await created.json(), { id: 'new-row', food_key: 'pho', custom_name: 'Mom\'s soup' });
  assert.deepEqual(calls.add.at(-1), ['kid-a', { food: 'pho', custom_name: 'Mom\'s soup' }]);
  const existing = await send('POST', 'kid-a', 'token', { food: 'rice' });
  assert.equal(existing.status, 200); assert.deepEqual(await existing.json(), { id: 'rice-row', food_key: 'rice', custom_name: null });

  for (const body of [
    { food: 'math' }, { food: 'rice', custom_name: '   ' }, { food: 'rice', custom_name: 'x'.repeat(41) }, { food: 'rice', extra: 1 },
    { food: 'rice', profile_id: 'foreign' }, {}, { food: 'custom' }, { food: 'rice', custom_name: 1 },
  ]) {
    const rejected = await send('POST', 'kid-a', 'token', body);
    assert.equal(rejected.status, 422, JSON.stringify(body)); assert.equal((await rejected.json()).error.code, 'VALIDATION_ERROR');
  }
  const malformed = await send('POST', 'kid-a', 'token', '{"food":');
  assert.equal(malformed.status, 400); assert.equal((await malformed.json()).error.code, 'INVALID_JSON');
  const oversized = await send('POST', 'kid-a', 'token', { food: 'pho', padding: 'x'.repeat(2_000_000) });
  assert.equal(oversized.status, 413);
  full = true;
  const capped = await send('POST', 'kid-a', 'token', { food: 'banh_mi' });
  assert.equal(capped.status, 422); assert.equal((await capped.json()).error.code, 'CALENDAR_LIBRARY_FULL');
  full = false;

  for (const [method, path] of [['GET', ''], ['PUT', ''], ['DELETE', ''], ['GET', '/own-meal'], ['POST', '/own-meal'], ['PUT', '/own-meal']] as const) {
    const response = await send(method, 'kid-a', 'token', undefined, path);
    assert.equal(response.status, 405, `${method} ${path}`); assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal((await send('GET', 'foreign-child', 'token', undefined, '')).status, 404, 'ownership is checked before the method');

  const removed = await send('DELETE', 'kid-a', 'token', undefined, '/own-meal');
  assert.equal(removed.status, 204); assert.equal(removed.headers.get('cache-control'), 'no-store'); assert.equal(await removed.text(), '');
  assert.deepEqual(calls.remove.at(-1), ['kid-a', 'own-meal']);
  const foreign = await send('DELETE', 'kid-a', 'token', undefined, '/foreign-meal');
  assert.equal(foreign.status, 404); assert.equal((await foreign.json()).error.code, 'CALENDAR_MEAL_NOT_FOUND');
  assert.equal((await send('DELETE', 'kid-a', 'token', undefined, '/bad%20id')).status, 400);
});

test('meal library routes return 503 when the calendar repository is not configured', async () => {
  const db = {
    auth: { async findFamilyBySessionHash(hash: string) { return hash === hashSessionToken('token') ? { id: 'family-a', role: 'family' } : null; } },
    profiles: { async get(owner: string, id: string) { return owner === 'family-a' && id === 'kid-a' ? { id } : null; } },
  } as unknown as AppDatabase;
  const app = createApp({ db, config: loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@localhost/test', ALLOWED_ORIGINS: 'https://app.example.com', ALLOWED_FORWARDED_HOSTS: 'app.example.com' }), logger: { info() {}, warn() {}, error() {} } });
  const headers = { origin: 'https://app.example.com', cookie: 'plg_session=token', 'content-type': 'application/json' };
  const add = await app.request('https://app.example.com/api/v1/profiles/kid-a/calendar/meals', { method: 'POST', headers, body: JSON.stringify({ food: 'rice' }) });
  assert.equal(add.status, 503); assert.equal((await add.json()).error.code, 'CALENDAR_UNAVAILABLE');
  const remove = await app.request('https://app.example.com/api/v1/profiles/kid-a/calendar/meals/x', { method: 'DELETE', headers });
  assert.equal(remove.status, 503);
});
