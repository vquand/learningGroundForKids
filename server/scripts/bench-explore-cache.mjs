// Run only against a disposable local test database. --prepare creates schema
// and replaces fixtures; it never reads .env files or defaults to a runtime URL.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import os from 'node:os';
import { Client, Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../src/db/test-database.ts';
import { exploreFixtures } from '../../frontend/tests/browser/explore-performance-fixtures.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const out = option('--out', '/tmp/plg-explore-cache-baseline');
const baselineModule = option('--baseline-module', null);
const repositoryModule = baselineModule ? pathToFileURL(resolve(baselineModule)) : new URL('../src/db/index.ts', import.meta.url);
const { createDatabase } = await import(repositoryModule.href);
const url = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter(Boolean));
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname), 'benchmark requires a local database');
assert.match(new URL(url).pathname.slice(1), /^explore_cache_test(?:_[a-z0-9]+)?$/, 'benchmark requires its dedicated disposable database name');
const pool = new Pool({ connectionString: url, max: 1 });
const categories = new Set(['animal', 'food', 'monument', 'landmark', 'music', 'movie', 'phenomenon']);
let metrics;
// Observe the client, including callback mode used internally by Pool.query.
// This also sees transaction-bound queries, without counting Pool + Client twice.
const query = Client.prototype.query;
Client.prototype.query = function (...values) {
  const current = metrics;
  const started = performance.now();
  const sql = typeof values[0] === 'string' ? values[0] : values[0]?.text ?? '';
  if (current) current.queries++;
  const observe = value => {
    const elapsed = performance.now() - started;
    current.queryRoundTripMs += elapsed;
    // Count actual full catalog materialization by returned row shape, not
    // cache flags. Revision/permission lookups remain separate, smaller reads.
    const first = value?.rows?.[0];
    const source = first && ((first.category !== undefined && first.latitude !== undefined) ||
      (Array.isArray(first) && categories.has(first[1]) && typeof first[2] === 'number'));
    if (source) {
      current.sourceReads++; current.sourceRows += value.rows.length;
    }
    const kind = source ? 'catalog' : /from "item_translations"/i.test(sql) ? 'translations' :
      /hasExceptions/.test(sql) ? 'access' : /^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql) ? 'transactionControl' : 'cacheCoordination';
    const group = current.groups[kind] ??= { queries: 0, rows: 0, logicalReadBytes: 0, roundTripMs: 0 };
    group.queries++; group.roundTripMs += elapsed;
    for (const result of Array.isArray(value) ? value : [value]) {
      if (result?.rows) { group.rows += result.rows.length; group.logicalReadBytes += Buffer.byteLength(JSON.stringify(result.rows)); }
    }
    return value;
  };
  const callback = values.at(-1);
  if (current && typeof callback === 'function') values[values.length - 1] = function (error, value) { if (!error) observe(value); return callback(error, value); };
  const result = Reflect.apply(query, this, values);
  return current && result?.then ? result.then(observe) : result;
};
const sourceHashes = {};
for (const path of ['../src/db/index.ts', '../src/explore/catalog.ts', '../src/explore/snapshots.ts', '../src/explore/postgres-snapshots.ts', '../src/explore/postgres-query.ts', './bench-explore-cache.mjs']) {
  sourceHashes[path] = createHash('sha256').update(await readFile(new URL(path, import.meta.url))).digest('hex');
}
sourceHashes.repositoryModule = createHash('sha256').update(await readFile(repositoryModule)).digest('hex');
const results = { metadata: { protocol: 3, baselineModule: Boolean(baselineModule), recordedAt: new Date().toISOString(), node: process.version, sourceHashes,
  cpu: os.cpus()[0].model, platform: `${os.platform()} ${os.release()}`, readers: 10, repetitions: 5,
  note: 'Disposable PostgreSQL, repository calls, no HTTP/auth/browser; timing excludes setup/migration. Client.query metrics include transaction control. queryRoundTripMs sums overlapping client query durations (SQL/transfer/driver), not pure server CPU or wall time. Bytes are JSON result bytes, not wire bytes. Baseline module is an isolated tracked-source export.' }, samples: [] };
try {
  if (args.includes('--prepare')) {
    const existing = await pool.query("SELECT to_regclass('public.families') AS name");
    if (existing.rows[0].name) {
      assert.equal((await pool.query("SELECT 1 FROM families WHERE id NOT LIKE 'cache-family-%' LIMIT 1")).rowCount, 0,
        'refusing to replace catalog fixtures in a database containing non-benchmark accounts');
    }
    await migrate(drizzle({ client: pool }), { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
    for (let i = 0; i < 10; i++) await pool.query(`INSERT INTO families (id,email,display_name,password_hash)
      VALUES ($1,$2,'Cache benchmark','test-only-no-login') ON CONFLICT (id) DO NOTHING`, [`cache-family-${i}`, `cache-${i}@example.test`]);
  }
  const fixtures = await exploreFixtures();
  for (const [fixture, items] of Object.entries(fixtures)) {
    if (option('--dataset', null) && option('--dataset', null) !== fixture) continue;
    assert.ok(args.includes('--prepare'), '--prepare is required: this script replaces its disposable fixtures');
    await pool.query('TRUNCATE items CASCADE');
    await pool.query(`INSERT INTO items (id,category,latitude,longitude,icon_slug,start_year,end_year,quiz_required,is_published)
      SELECT id,category,latitude,longitude,icon_slug,start_year,end_year,coalesce(quiz_required,false),true
      FROM jsonb_to_recordset($1::jsonb) AS x(id text,category text,latitude float8,longitude float8,
        icon_slug text,start_year int,end_year int,quiz_required boolean)`, [JSON.stringify(items)]);
    await pool.query(`INSERT INTO item_translations (id,item_id,lang,title)
      SELECT 'cache-title-' || id,id,'en',title FROM jsonb_to_recordset($1::jsonb) AS x(id text,title text)`, [JSON.stringify(items)]);
    for (let run = 0; run < 5; run++) {
      const cached = await pool.query("SELECT to_regclass('explore_snapshots') AS table_name");
      if (cached.rows[0].table_name) await pool.query('TRUNCATE explore_snapshots, explore_rebuild_jobs');
      let db = createDatabase(url);
      try {
        for (const phase of ['build', 'hot', 'restart']) {
          if (phase === 'restart') { await db.close(); db = createDatabase(url); }
          metrics = { queries: 0, sourceReads: 0, sourceRows: 0, queryRoundTripMs: 0, groups: {} };
          const started = performance.now();
          const elapsed = await Promise.all(Array.from({ length: 10 }, async (_, reader) => {
            const start = performance.now();
            const value = await db.items.list({ familyId: `cache-family-${reader}`, limit: 5000 });
            assert.equal(value.length, items.length);
            return performance.now() - start;
          }));
          const sample = { fixture, count: items.length, run, phase, wallMs: performance.now() - started, ...metrics, readerMs: elapsed };
          const expectedSourceReads = baselineModule ? 10 : phase === 'build' ? 1 : 0;
          assert.equal(sample.sourceReads, expectedSourceReads, 'source materialization count must match uncached/cached phase');
          assert.equal(sample.sourceRows, expectedSourceReads * items.length);
          metrics = null; results.samples.push(sample);
          console.log(JSON.stringify(sample));
        }
      } finally { metrics = null; await db.close(); }
    }
  }
  await mkdir(out, { recursive: true });
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
} finally { Client.prototype.query = query; await pool.end(); }
