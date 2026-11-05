import type { ItemSummaryRecord } from '../contracts/db.js';
import { AppError } from '../errors.js';
import { SnapshotCache, snapshotIdentity, type SnapshotStore } from './snapshots.js';

export interface CatalogScope { familyId: string; profileId?: string; category?: string }
export interface CatalogAccess { catalogRevision: string; visibilityRevision: string; hasExceptions: boolean }
export interface CatalogSource {
  context(scope: CatalogScope): Promise<CatalogAccess>;
  common(category: string | undefined, signal: AbortSignal): Promise<ItemSummaryRecord[]>;
  visibleIds(scope: CatalogScope, signal: AbortSignal): Promise<string[]>;
  hydrate(scope: CatalogScope, ids: string[], signal: AbortSignal): Promise<ItemSummaryRecord[]>;
}
interface CatalogSnapshot { format: 1; items: ItemSummaryRecord[] }

export function parseCatalogSnapshot(value: unknown): CatalogSnapshot {
  if (!value || typeof value !== 'object' || !('format' in value) || value.format !== 1 || !('items' in value) || !Array.isArray(value.items) || value.items.length > 5000) {
    throw new Error('Invalid catalog snapshot');
  }
  for (const item of value.items) {
    if (!item || typeof item.id !== 'string' || typeof item.category !== 'string' ||
      !Number.isFinite(item.latitude) || !Number.isFinite(item.longitude) || typeof item.title !== 'string' ||
      typeof item.icon_slug !== 'string' || typeof item.has_quiz !== 'boolean' || typeof item.quiz_required !== 'boolean') {
      throw new Error('Invalid catalog snapshot item');
    }
    if (item.id.length > 256 || item.title.length > 1024 || item.icon_slug.length > 256 ||
      (item.country_code !== undefined && (typeof item.country_code !== 'string' || item.country_code.length > 8))) {
      throw new AppError(503, 'EXPLORE_CACHE_TOO_LARGE', 'Catalog metadata exceeds the map limits.');
    }
  }
  return value as CatalogSnapshot;
}

/** Auth stays at the HTTP boundary; publication/visibility stay in the source. */
export class CachedCatalog {
  readonly cache: SnapshotCache;
  constructor(store: SnapshotStore, private readonly source: CatalogSource) { this.cache = new SnapshotCache(store); }

  async list(input: CatalogScope & { limit: number }): Promise<ItemSummaryRecord[]> {
    return (await this.read(input)).items.slice(0, input.limit);
  }

  private async read(input: CatalogScope, initialAccess?: CatalogAccess): Promise<{ items: ItemSummaryRecord[]; access: CatalogAccess }> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const access = initialAccess ?? await this.source.context(input);
      try {
        const variant = `catalog-v1:${input.category ?? 'all'}`;
        const commonKey = snapshotIdentity({ kind: 'common', catalogRevision: access.catalogRevision, scope: 'common', variant });
        const common = await this.cache.get(commonKey, async signal => {
          signal.throwIfAborted();
          const items = await this.source.common(input.category, signal);
          signal.throwIfAborted(); return { format: 1 as const, items };
        }, parseCatalogSnapshot);
        let result = common.items;
        if (access.hasExceptions) {
          // Load the common snapshot BEFORE claiming a scoped build: a nested
          // cache build could otherwise exhaust the global build slots.
          const key = snapshotIdentity({ kind: 'view', catalogRevision: access.catalogRevision,
            visibilityRevision: access.visibilityRevision, scope: JSON.stringify([input.familyId, input.profileId ?? null]), variant });
          const scoped = await this.cache.get(key, async signal => {
            signal.throwIfAborted();
            const ids = await this.source.visibleIds(input, signal);
            signal.throwIfAborted();
            const available = new Map(common.items.map(item => [item.id, item]));
            const missing = ids.filter(id => !available.has(id));
            for (const item of missing.length ? await this.source.hydrate(input, missing, signal) : []) available.set(item.id, item);
            signal.throwIfAborted();
            return { format: 1 as const, items: ids.flatMap(id => available.has(id) ? [available.get(id)!] : []) };
          }, parseCatalogSnapshot);
          result = scoped.items;
        }
        // Permission/publication may change while a cache miss is being built.
        // Projections defer this check until their final asynchronous cache read.
        if (initialAccess) return { items: result, access };
        const latest = await this.source.context(input);
        if (latest.catalogRevision !== access.catalogRevision || latest.visibilityRevision !== access.visibilityRevision || latest.hasExceptions !== access.hasExceptions) continue;
        return { items: result, access };
      } catch (error) {
        if (initialAccess || !(error instanceof AppError) || error.code !== 'EXPLORE_CACHE_STALE') throw error;
      }
    }
    throw new AppError(503, 'EXPLORE_CACHE_STALE', 'The catalog changed while loading. Try again shortly.');
  }

  async project<T>(input: CatalogScope, variant: string | ((items: ItemSummaryRecord[]) => string), build: (items: ItemSummaryRecord[], signal: AbortSignal) => Promise<T>, validate: (value: unknown) => T): Promise<{ version: string; shared: boolean; value: T }> {
    for (let attempt = 0; attempt < 3; attempt++) {
      // Materialize membership before claiming a projection build: no nested
      // build may occupy the globally bounded durable admission slots.
      const access = await this.source.context(input);
      try {
        const { items } = await this.read(input, access);
        const projectionVariant = typeof variant === 'function' ? variant(items) : variant;
        const key = snapshotIdentity({ kind: access.hasExceptions ? 'view' : 'common', catalogRevision: access.catalogRevision,
          visibilityRevision: access.visibilityRevision, scope: access.hasExceptions ? JSON.stringify([input.familyId, input.profileId ?? null]) : 'common', variant: projectionVariant });
        const value = await this.cache.get(key, signal => build(items, signal), validate);
        const latest = await this.source.context(input);
        if (latest.catalogRevision !== access.catalogRevision || latest.visibilityRevision !== access.visibilityRevision || latest.hasExceptions !== access.hasExceptions) continue;
        return { version: key.id, shared: !access.hasExceptions, value };
      } catch (error) {
        if (error instanceof AppError && error.code === 'EXPLORE_CACHE_STALE') continue;
        const latest = await this.source.context(input);
        if (latest.catalogRevision !== access.catalogRevision || latest.visibilityRevision !== access.visibilityRevision || latest.hasExceptions !== access.hasExceptions) continue;
        throw error;
      }
    }
    throw new AppError(503, 'EXPLORE_CACHE_STALE', 'The catalog changed while loading. Try again shortly.');
  }
}
