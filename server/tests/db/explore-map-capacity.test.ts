import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from '../../src/db/index.js';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';

test('5001st common or family-visible item rejects the catalog instead of publishing incomplete membership', { skip: process.env.TEST_DATABASE_URL ? false : 'TEST_DATABASE_URL is not configured' }, async () => {
  const url = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((x): x is string => Boolean(x)));
  const pool = new Pool({ connectionString: url, max: 2 }), db = createDatabase(url);
  const prefix = `cache-capacity-${randomUUID()}`;
  const tooLarge = (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'EXPLORE_CACHE_TOO_LARGE');
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    await pool.query("INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,'Capacity fixture','test-only')", [prefix, `${prefix}@example.test`]);
    for (const owner of [null, prefix]) {
      await pool.query(`INSERT INTO items(id,category,latitude,longitude,source_type,owner_family_id,is_published)
        SELECT $1 || '-' || g,'phenomenon',0,0,$2,$3,true FROM generate_series(1,5001) g`, [prefix, owner ? 'family' : 'system', owner]);
      await assert.rejects(db.items.list({ familyId: prefix, category: 'phenomenon', limit: 5000 }), tooLarge);
      assert.ok(db.explore);
      await assert.rejects(db.explore.view({ familyId: prefix, categories: [], year: null, zoom: 2, bounds: [-180, -90, 180, 90], offset: 0, limit: 200 }), tooLarge);
      await pool.query('DELETE FROM items WHERE id LIKE $1', [`${prefix}-%`]);
    }
  } finally {
    await pool.query('DELETE FROM items WHERE id LIKE $1', [`${prefix}-%`]);
    await pool.query('DELETE FROM families WHERE id=$1', [prefix]);
    await db.close!(); await pool.end();
  }
});
