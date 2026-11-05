import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { readCatalogFixtures } from '../src/catalog-refresh.js';
import { catalogItemId } from '../src/db/catalog-seed.js';
import { renderReviewedCatalogSql } from '../src/db/reviewed-catalog-sql.js';
const batch = 'exploring-30-2026-10-23';

test('the reviewed SQL migration is reproducible, bounded and independent of schema migration 0028', async () => {
  const fixtures = await readCatalogFixtures(new URL('../../', import.meta.url).pathname);
  const items = fixtures.items.filter(item => item.content_review?.batch === batch);
  assert.equal(items.length, 30);
  const sql = renderReviewedCatalogSql(items, batch);
  assert.equal(sql, await readFile(new URL('../../docs/migrations/neon-2026-10-23-exploring-content.sql', import.meta.url), 'utf8'));
  assert.match(sql, /BEGIN;[\s\S]*COMMIT;/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /Missing or non-system reviewed items/);
  assert.doesNotMatch(sql, /DELETE FROM|DROP TABLE|TRUNCATE|INSERT INTO drizzle/i);
  assert.equal((sql.match(/INSERT INTO flashcards/g) ?? []).length, 120);
  assert.equal((sql.match(/INSERT INTO quiz_questions/g) ?? []).length, 118);
  assert.doesNotMatch(sql, /INSERT INTO item_media/);
  for (const item of items) assert.ok(sql.includes(catalogItemId(item)));
  assert.throws(() => renderReviewedCatalogSql([...items,items[0]!], batch), /duplicate/i);
  assert.throws(() => renderReviewedCatalogSql([fixtures.items.find(item=>!item.flashcards)!], batch), /reviewed/i);
});
