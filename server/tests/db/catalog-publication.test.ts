import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { catalogItemId, type CatalogItem } from '../../src/db/catalog-seed.js';
import { disableUnpublishedCatalogItems } from '../../src/catalog-publication.js';

test('publication review is atomic, idempotent and preserves custom items and progress', { skip: process.env.TEST_DATABASE_URL ? false : 'TEST_DATABASE_URL is not configured' }, async () => {
  const url = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((v): v is string => !!v), process.env.ALLOW_NONLOCAL_TEST_DATABASE);
  const pool = new Pool({ connectionString: url });
  const tag = `publication-${randomUUID()}`;
  const records: CatalogItem[] = [false, true, false].map((published, index) => ({ category: 'animal', latitude: index, longitude: index, is_published: published, translations: [{ lang: 'en', title: `${tag}-${index}` }] }));
  const ids = records.map(catalogItemId);
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    await pool.query('INSERT INTO families (id,email,display_name,password_hash) VALUES ($1,$2,$3,$4)', [tag, `${tag}@example.test`, 'Review test', 'unused']);
    await pool.query('INSERT INTO profiles (id,family_id,name,emoji,color,public_id) VALUES ($1,$1,$2,$3,$4,$1)', [tag, 'Reader', 'star', 'green']);
    for (const [index, id] of ids.entries()) await pool.query('INSERT INTO items (id,category,latitude,longitude,is_published,source_type,location_desc) VALUES ($1,$2,0,0,true,$3,$4)', [id, 'animal', index === 2 ? 'custom' : 'system', 'Original text retained']);
    await pool.query('INSERT INTO profile_progress (id,profile_id,item_id,category) VALUES ($1,$1,$2,$3)', [tag, ids[0], 'animal']);
    const before = (await pool.query('SELECT * FROM profile_progress WHERE id=$1', [tag])).rows;
    assert.deepEqual(await disableUnpublishedCatalogItems(pool, records), { reviewed: 2, disabled: 1 });
    assert.deepEqual(await disableUnpublishedCatalogItems(pool, records), { reviewed: 2, disabled: 0 });
    const stored = (await pool.query('SELECT id,is_published,location_desc FROM items WHERE id=ANY($1::text[])', [ids])).rows;
    assert.equal(stored.find(row => row.id === ids[0]).is_published, false);
    assert.equal(stored.find(row => row.id === ids[1]).is_published, true);
    assert.equal(stored.find(row => row.id === ids[2]).is_published, true, 'custom content is never disabled by catalog review');
    assert.ok(stored.every(row => row.location_desc === 'Original text retained'));
    assert.deepEqual((await pool.query('SELECT * FROM profile_progress WHERE id=$1', [tag])).rows, before);
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [tag]);
    await pool.query('DELETE FROM items WHERE id=ANY($1::text[])', [ids]);
    await pool.end();
  }
});
