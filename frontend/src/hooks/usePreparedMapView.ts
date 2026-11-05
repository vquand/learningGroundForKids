import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { familyScopedQuery } from '../lib/familyQueries';
import { useFamilyStore } from '../stores/familyStore';
import { useUiLanguage } from './useUiLanguage';
import { exploreViewKey, loadPreparedView, preparedIdentity } from './preparedMapLoader';
import { PreparedMapLifecycle } from './preparedMapLifecycle';
import type { ExploreTimelineYear, ExploreViewRequest } from '../types/explore';

export function usePreparedMapView(request: ExploreViewRequest, profileId: string | null, onTimeline?: (years: ExploreTimelineYear[], version?: string) => void, progressRevision: string | null = '') {
  const family = useFamilyStore(s => s.familyId);
  const generation = useFamilyStore(s => s.sessionGeneration);
  const language = useUiLanguage();
  const key = useMemo(() => exploreViewKey(request), [request.categories, request.year, request.progress, request.zoom, request.bounds, request.offset, request.limit]);
  const identity = useMemo(() => preparedIdentity(request, `${family}:${generation}`, profileId, language),
    [family, generation, profileId, language, request.categories, request.year, request.progress]);
  const revision = (request.progress ?? 'all') === 'all' ? '' : progressRevision;
  const [retry, setRetry] = useState(0);
  const [, render] = useState(0);
  const reload = useCallback(() => setRetry(n => n + 1), []);
  const lifecycle = useRef(new PreparedMapLifecycle());
  useEffect(() => {
    const load = lifecycle.current.load(identity, key, family ? revision : null,
      signal => familyScopedQuery(family, () => loadPreparedView(request, profileId, signal))(),
      () => render(n => n + 1), onTimeline);
    return load.cancel;
    // The normalized key and identity cover the full request and authorization scope.
  }, [key, identity, revision, family, profileId, retry, onTimeline]);
  return { ...lifecycle.current.read(identity, key, family ? revision : null), reload };
}
