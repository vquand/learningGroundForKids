import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readCatalogFixtures } from '../src/catalog-refresh.ts';
import { renderReviewedCatalogSql } from '../src/db/reviewed-catalog-sql.ts';

// Authoring only: no database connection or provider call.
const root = fileURLToPath(new URL('../../', import.meta.url));
const batch = 'exploring-30-2026-10-23';
const { items } = await readCatalogFixtures(root);
const reviewed = items.filter(item => item.content_review?.batch === batch);
if (reviewed.length !== 30) throw new Error('Expected exactly the approved 30 Exploring items.');
const output = new URL('../../docs/migrations/neon-2026-10-23-exploring-content.sql', import.meta.url);
await writeFile(output, renderReviewedCatalogSql(reviewed, batch));
console.log('Wrote the reviewed Exploring SQL migration; no database was contacted.');
