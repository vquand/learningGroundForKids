import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { Pool, type PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { SnapshotCache, snapshotIdentity } from '../../src/explore/snapshots.js';
import { PostgresSnapshotStore } from '../../src/explore/postgres-snapshots.js';

test('durable Explore snapshot ownership, restart and invalidation', { skip: process.env.TEST_DATABASE_URL ? false : 'TEST_DATABASE_URL is not configured' }, async t => {
  const url = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((x): x is string => Boolean(x)));
  const pool = new Pool({ connectionString: url, max: 4 });
  const otherPool = new Pool({ connectionString: url, max: 4 });
  const store = new PostgresSnapshotStore(pool);
  const validate = (value: unknown) => {
    assert.ok(value && typeof value === 'object' && 'count' in value && typeof value.count === 'number');
    return value as { count: number };
  };
  const revisions = async () => (await pool.query<{ catalog_revision: string; visibility_revision: string }>('SELECT * FROM explore_revisions WHERE id=1')).rows[0]!;
  const identity = async (kind: 'common' | 'view' = 'common') => {
    const row = await revisions();
    return snapshotIdentity({ kind, catalogRevision: row.catalog_revision, visibilityRevision: row.visibility_revision, scope: 'test-only', variant: randomUUID() });
  };
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    await pool.query('TRUNCATE explore_snapshots, explore_rebuild_jobs');

    await t.test('two API caches and ten readers materialize once; a restart reuses the persisted result', async () => {
      const key = await identity(), a = new SnapshotCache(store), b = new SnapshotCache(new PostgresSnapshotStore(otherPool));
      let source = 0, release!: () => void;
      const barrier = new Promise<void>(resolve => { release = resolve; });
      const build = async () => { source++; await barrier; return { count: 4000 }; };
      const first = a.get(key, build, validate);
      const deadline = performance.now() + 3000;
      while (!source && performance.now() < deadline) await delay(1);
      assert.equal(source, 1);
      const job = await pool.query('SELECT state,fence FROM explore_rebuild_jobs WHERE id=$1', [key.id]);
      assert.deepEqual(job.rows, [{ state: 'running', fence: 1 }], 'claim must be committed before computing');
      const rest = Array.from({ length: 9 }, (_, i) => (i % 2 ? a : b).get(key, build, validate));
      while (!b.stats.waits && performance.now() < deadline) await delay(1);
      assert.ok(b.stats.waits > 0, 'a second cache instance must wait for the durable owner');
      release(); await Promise.all([first, ...rest]);
      assert.equal(source, 1);
      assert.deepEqual(await new SnapshotCache(new PostgresSnapshotStore(otherPool)).get(key, async () => { throw new Error('must reuse durable data'); }, validate), { count: 4000 });
      assert.deepEqual((await pool.query('SELECT state,fence FROM explore_rebuild_jobs WHERE id=$1', [key.id])).rows, [{ state: 'ready', fence: 1 }]);
    });

    await t.test('expired owner is fenced after reclaim, including a late failure callback', async () => {
      const key = await identity();
      const old = await store.claim(key, 'old-owner'); assert.equal(old.state, 'claimed');
      await pool.query("UPDATE explore_rebuild_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [key.id]);
      const next = await new PostgresSnapshotStore(otherPool).claim(key, 'new-owner');
      assert.deepEqual(next, { state: 'claimed', fence: 2 });
      assert.equal(await store.complete(key, 'old-owner', 1, { count: 1 }, 11), false);
      await store.fail(key, 'old-owner', 1);
      assert.equal((await pool.query('SELECT owner FROM explore_rebuild_jobs WHERE id=$1', [key.id])).rows[0].owner, 'new-owner');
      assert.equal(await store.complete(key, 'new-owner', 2, { count: 2 }, 11), true);
      assert.deepEqual(await store.read(key), { count: 2 });
    });

    await t.test('publication queued for a connection retains ownership across the maximum build/publication window', async () => {
      const publisherPool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 1000 });
      let held: PoolClient | undefined;
      const key = await identity();
      let queued!: () => void;
      const ready = new Promise<void>(resolve => { queued = resolve; });
      const cache = new SnapshotCache(new PostgresSnapshotStore(publisherPool));
      const publishing = cache.get(key, async () => {
        held = await publisherPool.connect(); queued(); return { count: 1 };
      }, validate);
      const outcome = publishing.then(() => null, error => error);
      try {
        await ready;
        // Advance the lease's age without a 16-second wall-clock sleep. Source
        // has settled; publication is queued behind our held connection. The
        // old 15s lease would now allow duplicate materialization in another API.
        await pool.query("UPDATE explore_rebuild_jobs SET lease_until=lease_until-interval '16 seconds' WHERE id=$1", [key.id]);
        assert.equal((await new PostgresSnapshotStore(otherPool).claim(key, 'contending-api')).state, 'busy');
      } finally { held?.release(); await outcome; await publisherPool.end(); }
      assert.equal(await outcome, null);
      assert.deepEqual(await store.read(key), { count: 1 });
    });

    await t.test('a visibility mutation fences a scoped builder before publication', async () => {
      const key = await identity('view'); await store.claim(key, 'scoped-owner');
      await pool.query('UPDATE explore_revisions SET visibility_revision=visibility_revision+1 WHERE id=1');
      assert.equal(await store.complete(key, 'scoped-owner', 1, { count: 1 }, 11), false);
      assert.equal(await store.read(key), null);
      await store.fail(key, 'scoped-owner', 1);
    });

    await t.test('byte retention preserves the newly published scoped snapshot across restart', async () => {
      await pool.query('TRUNCATE explore_snapshots, explore_rebuild_jobs');
      const bounded = new PostgresSnapshotStore(pool, { maxRetainedBytes: 20 });
      const common = await identity(), view = await identity('view');
      assert.equal((await bounded.claim(common, 'common')).state, 'claimed');
      assert.equal(await bounded.complete(common, 'common', 1, { count: 1 }, 11), true);
      assert.equal((await bounded.claim(view, 'view')).state, 'claimed');
      assert.equal(await bounded.complete(view, 'view', 1, { count: 2 }, 11), true);
      assert.deepEqual(await new PostgresSnapshotStore(otherPool).read(view), { count: 2 });
      const retained = await pool.query('SELECT sum(payload_bytes)::int AS bytes,count(*)::int AS n FROM explore_snapshots');
      assert.deepEqual(retained.rows, [{ bytes: 11, n: 1 }]);
      assert.equal(await bounded.read(common), null, 'older common data must yield to the snapshot being activated');
    });

    await t.test('global admission and failed-attempt limits remain bounded', async () => {
      const a = await identity(), b = await identity(), c = await identity();
      assert.equal((await store.claim(a, 'slot-a')).state, 'claimed');
      assert.equal((await store.claim(b, 'slot-b')).state, 'claimed');
      assert.equal((await store.claim(c, 'slot-c')).state, 'busy');
      await store.fail(a, 'slot-a', 1);
      assert.equal((await store.claim(c, 'slot-c')).state, 'claimed');
      await store.fail(b, 'slot-b', 1); await store.fail(c, 'slot-c', 1);
      for (const fence of [2, 3]) {
        assert.deepEqual(await store.claim(a, `retry-${fence}`), { state: 'claimed', fence });
        await store.fail(a, `retry-${fence}`, fence);
      }
      assert.deepEqual(await store.claim(a, 'fourth-attempt'), { state: 'failed' });
    });

    await t.test('raw SQL publication, translation, quiz and access edits invalidate transactionally', async () => {
      const itemId = `cache-trigger-${randomUUID()}`, familyId = `cache-family-${randomUUID()}`;
      try {
        await pool.query("INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,'Cache test','no-login')", [familyId, `${familyId}@example.test`]);
        await pool.query("INSERT INTO items(id,category,latitude,longitude,is_published) VALUES($1,'animal',1,1,true)", [itemId]);
        const first = await revisions();
        await pool.query("INSERT INTO item_translations(id,item_id,lang,title) VALUES($1,$2,'en','Title')", [itemId, itemId]);
        assert.ok(BigInt((await revisions()).catalog_revision) > BigInt(first.catalog_revision));
        const translated = await revisions();
        await pool.query("INSERT INTO quiz_questions(id,item_id,lang,question,question_type,options,correct_answers) VALUES($1,$2,'en','Question','single','[]','[]')", [itemId, itemId]);
        assert.ok(BigInt((await revisions()).catalog_revision) > BigInt(translated.catalog_revision));
        const published = await revisions();
        await pool.query('UPDATE items SET is_published=false WHERE id=$1', [itemId]);
        assert.ok(BigInt((await revisions()).catalog_revision) > BigInt(published.catalog_revision));
        const beforeShare = await revisions();
        await pool.query('INSERT INTO lesson_audiences(id,item_id,target_family_id,granted_by_family_id) VALUES($1,$2,$3,$3)', [itemId, itemId, familyId]);
        const shared = await revisions();
        assert.equal(shared.catalog_revision, beforeShare.catalog_revision);
        assert.ok(BigInt(shared.visibility_revision) > BigInt(beforeShare.visibility_revision));
        await pool.query('INSERT INTO family_disabled_lessons(family_id,item_id) VALUES($1,$2)', [familyId, itemId]);
        assert.ok(BigInt((await revisions()).visibility_revision) > BigInt(shared.visibility_revision));
        // Rollback must roll back both the content edit and its revision bump.
        const client = await pool.connect();
        const beforeRollback = await revisions();
        try { await client.query('BEGIN'); await client.query('UPDATE items SET latitude=2 WHERE id=$1', [itemId]); await client.query('ROLLBACK'); }
        finally { client.release(); }
        assert.deepEqual(await revisions(), beforeRollback);
        const beforePrivate = await revisions();
        await pool.query("INSERT INTO items(id,category,latitude,longitude,source_type,owner_family_id) VALUES($1,'animal',1,1,'family',$2)", [`${itemId}-private`, familyId]);
        const afterPrivate = await revisions();
        assert.equal(afterPrivate.catalog_revision, beforePrivate.catalog_revision, 'private edits do not force common rebuilds');
        assert.ok(BigInt(afterPrivate.visibility_revision) > BigInt(beforePrivate.visibility_revision));
      } finally {
        await pool.query('DELETE FROM items WHERE id=$1 OR id=$2', [itemId, `${itemId}-private`]);
        await pool.query('DELETE FROM families WHERE id=$1', [familyId]);
      }
    });
  } finally { await Promise.all([pool.end(), otherPool.end()]); }
});
