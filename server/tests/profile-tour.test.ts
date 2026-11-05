import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { profileFromRow } from '../src/db/mappers.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { AppDatabase } from '../src/contracts/db.js';

function fixture() {
  const profile = { id: 'kid-a', name: 'Kid', emoji: '🙂', color: 'blue', public_id: 'KID',
    created_at: new Date(), total_done: 0, badge_count: 0, tour_completed_at: null as Date | null };
  const owners = new Map([[profile.id, 'family-a'], ['other-family-kid', 'family-b']]);
  const db = {
    auth: { async findFamilyBySessionHash() { return { id: 'family-a', role: 'family' }; } },
    profiles: {
      async get(familyId: string, profileId: string) {
        assert.equal(familyId, 'family-a');
        return owners.get(profileId) === familyId ? { ...profile } : null;
      },
      async completeTour(familyId: string, profileId: string) {
        assert.equal(familyId, 'family-a');
        assert.equal(profileId, profile.id);
        profile.tour_completed_at ??= new Date();
        return { ...profile };
      },
    },
  } as unknown as AppDatabase;
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://unused:unused@localhost/unused',
    ALLOWED_ORIGINS: 'https://tour.test', ALLOWED_FORWARDED_HOSTS: 'tour.test' });
  const app = createApp({ config, db, logger: { info() {}, warn() {}, error() {} } });
  const request = (id = profile.id, method = 'GET', body?: string, authenticated = true) =>
    app.request(`https://tour.test/api/v1/profiles/${id}/tour${method === 'POST' ? '/complete' : ''}`, {
      method, headers: { origin: 'https://tour.test', 'content-type': 'application/json',
        ...(authenticated ? { cookie: 'plg_session=opaque' } : {}) }, ...(body === undefined ? {} : { body }),
    });
  return { profile, request };
}

test('profile tour starts incomplete and completion is idempotent across subsequent reads', async () => {
  const f = fixture();
  const initial = await f.request();
  assert.equal(initial.status, 200);
  assert.match(initial.headers.get('cache-control') ?? '', /no-store/);
  assert.deepEqual(await initial.json(), { completed: false });
  assert.deepEqual(await (await f.request('kid-a', 'POST', '{}')).json(), { completed: true });
  const timestamp = f.profile.tour_completed_at;
  assert.ok(timestamp instanceof Date);
  assert.deepEqual(await (await f.request('kid-a', 'POST', '{}')).json(), { completed: true });
  assert.equal(f.profile.tour_completed_at, timestamp);
  assert.deepEqual(await (await f.request()).json(), { completed: true });
});

test('profile tour requires authentication and hides missing or other-family profiles', async () => {
  const f = fixture();
  for (const method of ['GET', 'POST']) {
    const body = method === 'POST' ? '{}' : undefined;
    assert.equal((await f.request('kid-a', method, body, false)).status, 401);
    for (const id of ['missing', 'other-family-kid']) {
      const response = await f.request(id, method, body);
      assert.equal(response.status, 404);
      assert.equal((await response.json()).error.code, 'PROFILE_NOT_FOUND');
    }
  }
  assert.equal(f.profile.tour_completed_at, null);
});

test('profile tour completion accepts only an empty JSON object', async () => {
  const f = fixture();
  for (const body of ['{"tour_completed_at":"2000-01-01"}', '{"completed":true}',
    '{"profile_id":"other-family-kid"}', '{"family_id":"foreign"}', '{"unknown":1}',
    'null', '[]', 'true', '"text"', '{', '']) {
    const response = await f.request('kid-a', 'POST', body);
    assert.equal(response.status, body === '{' || body === '' ? 400 : 422, `body ${body}`);
    assert.equal(f.profile.tour_completed_at, null);
  }
  assert.equal((await f.request('kid-a', 'POST')).status, 400);
  assert.equal(f.profile.tour_completed_at, null);
});

test('profile mapping retains nullable and completed tour timestamps', () => {
  const row = { id: 'kid', name: 'Kid', emoji: '🙂', color: 'blue', publicId: 'KID',
    nativeCountryCode: null, nativeCity: null, avatarType: null, avatarUrl: null, avatarFrame: null,
    createdAt: new Date('2026-11-04T00:00:00Z'), totalDone: 0, badgeCount: 0 };
  assert.equal(profileFromRow({ ...row, tourCompletedAt: null }).tour_completed_at, null);
  const timestamp = new Date('2026-11-04T01:00:00Z');
  assert.equal(profileFromRow({ ...row, tourCompletedAt: timestamp }).tour_completed_at, timestamp.toISOString());
});

test('tour migration is nullable with no default or backfill and has a matching rollback', async () => {
  const migration = await readFile(new URL('../drizzle/0037_profile_tour.sql', import.meta.url), 'utf8');
  assert.match(migration, /ALTER TABLE "profiles" ADD COLUMN "tour_completed_at" timestamp with time zone;/);
  assert.doesNotMatch(migration, /NOT NULL|DEFAULT|UPDATE|INSERT/i);
  const rollback = await readFile(new URL('../drizzle/rollbacks/0037_profile_tour.sql', import.meta.url), 'utf8');
  assert.equal(rollback.trim(), 'ALTER TABLE "profiles" DROP COLUMN "tour_completed_at";');
});
