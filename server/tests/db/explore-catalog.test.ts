import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from '../../src/db/index.js';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { hashSessionToken } from '../../src/auth.js';
import type { MapView, MapLeaves } from '../../src/explore/contracts.js';

test('authenticated cached catalog keeps publication and family/child access current', { skip: process.env.TEST_DATABASE_URL ? false : 'TEST_DATABASE_URL is not configured' }, async () => {
  const url = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((x): x is string => Boolean(x)));
  const pool = new Pool({ connectionString: url, max: 2 }), db = createDatabase(url);
  const prefix = `cache-${randomUUID()}`, familyA = `${prefix}-a`, familyB = `${prefix}-b`, familyC = `${prefix}-c`, familyD = `${prefix}-d`;
  const kidA = `${prefix}-kid-a`, siblingA = `${prefix}-sibling`, kidB = `${prefix}-kid-b`;
  const tokenA = `${prefix}-session-a`, tokenB = `${prefix}-session-b`, tokenD = `${prefix}-session-d`;
  const id = (name: string) => `${prefix}-${name}`;
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    for (const family of [familyA, familyB, familyC, familyD]) await pool.query("INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,'Explore cache test','not-a-login-hash')", [family, `${family}@example.test`]);
    for (const [kid, family] of [[kidA, familyA], [siblingA, familyA], [kidB, familyB]]) {
      await pool.query("INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES($1,$2,'Test learner','⭐','blue',$1)", [kid, family]);
    }
    for (const [token, family] of [[tokenA, familyA], [tokenB, familyB], [tokenD, familyD]]) {
      await pool.query("INSERT INTO sessions(id,token_hash,family_id,expires_at) VALUES($1,$2,$3,clock_timestamp()+interval '10 minutes')", [token, hashSessionToken(token!), family]);
    }
    const records = [
      ['common', null, true], ['unpublished-common', null, false],
      ['owned-a', familyA, true], ['draft-a', familyA, false],
      ['shared', familyC, true], ['shared-draft', familyC, false],
      ['child-only', familyC, true], ['private-b', familyB, true],
    ] as const;
    for (const [name, owner, published] of records) {
      await pool.query("INSERT INTO items(id,category,latitude,longitude,source_type,owner_family_id,is_published) VALUES($1,'phenomenon',1,1,$2,$3,$4)",
        [id(name), owner ? 'family' : 'system', owner, published]);
      await pool.query("INSERT INTO item_translations(id,item_id,lang,title) VALUES($1,$1,'en',$2)", [id(name), name]);
    }
    await pool.query("INSERT INTO quiz_questions(id,item_id,lang,question,question_type,options,correct_answers) VALUES($1,$2,'en','Question','single','[]','[]')", [id('question-with-different-id'), id('common')]);
    for (const name of ['shared', 'shared-draft']) await pool.query('INSERT INTO lesson_audiences(id,item_id,target_family_id,granted_by_family_id) VALUES($1,$2,$3,$4)', [id(`${name}-grant`), id(name), familyA, familyC]);
    await pool.query('INSERT INTO lesson_audiences(id,item_id,target_profile_id,granted_by_family_id) VALUES($1,$2,$3,$4)', [id('child-grant'), id('child-only'), kidA, familyC]);
    const app = createApp({ db, config: loadConfig({ NODE_ENV: 'test', DATABASE_URL: url, ALLOWED_ORIGINS: 'https://app.example.com', ALLOWED_FORWARDED_HOSTS: 'app.example.com' }),
      logger: { info() {}, warn() {}, error() {} } });
    const request = (token?: string, profile?: string, path = '/api/v1/items?category=phenomenon&limit=5000') => app.request(`https://app.example.com${path}${profile ? `&profile_id=${profile}` : ''}`,
      { headers: token ? { cookie: `plg_session=${token}` } : {} });
    const mapPath = '/api/v1/items/map/views?categories=phenomenon&zoom=18&bounds=-180,-90,180,90';
    const list = async (token: string, profile?: string) => {
      const response = await request(token, profile);
      assert.equal(response.status, 200, await response.clone().text());
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const rows = await response.json() as { id: string; title: string; has_quiz: boolean }[];
      const mapResponse = await request(token, profile, mapPath);
      assert.equal(mapResponse.status, 200, await mapResponse.clone().text());
      assert.equal(mapResponse.headers.get('cache-control'), 'no-store');
      const view = await mapResponse.json() as MapView;
      const mapIds: string[] = [];
      for (const feature of view.features) {
        if (feature.item) mapIds.push(feature.item.id);
        else for (let offset = 0; offset < feature.count; offset += 500) {
          const leaves = await request(token, profile, `/api/v1/items/map/clusters/${feature.id}/leaves?categories=phenomenon&version=${view.version}&offset=${offset}&limit=500`);
          assert.equal(leaves.status, 200, await leaves.clone().text());
          mapIds.push(...(await leaves.json() as MapLeaves).items.map(i => i.id));
        }
      }
      assert.deepEqual(mapIds.sort(), rows.map(i => i.id).sort(), 'prepared clusters contain exactly the currently authorized catalog');
      return rows.filter(row => row.id.startsWith(prefix));
    };
    const names = (rows: { id: string }[]) => rows.map(row => row.id.slice(prefix.length + 1)).sort();
    assert.deepEqual(names(await list(tokenA, kidA)), ['child-only', 'common', 'owned-a', 'shared']);
    assert.deepEqual(names(await list(tokenA, siblingA)), ['common', 'owned-a', 'shared']);
    assert.deepEqual(names(await list(tokenA)), ['common', 'owned-a', 'shared']);
    assert.deepEqual(names(await list(tokenB, kidB)), ['common', 'private-b']);
    assert.equal((await list(tokenA, kidA)).find(row => row.id === id('common'))?.has_quiz, true);
    const commonMap = await (await request(tokenD, undefined, mapPath)).json() as MapView;
    assert.equal(commonMap.shared, true);
    assert.deepEqual(await (await request(tokenD, undefined, `${mapPath}&known_version=${commonMap.validator}`)).json(),
      { version: commonMap.version, validator: commonMap.validator, not_modified: true });
    const cleanProfile = await (await request(tokenA, kidA, mapPath)).json() as MapView;
    const spacedProfile = await (await request(tokenA, `%20${kidA}%20`, mapPath)).json() as MapView;
    assert.equal(spacedProfile.version, cleanProfile.version, 'authorization and projection use the same parsed profile ID');
    assert.deepEqual(names(await list(tokenA, `%20${kidA}%20`)), names(await list(tokenA, kidA)), 'catalog uses the same normalized profile as authorization');

    // Completion is request-local even when catalog and hierarchy snapshots are hot.
    const progressView = async (token: string, profile: string, progress: string, known?: string) => {
      const response = await request(token, profile, `${mapPath}&progress=${progress}${known ? `&known_version=${known}` : ''}`);
      assert.equal(response.status, 200, await response.clone().text());
      assert.equal(response.headers.get('cache-control'), 'no-store');
      return await response.json() as MapView;
    };
    const emptyDone = await progressView(tokenA, kidA, 'done');
    assert.equal(emptyDone.total, 0); assert.deepEqual(emptyDone.features, []); assert.equal(emptyDone.shared, false);
    const snapshots = async () => (await pool.query('SELECT id,payload FROM explore_snapshots ORDER BY id')).rows;
    const beforeProgress = await snapshots();
    const revisions = (await pool.query('SELECT * FROM explore_revisions')).rows;
    for (const name of ['common', 'child-only']) await pool.query(
      "INSERT INTO profile_progress(id,profile_id,item_id,category) VALUES($1,$2,$3,'phenomenon')",
      [id(`done-${name}`), kidA, id(name)]);
    const doneView = await progressView(tokenA, kidA, 'done', emptyDone.validator);
    assert.equal(doneView.total, 2); assert.equal(doneView.features.reduce((n, f) => n + f.count, 0), 2);
    assert.notEqual(doneView.version, emptyDone.version); assert.notEqual(doneView.validator, emptyDone.validator);
    assert.equal(doneView.shared, false);
    const filteredLeafPath = `/api/v1/items/map/clusters/${doneView.features[0]!.id}/leaves?categories=phenomenon&progress=done`;
    const completedIds: string[] = [];
    for (let offset = 0; offset < 2; offset++) {
      const response = await request(tokenA, kidA, `${filteredLeafPath}&version=${doneView.version}&offset=${offset}&limit=1`);
      assert.equal(response.status, 200);
      const page = await response.json() as MapLeaves;
      assert.equal(page.total, 2); assert.equal(page.next_offset, offset === 0 ? 1 : null);
      completedIds.push(...page.items.map(i => i.id));
    }
    assert.deepEqual(completedIds.sort(), [id('common'), id('child-only')].sort());
    assert.equal((await request(tokenA, kidA, `${filteredLeafPath}&version=${emptyDone.version}`)).status, 409);
    assert.equal((await request(tokenA, siblingA, `${filteredLeafPath}&version=${doneView.version}`)).status, 409);
    for (const [token, profile] of [[tokenA, siblingA], [tokenB, kidB]]) {
      const isolated = await progressView(token!, profile!, 'done', doneView.validator);
      assert.equal(isolated.total, 0); assert.notEqual(isolated.version, doneView.version);
    }
    const todoView = await progressView(tokenA, kidA, 'todo');
    assert.equal(todoView.total, cleanProfile.total - 2);
    assert.equal(todoView.features.reduce((n, f) => n + f.count, 0), todoView.total);
    assert.equal((await progressView(tokenA, kidA, 'all')).version, cleanProfile.version);
    assert.deepEqual(await snapshots(), beforeProgress, 'completion must not alter snapshot bytes or persist private views');
    assert.deepEqual((await pool.query('SELECT * FROM explore_revisions')).rows, revisions, 'progress does not invalidate shared revisions');
    for (const progress of ['todo', 'done']) {
      assert.equal((await request(tokenB, kidA, `${mapPath}&progress=${progress}`)).status, 404);
      assert.equal((await request(undefined, kidA, `${mapPath}&progress=${progress}`)).status, 401);
      assert.equal((await request(tokenA, undefined, `${mapPath}&progress=${progress}`)).status, 400);
    }
    assert.equal((await request(tokenB, kidA, `${filteredLeafPath}&version=${doneView.version}`)).status, 404);
    // The data-access boundary also defends against a mismatched family/profile.
    const deniedProgress = await db.explore!.view({ familyId: familyB, profileId: kidA, categories: ['phenomenon'], year: null,
      progress: 'done', zoom: 18, bounds: [-180, -90, 180, 90], offset: 0, limit: 200 });
    assert.ok(!('not_modified' in deniedProgress)); assert.equal(deniedProgress.total, 0);

    await pool.query("INSERT INTO item_translations(id,item_id,lang,title) VALUES($1,$3,'aa','First fallback'),($2,$3,'zz','Last fallback')", [id('fallback-aa'), id('fallback-zz'), id('common')]);
    assert.equal((await list(tokenA, kidA)).find(row => row.id === id('common'))?.title, 'common', 'English remains preferred');
    await pool.query("DELETE FROM item_translations WHERE item_id=$1 AND lang='en'", [id('common')]);
    assert.equal((await list(tokenA, kidA)).find(row => row.id === id('common'))?.title, 'First fallback', 'fallback follows language order');
    await pool.query('UPDATE item_translations SET title=$1 WHERE id=$2', ['x'.repeat(1025), id('fallback-aa')]);
    assert.equal((await request(tokenA, kidA)).status, 503, 'oversized metadata fails before materializing an unbounded catalog');
    await pool.query("UPDATE item_translations SET title='First fallback' WHERE id=$1", [id('fallback-aa')]);

    // Repeat against hot scoped/common snapshots, then revoke through raw SQL.
    await Promise.all(Array.from({ length: 10 }, (_, i) => list(i % 2 ? tokenA : tokenB, i % 2 ? kidA : kidB)));
    assert.equal((await request()).status, 401);
    assert.equal((await request(undefined, undefined, mapPath)).status, 401);
    assert.equal((await request(tokenB, kidA)).status, 404);
    assert.equal((await request(tokenB, kidA, mapPath)).status, 404);
    await pool.query('INSERT INTO family_disabled_lessons(family_id,item_id) VALUES($1,$2)', [familyA, id('common')]);
    assert.deepEqual(names(await list(tokenA, kidA)), ['child-only', 'owned-a', 'shared']);
    assert.equal((await progressView(tokenA, kidA, 'done', doneView.validator)).total, 1, 'disabled lessons disappear from hot progress views');
    assert.deepEqual(names(await list(tokenB, kidB)), ['common', 'private-b']);
    await pool.query('DELETE FROM lesson_audiences WHERE id=$1', [id('child-grant')]);
    assert.deepEqual(names(await list(tokenA, kidA)), ['owned-a', 'shared']);
    assert.equal((await progressView(tokenA, kidA, 'done', doneView.validator)).total, 0, 'revoked child grants disappear from hot progress views');
    await pool.query('UPDATE items SET is_published=false WHERE id=$1', [id('shared')]);
    assert.deepEqual(names(await list(tokenA, kidA)), ['owned-a']);
    await pool.query('DELETE FROM sessions WHERE token_hash=$1', [hashSessionToken(tokenB)]);
    assert.equal((await request(tokenB, kidB)).status, 401, 'a hot cache cannot revive a revoked session');
    assert.equal((await request(tokenB, kidB, mapPath)).status, 401);
    assert.equal((await request(tokenB, kidB, `${mapPath}&progress=done`)).status, 401);
    await pool.query('DELETE FROM sessions WHERE token_hash=$1', [hashSessionToken(tokenD)]);
    assert.equal((await request(tokenD, undefined, `${mapPath}&known_version=${commonMap.validator}`)).status, 401, 'shared browser reuse still authenticates');
  } finally {
    await pool.query('DELETE FROM items WHERE id LIKE $1', [`${prefix}%`]);
    await pool.query('DELETE FROM families WHERE id IN ($1,$2,$3,$4)', [familyA, familyB, familyC, familyD]);
    await db.close!(); await pool.end();
  }
});
