import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { withExploreTransaction } from '../../src/explore/postgres-query.js';

test('Explore source reads stop on server timeouts and abort before follow-on work', { skip: process.env.TEST_DATABASE_URL ? false : 'TEST_DATABASE_URL is not configured' }, async () => {
  const url = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((x): x is string => Boolean(x)));
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 1000 });
  try {
    const controller = new AbortController();
    let followOn = false;
    const slow = withExploreTransaction(pool, async client => {
      await client.query('SELECT pg_sleep(5)');
      controller.signal.throwIfAborted();
      followOn = true;
    }, { signal: controller.signal, readOnly: true, statementMs: 50, workMs: 500 });
    const stopped = assert.rejects(slow, /cancelled test read/);
    await delay(20); controller.abort(new Error('cancelled test read'));
    await stopped;
    assert.equal(followOn, false);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND state='active' AND query='SELECT pg_sleep(5)' ")).rows[0].n, 0, 'PostgreSQL must have stopped the underlying query');
    assert.equal((await pool.query('SHOW statement_timeout')).rows[0].statement_timeout, '0', 'transaction-local timeout must not leak to other features');

    await assert.rejects(withExploreTransaction(pool, client => client.query('SELECT pg_sleep(5)'),
      { readOnly: true, statementMs: 30, workMs: 500 }), /timed out/);
    await assert.rejects(withExploreTransaction(pool, client => drizzle({ client }).execute(sql`SELECT pg_sleep(5)`),
      { readOnly: true, statementMs: 30, workMs: 500 }), /timed out/, 'wrapped driver timeouts keep the structured API error');
    const held = await pool.connect();
    let started = false;
    const queued = withExploreTransaction(pool, async () => { started = true; }, { signal: controller.signal, readOnly: true });
    await assert.rejects(queued, /cancelled test read/);
    held.release();
    assert.equal(started, false, 'already aborted reads must never queue for a connection');

    const connection = await pool.connect(), waiting = new AbortController();
    const pending = withExploreTransaction(pool, async () => { started = true; }, { signal: waiting.signal });
    const cancelled = assert.rejects(pending, /cancelled while queued/);
    waiting.abort(new Error('cancelled while queued')); connection.release();
    await cancelled;
    assert.equal(started, false, 'a read aborted while queued must skip all SQL after acquisition');
  } finally { await pool.end(); }
});
