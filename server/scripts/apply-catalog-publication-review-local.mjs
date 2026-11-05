// Deliberately local-only: no cloud/production URL is accepted by either guard.
if (process.argv.length !== 2) throw new Error('Usage: apply-catalog-publication-review-local.mjs');
if (process.env.SERVER_HOST === '0.0.0.0') await import('/app/docker/dev/local-db-guard.mjs');
else await import('./local-db-guard.mjs');

const { Pool } = await import('pg');
const { readCatalogFixtures } = await import('../src/catalog-refresh.ts');
const { disableUnpublishedCatalogItems } = await import('../src/catalog-publication.ts');
const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED, max: 1, connectionTimeoutMillis: 10000 });
try {
  const result = await disableUnpublishedCatalogItems(pool, (await readCatalogFixtures()).items);
  console.log(`Reviewed ${result.reviewed} unpublished catalog entries; disabled ${result.disabled} local system items. Content, custom items and player progress were retained.`);
} finally { await pool.end(); }
