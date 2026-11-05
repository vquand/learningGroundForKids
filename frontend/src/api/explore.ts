import { indexedViewStorage, backgroundWrites } from '../lib/indexedViewStorage.ts';
import { coreRequest } from './core.ts';
import { CATEGORIES, type ItemSummary } from '../types/item.ts';
import type { ExploreBounds, ExploreFilters, ExploreLeaves, ExploreView, ExploreViewRequest } from '../types/explore.ts';

export interface ExploreViewStorage { get(key: string): Promise<unknown>; put(key: string, value: ExploreView): Promise<void> }
function invalid(): never { throw new Error('Invalid prepared map response'); }
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : invalid();
function num(v: unknown, min: number, max: number, integer = false): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) invalid();
  return v;
}
function str(v: unknown, max: number): string {
  if (typeof v !== 'string' || v.length > max) invalid();
  return v;
}
function version(v: unknown): string {
  const s = str(v, 64);
  return /^[a-f0-9]{64}$/.test(s) ? s : invalid();
}
function bounds(v: unknown): ExploreBounds {
  if (!Array.isArray(v) || v.length !== 4) invalid();
  const b: ExploreBounds = [num(v[0], -540, 540), num(v[1], -90, 90), num(v[2], -540, 540), num(v[3], -90, 90)];
  if (b[0] > b[2] || b[1] > b[3]) invalid();
  return b;
}
function item(value: unknown): ItemSummary {
  const r = record(value);
  const category = str(r.category, 32);
  if (!(CATEGORIES as readonly string[]).includes(category) || typeof r.quiz_required !== 'boolean' || typeof r.has_quiz !== 'boolean') invalid();
  return { id: str(r.id, 256), title: str(r.title, 1024), category: category as ItemSummary['category'],
    latitude: num(r.latitude, -90, 90), longitude: num(r.longitude, -180, 180), icon_slug: str(r.icon_slug, 256),
    quiz_required: r.quiz_required, has_quiz: r.has_quiz,
    ...(r.country_code == null ? {} : { country_code: str(r.country_code, 8) }),
    ...(r.start_year == null ? {} : { start_year: num(r.start_year, -2147483648, 2147483647, true) }),
    ...(r.end_year == null ? {} : { end_year: num(r.end_year, -2147483648, 2147483647, true) }) };
}
const nextOffset = (value: unknown) => value === null ? null : num(value, 1, 5000, true);
export function parseExploreView(value: unknown): ExploreView {
  const r = record(value);
  if (typeof r.shared !== 'boolean' || !Array.isArray(r.features) || r.features.length > 500 || !Array.isArray(r.timeline) || r.timeline.length > 5000) invalid();
  const features = r.features.map(value => {
    const f = record(value);
    const count = num(f.count, 1, 5000, true);
    const member = f.item === null ? null : item(f.item);
    if ((count === 1) !== (member !== null)) invalid();
    return { id: num(f.id, 0, 9999, true), count, latitude: num(f.latitude, -90, 90), longitude: num(f.longitude, -180, 180),
      bounds: bounds(f.bounds), expansionZoom: num(f.expansionZoom, 3, 19, true), item: member };
  });
  const total = num(r.total, 0, 5000, true);
  if (new Set(features.map(f => f.id)).size !== features.length || features.reduce((n, f) => n + f.count, 0) > total) invalid();
  const timeline = r.timeline.map(value => {
    const t = record(value);
    return { year: num(t.year, -2147483648, 2147483647, true), count: num(t.count, 1, 5000, true) };
  });
  if (timeline.reduce((n, t) => n + t.count, 0) > 5000) invalid();
  return { version: version(r.version), validator: version(r.validator), shared: r.shared, total, zoom: num(r.zoom, 2, 18, true), features, next_offset: nextOffset(r.next_offset), timeline,
    ...(r.feature_count === undefined ? {} : { feature_count: num(r.feature_count, features.length, 5000, true) }) };
}
export function exploreViewKey(input: ExploreViewRequest): string {
  return JSON.stringify(['map-view-v1', [...new Set(input.categories)].sort(), input.year, Math.floor(input.zoom), input.bounds, input.offset ?? 0, input.limit ?? 200, input.progress ?? 'all']);
}
function query(input: ExploreFilters, profileId?: string | null) {
  const params = new URLSearchParams();
  params.set('progress', input.progress ?? 'all');
  if (profileId) params.set('profile_id', profileId);
  if (input.categories.length) params.set('categories', [...new Set(input.categories)].sort().join(','));
  if (input.year !== null) params.set('year', String(input.year));
  return params;
}

/** Only shared catalog data lives here, never session/child identity or progress. */
const commonStorage: ExploreViewStorage = indexedViewStorage('plg-explore-common-v1');
const persist = backgroundWrites();

export async function fetchExploreView(input: ExploreViewRequest, profileId?: string | null, signal?: AbortSignal,
  storage: ExploreViewStorage = commonStorage): Promise<ExploreView> {
  const key = exploreViewKey(input);
  const sharedRequest = (input.progress ?? 'all') === 'all';
  let cached: ExploreView | undefined;
  try {
    const value = sharedRequest ? await storage.get(key) : undefined;
    if (value !== undefined) {
      const parsed = parseExploreView(value);
      if (parsed.shared) cached = parsed;
    }
  } catch { /* Unavailable or malformed cache is a miss. */ }
  signal?.throwIfAborted();
  const params = query(input, profileId);
  params.set('zoom', String(Math.floor(input.zoom)));
  params.set('bounds', input.bounds.join(','));
  params.set('offset', String(input.offset ?? 0));
  params.set('limit', String(input.limit ?? 200));
  if (cached) params.set('known_version', cached.validator);
  const result = await coreRequest<unknown>(`/api/v1/items/map/views?${params}`, { signal });
  const value = record(result);
  if (value.not_modified === true) {
    if (!cached || version(value.version) !== cached.version || version(value.validator) !== cached.validator) invalid();
    signal?.throwIfAborted();
    return cached;
  }
  const view = parseExploreView(value);
  signal?.throwIfAborted();
  if (sharedRequest && view.shared) persist(() => storage.put(key, view));
  return view;
}

export async function fetchExploreLeaves(input: ExploreFilters & { version: string; node: number; offset: number; limit?: number }, profileId?: string | null, signal?: AbortSignal): Promise<ExploreLeaves> {
  const params = query(input, profileId);
  params.set('version', input.version);
  params.set('offset', String(input.offset));
  params.set('limit', String(input.limit ?? 200));
  const result = record(await coreRequest<unknown>(`/api/v1/items/map/clusters/${input.node}/leaves?${params}`, { signal }));
  if (result.version !== input.version) invalid();
  if (!Array.isArray(result.items) || result.items.length > 500) invalid();
  return { version: version(result.version), total: num(result.total, 1, 5000, true), items: result.items.map(item), next_offset: nextOffset(result.next_offset) };
}
