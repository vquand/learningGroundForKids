import { createHash } from 'node:crypto';
import { buildCatalogSeed, catalogContentHash, catalogItemId, type CatalogItem } from './catalog-seed.js';

function literal(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`;
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) return `ARRAY[${value.map(literal).join(', ')}]::text[]`;
  throw new Error('Unsupported reviewed SQL value.');
}

/** Reproducible, operator-applied data migration; never changes the schema journal. */
export function renderReviewedCatalogSql(items: CatalogItem[], batch: string): string {
  if (items.length < 1 || items.length > 100) throw new Error('A reviewed SQL batch must contain 1–100 items.');
  const ordered = [...items].sort((a,b) => catalogItemId(a).localeCompare(catalogItemId(b)));
  const ids = ordered.map(catalogItemId);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate reviewed SQL item.');
  if (ordered.some(item => item.content_review?.batch !== batch || !item.content_review.approved_at
    || !item.flashcards?.length || item.is_published !== true)) throw new Error('Only approved, published reviewed items may enter this SQL migration.');
  const blocks = ordered.map(item => {
    const id = catalogItemId(item), hash = catalogContentHash(item);
    const statements = buildCatalogSeed([item], {}).statements
      .filter(value => !value.text.startsWith('INSERT INTO item_media'))
      .map(value => value.text.replace(/\$(\d+)/g, (_match, index: string) => literal(value.values[Number(index)-1])));
    return `  IF EXISTS (SELECT 1 FROM items WHERE id = ${literal(id)} AND (catalog_content_hash IS DISTINCT FROM ${literal(hash)} OR is_published IS DISTINCT FROM TRUE)) THEN\n${statements.map(sql => `    ${sql};`).join('\n')}\n  END IF;`;
  }).join('\n\n');
  const tag = `$reviewed_${createHash('sha256').update(batch).digest('hex').slice(0,16)}$`;
  if (blocks.includes(tag)) throw new Error('Reviewed SQL delimiter appears in content.');
  return `-- Approved Exploring content: ${batch} (${items.length} existing system items).
-- Apply the ENTIRE file with no catalog seeding/refresh running concurrently.
-- Requires the existing catalog and schema through 0025_explore_snapshots.
-- Independent of schema migration 0028; no Drizzle ledger entry is added.
-- Enables only this approved set. Historical questions/cards are retired, never deleted.
-- Repeating an applied batch is a no-op. Any failure rolls back the complete batch.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL standard_conforming_strings = on;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO ${tag}
BEGIN
  IF to_regclass('public.explore_revisions') IS NULL THEN
    RAISE EXCEPTION 'Apply schema migrations through 0025 before this reviewed content migration';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(${literal(batch)}, 0));
  PERFORM id FROM items WHERE id = ANY(${literal(ids)}) ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM items WHERE id = ANY(${literal(ids)}) AND source_type = 'system') <> ${items.length} THEN
    RAISE EXCEPTION 'Missing or non-system reviewed items; no content was changed';
  END IF;

${blocks}
END;
${tag};
COMMIT;
`;
}
