import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashSessionToken } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import type { AppDatabase } from '../src/contracts/db.js';

const family = { id: 'family-a', email: 'parent@example.test', displayName: 'Family A', passwordHash: 'stored', role: 'family', isActive: true };
const window = {
  today: '2026-10-29', timezone: 'Asia/Ho_Chi_Minh', weeks: [], meal_library: [], events: [], system_events: [],
  templates: { '4': { study_morning: { id: 'thursday-template', items: [{ subject: 'math' }], revision: 2, source: 'template' } } },
};

function fixture(options: { calendar?: boolean } = {}) {
  let elevated = false, reads = 0;
  const calendar = {
    async read(profileId: string, now: Date) {
      assert.equal(profileId, 'kid-a');
      assert.ok(now instanceof Date);
      reads++;
      return window;
    },
  };
  const db = {
    auth: {
      async findFamilyBySessionHash(hash: string) { return hash === hashSessionToken('token') ? family : null; },
      async parentAccess(hash: string, familyId: string) {
        assert.equal(hash, hashSessionToken('token'));
        assert.equal(familyId, 'family-a');
        return elevated ? { method: 'password' as const, until: new Date(Date.now() + 60_000) } : null;
      },
    },
    profiles: { async get(familyId: string, id: string) { assert.equal(familyId, 'family-a'); return id === 'kid-a' ? { id } : null; } },
    ...(options.calendar === false ? {} : { calendar }),
  } as unknown as AppDatabase;
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@localhost/test', ALLOWED_ORIGINS: 'https://app.example.com', ALLOWED_FORWARDED_HOSTS: 'app.example.com', MAX_BODY_BYTES: '1024' });
  const app = createApp({ db, config, logger: { info() {}, warn() {}, error() {} } });
  const send = (method: string, path: string, cookie = 'token') => app.request(`https://app.example.com/api/v1/parent/calendar/${path}`, {
    method, headers: cookie ? { cookie: `plg_session=${cookie}`, 'content-type': 'application/json' } : { 'content-type': 'application/json' },
    ...(method === 'GET' || method === 'HEAD' ? {} : { body: JSON.stringify({ expected_revision: 0, items: [] }) }),
  });
  return {
    send,
    setElevated(value: boolean) { elevated = value; },
    reads: () => reads,
  };
}

test('parent calendar requires the parent capability and the session family', async () => {
  const { send, setElevated, reads } = fixture();

  assert.equal((await send('GET', 'kid-a', '')).status, 401);
  const denied = await send('GET', 'kid-a');
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).error.code, 'PARENT_ACCESS_REQUIRED');
  assert.equal(reads(), 0, 'no calendar read without the parent capability');

  setElevated(true);
  assert.equal((await send('GET', 'foreign-kid')).status, 404, 'a profile in another family is hidden');
  assert.equal((await send('GET', 'missing-kid')).status, 404, 'an unknown profile is hidden');
  assert.equal((await send('GET', encodeURIComponent('bad id!'))).status, 400, 'path ids are validated');
  assert.equal(reads(), 0, 'foreign and unknown profiles never reach the calendar repository');
});

test('parent calendar returns the kid read projection as private no-store JSON', async () => {
  const { send, setElevated, reads } = fixture();
  setElevated(true);

  const response = await send('GET', 'kid-a');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  assert.deepEqual(await response.json(), window);
  assert.equal(reads(), 1);

  // The parent surface has no weather provider route; only the kid calendar exposes it.
  assert.equal((await send('GET', 'kid-a/weather')).status, 404);
});

test('parent calendar is strictly read-only and rejects other methods after the capability check', async () => {
  const { send, setElevated, reads } = fixture();
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const denied = await send(method, 'kid-a');
    assert.equal(denied.status, 403, `${method} needs the parent capability before method checks`);
  }
  setElevated(true);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await send(method, 'kid-a');
    assert.equal(response.status, 405, `${method} is not a parent calendar method`);
    assert.equal(response.headers.get('allow'), 'GET');
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  }
  assert.equal(reads(), 0);
});

test('parent calendar reports unavailable storage without leaking details', async () => {
  const { send, setElevated } = fixture({ calendar: false });
  setElevated(true);
  const response = await send('GET', 'kid-a');
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'CALENDAR_UNAVAILABLE');
});
