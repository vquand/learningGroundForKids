import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { hashSessionToken } from '../../src/auth.js';
import { createDatabase } from '../../src/db/index.js';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';

const configured = process.env.TEST_DATABASE_URL;
test('profile tour persists once under concurrent completion and enforces family ownership',
  { skip: configured ? false : 'TEST_DATABASE_URL is not configured' }, async () => {
    const url = assertSafeTestDatabaseUrl(configured!, [process.env.DATABASE_URL ?? '', process.env.DATABASE_URL_UNPOOLED ?? '']);
    const pool = new Pool({ connectionString: url });
    const db = createDatabase(url);
    const familyId = randomUUID(), otherFamilyId = randomUUID(), token = randomUUID();
    try {
      await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
      for (const id of [familyId, otherFamilyId]) {
        await db.auth.createFamily({ id, email: `${id}@test.local`, displayName: 'Tour test', passwordHash: 'unused', role: 'family' });
      }
      const input = { name: 'Kid', emoji: '🙂', color: 'blue' };
      const profile = await db.profiles.create(familyId, input);
      const other = await db.profiles.create(otherFamilyId, input);
      assert.equal(profile.tour_completed_at, null);
      await db.auth.createSession({ familyId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60_000) });
      const app = createApp({ db, config: loadConfig({ NODE_ENV: 'test', DATABASE_URL: url,
        ALLOWED_ORIGINS: 'https://tour.test', ALLOWED_FORWARDED_HOSTS: 'tour.test' }) });
      const request = (id: string, method = 'GET', body?: string, authenticated = true) =>
        app.request(`https://tour.test/api/v1/profiles/${id}/tour${method === 'POST' ? '/complete' : ''}`, {
          method, headers: { origin: 'https://tour.test', 'content-type': 'application/json',
            ...(authenticated ? { cookie: `plg_session=${token}` } : {}) }, ...(body === undefined ? {} : { body }),
        });
      assert.deepEqual(await (await request(profile.id)).json(), { completed: false });
      for (const method of ['GET', 'POST']) {
        const body = method === 'POST' ? '{}' : undefined;
        assert.equal((await request(profile.id, method, body, false)).status, 401);
        for (const id of [other.id, randomUUID()]) assert.equal((await request(id, method, body)).status, 404);
      }
      assert.equal(await db.profiles.completeTour(familyId, other.id), null);
      assert.equal(await db.profiles.completeTour(familyId, randomUUID()), null);
      for (const body of ['{"tour_completed_at":"2000-01-01"}', '{"family_id":"foreign"}', '{"completed":true}', '[]', 'null']) {
        assert.equal((await request(profile.id, 'POST', body)).status, 422);
      }
      assert.equal((await db.profiles.get(familyId, profile.id))?.tour_completed_at, null);
      const responses = await Promise.all(Array.from({ length: 4 }, () => request(profile.id, 'POST', '{}')));
      for (const response of responses) {
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { completed: true });
      }
      const first = await db.profiles.get(familyId, profile.id);
      assert.ok(first?.tour_completed_at);
      const stored = await pool.query('SELECT tour_completed_at FROM profiles WHERE id = $1', [profile.id]);
      assert.ok(stored.rows[0].tour_completed_at instanceof Date);
      assert.equal((await request(profile.id, 'POST', '{}')).status, 200);
      assert.equal((await db.profiles.get(familyId, profile.id))?.tour_completed_at, first.tour_completed_at);
      assert.equal((await db.profiles.list(familyId, 5))[0]?.tour_completed_at, first.tour_completed_at);
      // A separate repository/session read must see the durable completion.
      const reloaded = createDatabase(url);
      try { assert.equal((await reloaded.profiles.get(familyId, profile.id))?.tour_completed_at, first.tour_completed_at); }
      finally { await reloaded.close?.(); }
      assert.deepEqual(await (await request(profile.id)).json(), { completed: true });
      assert.equal((await db.profiles.get(otherFamilyId, other.id))?.tour_completed_at, null);
    } finally {
      await pool.query('DELETE FROM families WHERE id = ANY($1)', [[familyId, otherFamilyId]]);
      await db.close?.();
      await pool.end();
    }
  });
