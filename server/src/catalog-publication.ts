import { catalogItemId, type CatalogItem } from './db/catalog-seed.js';

interface PublicationPool {
  query(text: string, values: unknown[]): Promise<{ rows: Array<{ id: string }> }>;
}

/** Apply only reviewed unpublishing; preserve content, identity and all progress. */
export async function disableUnpublishedCatalogItems(pool: PublicationPool, items: CatalogItem[]) {
  const ids = [...new Set(items.filter(item => item.is_published === false).map(catalogItemId))];
  if (!ids.length) return { reviewed: 0, disabled: 0 };
  const result = await pool.query(
    `UPDATE items SET is_published = false, updated_at = now()
     WHERE id = ANY($1::text[]) AND source_type = 'system' AND is_published = true
     RETURNING id`,
    [ids],
  );
  return { reviewed: ids.length, disabled: result.rows.length };
}
