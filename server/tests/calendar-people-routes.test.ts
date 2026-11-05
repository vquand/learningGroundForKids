import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashSessionToken } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import type { AppDatabase } from '../src/contracts/db.js';

test('people search is owned-profile scoped and settings writes require a parent capability', async () => {
  let elevated = false, searches = 0, writes = 0;
  const family = { id: 'family-a', email: 'parent@example.test', displayName: 'Family', passwordHash: 'stored', role: 'family', isActive: true };
  const db = {
auth: { async findFamilyBySessionHash(hash: string) { return hash === hashSessionToken('token') ? family : null; }, async parentAccess() { return elevated ? { method: 'password', until: new Date(Date.now() + 60000) } : null; } },
    profiles: { async get(familyId: string, id: string) { assert.equal(familyId, 'family-a'); return id === 'kid-a' ? { id } : null; } },
    calendarPeople: { async candidates(id: string, q: string) { assert.equal(id, 'kid-a'); assert.equal(q, 'Na'); searches++; return { roles: ['mom', 'friend'], profiles: [], has_more: false }; }, async settings(id: string) { assert.equal(id, 'family-a'); return { disabled_roles: ['dad'], revision: 1 }; }, async saveSettings(id: string, body: unknown) { assert.equal(id, 'family-a'); writes++; return body; } },
} as unknown as AppDatabase;
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@localhost/test', ALLOWED_ORIGINS: 'https://app.example.com', ALLOWED_FORWARDED_HOSTS: 'app.example.com', MAX_BODY_BYTES: '2048' });
  const app = createApp({ db, config, logger: { info() { }, warn() { }, error() { } } });
  const send = (path: string, method = 'GET', body?: unknown, cookie = 'token') => app.request(`https://app.example.com/api/v1/${path}`, { method, headers: { ...(cookie ? { cookie: `plg_session=${cookie}` } : {}), 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal((await send('profiles/kid-a/calendar/participants?q=Na', 'GET', undefined, '')).status, 401);
  assert.equal((await send('profiles/foreign/calendar/participants?q=Na')).status, 404);
  assert.equal(searches, 0);
  const response = await send('profiles/kid-a/calendar/participants?q=Na'); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control') ?? '', /no-store/); assert.equal(searches, 1);
  for (const query of ['q=Na&q=Other', 'q=' + ('a'.repeat(65)), 'family_id=foreign']) assert.equal((await send('profiles/kid-a/calendar/participants?' + query)).status, 422);
  assert.equal((await send('parent/calendar-settings')).status, 403);
  assert.equal((await send('parent/calendar-settings', 'PUT', { disabled_roles: ['dad'], expected_revision: 0 })).status, 403); assert.equal(writes, 0);
  elevated = true;
  assert.equal((await send('parent/calendar-settings')).status, 200);
  assert.equal((await send('parent/calendar-settings', 'PUT', { disabled_roles: ['dad'], expected_revision: 0, family_id: 'other' })).status, 422);
  assert.equal((await send('parent/calendar-settings', 'PUT', { disabled_roles: ['friend'], expected_revision: 0 })).status, 422);
  assert.equal((await send('parent/calendar-settings', 'PUT', { disabled_roles: ['dad'], expected_revision: 0 })).status, 200); assert.equal(writes, 1);
  assert.equal((await send('parent/calendar-settings', 'DELETE')).status, 405);
});
