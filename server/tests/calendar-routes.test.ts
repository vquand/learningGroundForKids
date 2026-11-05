import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashSessionToken } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import type { AppDatabase } from '../src/contracts/db.js';
import { AppError } from '../src/errors.js';

test('custom subject and rename routes require ownership, strict inputs and private responses', async () => {
  let calls = 0;
  const db = {
    auth: { async findFamilyBySessionHash(hash: string) { return hash === hashSessionToken('token') ? { id: 'family-a', role: 'family' } : null; } },
    profiles: { async get(_family: string, id: string) { return id === 'kid-a' ? { id } : null; } },
    calendar: {
      async addStudy(id: string, input: object) { calls++; assert.equal(id, 'kid-a'); return { id: 'subject-a', ...input }; },
      async updateStudy(id: string, _entry: string, input: object) { calls++; assert.equal(id, 'kid-a'); return { id: 'subject-a', ...input }; },
      async renameItem(id: string) { calls++; assert.equal(id, 'kid-a'); return { id: 'list-a', items: [], revision: 2, source: 'template' }; },
    },
  } as unknown as AppDatabase;
  const app = createApp({ db, config: loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@localhost/test', ALLOWED_ORIGINS: 'https://app.example.com', ALLOWED_FORWARDED_HOSTS: 'app.example.com' }), logger: { info() {}, warn() {}, error() {} } });
  const send = (suffix: string, body: unknown, child = 'kid-a', token = 'token', method = 'POST') => app.request(`https://app.example.com/api/v1/profiles/${child}/calendar${suffix}`, {
    method, headers: { origin: 'https://app.example.com', cookie: token ? `plg_session=${token}` : '', 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const subject = { subject: 'math', name: 'Math in English' };
  const rename = { date: '2026-10-27', area: 'study_morning', index: 0, name: 'Math club', expected_revision: 1, expected_template_revision: 1 };
  for (const [path, body] of [['/subjects', subject], ['/rename-item', rename]] as const) {
    assert.equal((await send(path, body, 'kid-a', '')).status, 401);
    assert.equal((await send(path, body, 'sibling')).status, 404);
    assert.equal((await send(path, { ...body, profile_id: 'other' })).status, 422);
    const result = await send(path, body);
    assert.equal(result.status, path === '/subjects' ? 201 : 200);
    assert.equal(result.headers.get('cache-control'), 'no-store');
  }
  assert.equal((await send('/subjects', { subject: 'invented', name: 'Math' })).status, 422);
  assert.equal((await send('/subjects', { ...subject, name: 'x'.repeat(41) })).status, 422);
  assert.equal((await send('/rename-item', { ...rename, expected_template_revision: undefined })).status, 422);
  const edit = { ...subject, expected_subject: 'math', expected_name: 'Old name' };
  assert.equal((await send('/subjects/subject-a', edit, 'kid-a', 'token', 'PUT')).status, 200);
  assert.equal((await send('/subjects/subject-a', subject, 'kid-a', 'token', 'PUT')).status, 422);
  assert.equal(calls, 3);
});

test('calendar routes authenticate, enforce ownership, bound input and preserve structured private responses', async () => {
  let expired = false, reads = 0, writes = 0;
  const family = { id: 'family-a', role: 'family' };
  const db = {
    auth: { async findFamilyBySessionHash(hash: string) { return !expired && hash === hashSessionToken('token') ? family : null; } },
    profiles: { async get(owner: string, id: string) { return owner === family.id && id === 'kid-a' ? { id } : null; } },
    calendar: {
      async read(id: string) { assert.equal(id, 'kid-a'); reads++; return { today: '2026-10-29', templates: { '1': { study_morning: { id: 'monday-template', items: [{ subject: 'math' }], revision: 2, source: 'template' } } } }; },
      async upsert(id: string, input: { expected_revision: number }) {
        assert.equal(id, 'kid-a'); writes++;
        if (input.expected_revision) throw new AppError(409, 'CALENDAR_REVISION_CONFLICT', 'Changed', { current: { id: 'owned-list', items: [], revision: 1, source: 'template' } });
        return { id: 'owned-list', items: [{ subject: 'math' }], revision: 1, source: 'template' };
      },
      async deleteOverride(id: string) { assert.equal(id, 'kid-a'); writes++; },
    },
  } as unknown as AppDatabase;
  const app = createApp({ db, config: loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@localhost/test', ALLOWED_ORIGINS: 'https://app.example.com', ALLOWED_FORWARDED_HOSTS: 'app.example.com', MAX_BODY_BYTES: '1024' }), logger: { info() {}, warn() {}, error() {} } });
  const body = { scope: 'template', weekday: 1, area: 'study_morning', expected_revision: 0, items: [{ subject: 'math' }] };
  const query = '?date=2026-10-29&area=study_morning&expected_revision=1';
  const send = (method: string, child = 'kid-a', cookie = 'token', data: unknown = body, suffix = method === 'GET' ? '' : '/lists' + (method === 'DELETE' ? query : '')) => app.request(`https://app.example.com/api/v1/profiles/${child}/calendar${suffix}`, {
    method, headers: { origin: 'https://app.example.com', cookie: cookie ? `plg_session=${cookie}` : '', 'content-type': 'application/json' }, ...(method === 'PUT' ? { body: JSON.stringify(data) } : {}),
  });
  for (const method of ['GET', 'PUT', 'DELETE']) {
    assert.equal((await send(method, 'kid-a', '')).status, 401);
    expired = true; assert.equal((await send(method)).status, 401); expired = false;
    assert.equal((await send(method, 'foreign-child')).status, 404);
    assert.equal((await send(method, 'sibling')).status, 404);
  }
  for (const path of ['/api/v1/calendar', '/api/v1/calendar/notifications']) {
    assert.equal((await app.request(`https://app.example.com${path}`)).status, 401);
    expired = true;
    assert.equal((await app.request(`https://app.example.com${path}`, { headers: { cookie: 'plg_session=token' } })).status, 401);
    expired = false;
  }
  assert.equal(reads, 0); assert.equal(writes, 0);
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const result = await send(method); assert.equal(result.status, method === 'DELETE' ? 204 : 200);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    if (method === 'DELETE') assert.equal(await result.text(), '');
    if (method === 'GET') assert.deepEqual(await result.json(), { today: '2026-10-29', templates: { '1': { study_morning: { id: 'monday-template', items: [{ subject: 'math' }], revision: 2, source: 'template' } } } });
  }
  for (const injected of [{ profile_id: 'foreign' }, { id: 'foreign-list' }, { family_id: 'foreign' }, { items: [{ subject: 'fake' }] }, { items: Array(9).fill({ subject: 'math' }) }, { expected_revision: undefined }]) assert.equal((await send('PUT', 'kid-a', 'token', { ...body, ...injected })).status, 422);
  assert.equal((await send('DELETE', 'kid-a', 'token', body, '/lists' + query + '&id=foreign-list')).status, 422);
  for (const method of ['PUT', 'DELETE']) assert.equal((await send(method, 'kid-a', 'token', body, '/lists/foreign-list')).status, 404);
  const medicine = { medicine: { method: 'tablet', color: 'red', qty: 1, dose: '100 ml' } };
  assert.equal((await send('PUT', 'kid-a', 'token', { ...body, area: 'meal_lunch', items: [{ food: 'rice' }, { food: 'custom', icon: 'pho', name: 'Soup' }, medicine] })).status, 200);
  assert.equal((await send('PUT', 'kid-a', 'token', { ...body, area: 'medicine', items: Array(6).fill(medicine) })).status, 200);
  for (const wrong of [
    { area: 'medicine', items: [{ subject: 'math' }] }, { area: 'meal_dinner', items: [{ subject: 'math' }] },
    { area: 'medicine', items: Array(7).fill(medicine) }, { area: 'meal_snack', items: Array(9).fill({ food: 'rice' }) },
    { area: 'meal_lunch', items: [{ food: 'custom', icon: 'tablet', name: 'Soup' }] }, { area: 'meal_lunch', items: [{ food: 'rice', subject: 'math' }] },
  ]) {
    const rejected = await send('PUT', 'kid-a', 'token', { ...body, ...wrong });
    assert.equal(rejected.status, 422, JSON.stringify(wrong)); assert.equal((await rejected.json()).error.code, 'VALIDATION_ERROR');
  }
  const conflict = await send('PUT', 'kid-a', 'token', { ...body, expected_revision: 1 });
  assert.equal(conflict.status, 409); assert.equal((await conflict.json()).error.details.current.revision, 1);
  const oversized = await send('PUT', 'kid-a', 'token', { ...body, padding: 'x'.repeat(2_000_000) });
  assert.equal(oversized.status, 413);
});
