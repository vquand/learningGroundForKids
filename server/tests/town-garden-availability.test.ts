import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import type { AppConfig } from '../src/config.js';
import type { AppDatabase, FamilyRecord } from '../src/contracts/db.js';
import { createApp } from '../src/app.js';
import { hashSessionToken } from '../src/auth.js';
import { createTownRepository } from '../src/town-building/repository.js';
import { crowdedTown } from './helpers/town-dense.js';

test('a crowded garden heartbeat keeps unrelated API sessions responsive', async () => {
  const state = crowdedTown();state.woolMigrated=true;
  const pool = {
    async query() { return { rows: [{ state, learned_ids: state.learnedIds, revision: state.revision }] }; },
  } as unknown as Pool;
  let now = 1_000;
  const town = createTownRepository(pool, () => now);
  const weather = { season: 'autumn' as const, precipitation: 'none' as const, timeOfDay: 'morning' };
  const unrelatedFamily: FamilyRecord = {
    id: 'another-family', email: 'another@example.com', displayName: 'Another Parent', passwordHash: '', role: 'family',
  };
  const config: AppConfig = {
    nodeEnv: 'test', port: 10000, databaseUrl: 'postgresql://test:test@localhost/test', databaseUrlUnpooled: undefined,
    allowedOrigins: new Set(['https://app.example.com']), allowedForwardedHosts: new Set(['app.example.com']),
    sessionCookieName: 'plg_session', sessionMaxAgeSeconds: 3600, allowRegistration: false,
    maxBodyBytes: 16_384, authRateLimitMax: 10, authRateLimitWindowSeconds: 60, authRateLimitMaxKeys: 100,
    authTrustedProxyCidrs: [], maxMediaBytes: 1_048_576, trustProxyHeaders: false, renderExternalHostname: undefined, s3: undefined,
  };
  const db = {
    town,
    auth: {
      async findFamilyBySessionHash(hash: string) {
        return hash === hashSessionToken('other-family-session') ? unrelatedFamily : null;
      },
    },
  } as unknown as AppDatabase;
  const app = createApp({ config, db, logger: { info() {}, warn() {}, error() {} } });

  // Establish the active-session baseline; the next heartbeat owes five seconds
  // of verified animal contacts and growth, including a crowded herd.
  await town.tick!('crowded-child','town', weather, true);
  now += 5_000;

  const heartbeat = town.tick!('crowded-child','town', weather, false);
  const unrelatedCallback = new Promise<'unrelated callback'>(resolve => setImmediate(() => resolve('unrelated callback')));
  const unrelatedSession = new Promise<Response>((resolve, reject) => setImmediate(() => {
    Promise.resolve(app.request('https://app.example.com/api/v1/auth/session', {
      headers: { cookie: 'plg_session=other-family-session' },
    })).then(resolve, reject);
  }));
  const callbackFirst = Promise.race([heartbeat.then(() => 'heartbeat'), unrelatedCallback]);
  const sessionFirst = Promise.race([heartbeat.then(() => 'heartbeat'), unrelatedSession.then(() => 'session')]);
  assert.equal(await callbackFirst, 'unrelated callback', 'other event-loop work must not wait for the full simulation');
  assert.equal(await sessionFirst, 'session', 'another family must authenticate while simulation is pending');
  const session = await unrelatedSession;
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), {
    authenticated: true,
    user: { id: unrelatedFamily.id, email: unrelatedFamily.email, name: unrelatedFamily.displayName },
    signOutUrl: '/api/v1/auth/logout',
  });
  const result = await heartbeat;
  assert.ok(Math.abs(result.gardening!.activeSeconds - 5) < 1e-6, 'the heartbeat must still simulate the due active time');
  assert.ok(result.entities.find(e => e.blueprintId === 'vegetable-patch')!.garden!.slots.some(slot => slot.growth > 0),
    'at least one plant must grow despite any legitimate animal contact');
});
