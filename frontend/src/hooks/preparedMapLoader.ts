import { ApiError } from '../api/core.ts';
import { useFamilyStore } from '../stores/familyStore.ts';
import { useFilterStore } from '../stores/filterStore.ts';
import { exploreViewKey, fetchExploreView } from '../api/explore.ts';
import type { ExploreView, ExploreViewRequest } from '../types/explore.ts';

export function preparedIdentity(request: ExploreViewRequest, session: string, profile: string | null, language: string) {
  return JSON.stringify([session, profile, language, [...new Set(request.categories)].sort(), request.year, request.progress ?? 'all']);
}

/** Scoped to one mounted map: private results never survive an identity change. */
export class PreparedViewCache {
  private identity = '';
  private revision: string | null = null;
  private views = new Map<string, ExploreView>();
  private previous: ExploreView | null = null;
  clear() {
    this.views.clear();
    this.previous = null;
  }
  read(identity: string, key: string, revision: string | null = '') {
    if (identity !== this.identity) {
      this.identity = identity;
      this.views.clear();
      this.previous = null;
    }
    if (revision !== this.revision) {
      this.revision = revision;
      this.views.clear();
      // Completion updates keep the last markers only as a loading placeholder.
    }
    const hit = revision === null ? undefined : this.views.get(key);
    if (hit) {
      this.views.delete(key);
      this.views.set(key, hit);
      this.previous = hit;
    }
    return { view: hit ?? this.previous, hit: Boolean(hit) };
  }
  put(identity: string, key: string, view: ExploreView, revision: string | null = '') {
    if (identity !== this.identity || revision !== this.revision) return;
    // A newer catalog invalidates all older camera views.
    if (this.previous && this.previous.version !== view.version) this.views.clear();
    this.views.delete(key);
    this.views.set(key, view);
    while (this.views.size > 6) this.views.delete(this.views.keys().next().value!);
    this.previous = view;
  }
}

type FetchView = typeof fetchExploreView;
export async function loadPreparedView(request: ExploreViewRequest, profile: string | null, signal: AbortSignal, fetchPage: FetchView = fetchExploreView): Promise<ExploreView> {
  for (let attempt = 0; attempt < 2; attempt++) {
    signal.throwIfAborted();
    const first = await fetchPage(request, profile, signal);
    const features = [...first.features];
    let offset = first.next_offset;
    let previous = request.offset ?? 0;
    let changed = false;
    if (first.feature_count !== undefined && offset !== null) {
      const limit = request.limit ?? 200;
      if (offset !== previous + limit || first.features.length !== limit) throw new Error('Invalid prepared map pagination');
      const offsets: number[] = [];
      for (let start = offset; start < first.feature_count; start += limit) offsets.push(start);
      // Only an explicit feature total authorizes parallel page requests. The
      // item total includes cluster members and cannot describe page offsets.
      for (let start = 0; start < offsets.length; start += 3) {
        signal.throwIfAborted();
        const pages = await Promise.all(offsets.slice(start, start + 3).map(offset => fetchPage({ ...request, offset }, profile, signal)));
        if (pages.some(page => page.version !== first.version)) { changed = true; break; }
        for (const [index, page] of pages.entries()) {
          const offset = offsets[start + index]!;
          const expected = Math.min(limit, first.feature_count - offset);
          const next = offset + limit < first.feature_count ? offset + limit : null;
          if (page.feature_count !== first.feature_count || page.features.length !== expected || page.next_offset !== next) throw new Error('Invalid prepared map pagination');
          features.push(...page.features);
        }
      }
    } else {
      while (offset !== null) {
        signal.throwIfAborted();
        if (offset <= previous || features.length >= 5000) throw new Error('Invalid prepared map pagination');
        previous = offset;
        const next = await fetchPage({ ...request, offset }, profile, signal);
        if (next.version !== first.version) {
          changed = true;
          break;
        }
        features.push(...next.features);
        offset = next.next_offset;
      }
    }
    if (!changed) {
      signal.throwIfAborted();
      if ((first.feature_count !== undefined && features.length !== Math.max(0, first.feature_count - (request.offset ?? 0))) ||
        features.reduce((count, feature) => count + feature.count, 0) > first.total ||
        new Set(features.map(feature => feature.id)).size !== features.length) throw new Error('Invalid prepared map pagination');
      return { ...first, features, next_offset: null };
    }
  }
  throw new Error('Prepared map changed while loading');
}

export { exploreViewKey };

export function handlePreparedMapError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) useFamilyStore.getState().clearSession();
  if (error instanceof ApiError && error.code === 'INVALID_MAP_YEAR') useFilterStore.getState().clearEra();
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

