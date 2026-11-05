// Isolated process for the disposable-PostgreSQL integration test. No HTTP
// auth is mocked here: HTTP authorization is exercised by explore-catalog.
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { createDatabase } from '../../src/db/index.js';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';

const url = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((v): v is string => Boolean(v)));
const db = createDatabase(url);
let sourceReads = 0;
const originalQuery = Client.prototype.query;
const categories = new Set(['animal', 'food', 'monument', 'landmark', 'movie', 'music', 'phenomenon']);
// Observe real returned source rows, including Drizzle's positional row mode.
Client.prototype.query = function (this: Client, ...args: any[]) {
  const observe = (result: any) => {
    const first = result?.rows?.[0];
    if (first && (first.category !== undefined || (Array.isArray(first) && categories.has(first[1]) && typeof first[2] === 'number'))) sourceReads++;
    return result;
  };
  const callback = args.at(-1);
  if (typeof callback === 'function') args[args.length - 1] = (error: Error | null, result: unknown) => callback(error, error ? result : observe(result));
  const result = Reflect.apply(originalQuery, this, args);
  return result?.then ? result.then(observe) : result;
} as typeof Client.prototype.query;

process.once('message', async (families: string[]) => {
  let response: { readers: { ids: string[]; version: string }[]; sourceReads: number } | { error: string };
  try {
    assert.ok(db.explore);
    const readers = await Promise.all(families.map(async familyId => {
      const items = await db.items.list({ familyId, limit: 5000 });
      const view = await db.explore!.view({ familyId, categories: [], year: null, zoom: 2, bounds: [-180, -90, 180, 90], offset: 0, limit: 500 });
      assert.ok(!('not_modified' in view));
      assert.equal(view.total, items.length);
      assert.equal(view.features.reduce((n, f) => n + f.count, 0), items.length);
      return { ids: items.map(item => item.id).sort(), version: view.version };
    }));
    response = { readers, sourceReads };
  } catch (error) {
    response = { error: error instanceof Error ? error.stack ?? error.message : String(error) };
    process.exitCode = 1;
  } finally {
    try { await db.close!(); }
    catch (error) { response = { error: error instanceof Error ? error.message : String(error) }; process.exitCode = 1; }
    Client.prototype.query = originalQuery;
  }
  process.send!(response);
  process.disconnect!();
});
process.send!({ ready: true });
