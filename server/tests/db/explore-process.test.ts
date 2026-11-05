import assert from 'node:assert/strict';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';

interface Result { sourceReads: number; readers: { ids: string[]; version: string }[]; error?: string }
async function stopWorker(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
  const deadline = setTimeout(() => child.kill('SIGKILL'), 1000);
  child.kill('SIGTERM');
  try { await exited; } finally { clearTimeout(deadline); }
}
function worker(children: ChildProcess[]) {
  const child = fork(fileURLToPath(new URL('../helpers/explore-process-worker.ts', import.meta.url)), [], {
    execArgv: ['--import', 'tsx'], stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  children.push(child);
  let stderr = '';
  child.stderr!.on('data', value => { stderr += value; });
  const exited = once(child, 'exit');
  const ready = new Promise<void>((resolve, reject) => {
    child.once('message', message => (message as { ready?: boolean }).ready ? resolve() : reject(new Error('Worker did not become ready')));
    child.once('error', reject);
    child.once('exit', () => reject(new Error(`Worker exited before ready: ${stderr}`)));
  });
  return { ready, async read(families: string[]): Promise<Result> {
    const result = new Promise<Result>((resolve, reject) => {
      child.once('message', message => resolve(message as Result));
      child.once('error', reject);
      child.once('exit', () => reject(new Error(`Worker exited without a result: ${stderr}`)));
    });
    child.send(families);
    const value = await result;
    const [code] = await exited;
    assert.equal(code, 0, value.error ?? stderr);
    assert.equal(value.error, undefined);
    return value;
  } };
}

test('ten readers in two OS processes share catalog and hierarchy builds; a fresh process reuses both', {
  skip: process.env.TEST_DATABASE_URL ? false : 'TEST_DATABASE_URL is not configured', timeout: 20000,
}, async () => {
  const url = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((v): v is string => Boolean(v)));
  const pool = new Pool({ connectionString: url, max: 1 }), children: ChildProcess[] = [];
  const prefix = `process-cache-${randomUUID()}`, families = Array.from({ length: 10 }, (_, i) => `${prefix}-${i}`);
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    for (const id of families) await pool.query("INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,'Process test','not-a-login-hash')", [id, `${id}@example.test`]);
    await pool.query("INSERT INTO items(id,category,latitude,longitude,is_published) VALUES($1,'animal',0,0,true)", [prefix]);
    await pool.query("INSERT INTO item_translations(id,item_id,lang,title) VALUES($1,$1,'en','Process fixture')", [prefix]);
    const revision = (await pool.query('SELECT catalog_revision FROM explore_revisions WHERE id=1')).rows[0].catalog_revision;
    const a = worker(children), b = worker(children);
    await Promise.all([a.ready, b.ready]);
    const results = await Promise.all([a.read(families.slice(0, 5)), b.read(families.slice(5))]);
    assert.equal(results.reduce((n, r) => n + r.sourceReads, 0), 1, 'only one process reads the common source');
    const readers = results.flatMap(r => r.readers);
    assert.equal(readers.length, 10);
    for (const reader of readers) assert.deepEqual(reader, readers[0]);
    assert.ok(readers[0]!.ids.includes(prefix));
    const jobs = async () => (await pool.query('SELECT j.id,j.state,j.fence FROM explore_rebuild_jobs j JOIN explore_snapshots s ON s.id=j.id WHERE s.catalog_revision=$1 ORDER BY j.id', [revision])).rows;
    const published = await jobs();
    assert.equal(published.length, 2, 'catalog and hierarchy each publish once');
    assert.ok(published.every(job => job.state === 'ready' && job.fence === 1));
    const restarted = worker(children);
    await restarted.ready;
    const reused = await restarted.read(families);
    assert.equal(reused.sourceReads, 0);
    assert.deepEqual(reused.readers, readers);
    assert.deepEqual(await jobs(), published, 'a new process neither rebuilds nor reclaims unchanged snapshots');
  } finally {
    try {
      await Promise.all(children.map(stopWorker));
      try { await pool.query('DELETE FROM items WHERE id=$1', [prefix]); }
      finally { await pool.query('DELETE FROM families WHERE id=ANY($1::text[])', [families]); }
    } finally { await pool.end(); }
  }
});
