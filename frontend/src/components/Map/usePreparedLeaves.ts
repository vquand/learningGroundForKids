import { useCallback, useEffect, useRef, useState } from 'react';
import { handlePreparedMapError } from '../../hooks/preparedMapLoader';
import { fetchExploreLeaves } from '../../api/explore';
import { familyScopedQuery } from '../../lib/familyQueries';
import type { ExploreFeature, ExploreView, ExploreFilters } from '../../types/explore';
import type { ItemSummary } from '../../types/item';

export interface Spider { context: string; node: ExploreFeature; items: ItemSummary[]; offset: number; total: number; next: number | null }
export const SPIDER_PAGE = 12;

export function usePreparedLeaves(view: ExploreView | null, family: string | null, profile: string | null, filters: ExploreFilters, reload: () => void) {
  const context = JSON.stringify([profile, filters.categories, filters.year, filters.progress, view?.version]);
  const [spider, setSpider] = useState<Spider | null>(null);
  const leafAbort = useRef<AbortController | null>(null);
  const [leafBusy, setLeafBusy] = useState(false);
  const [leafError, setLeafError] = useState(false);
  const collapse = useCallback(() => {
    leafAbort.current?.abort();
    setSpider(null);
    setLeafBusy(false);
    setLeafError(false);
  }, []);
  useEffect(() => {
    collapse();
    return () => leafAbort.current?.abort();
  }, [view, filters.categories, filters.year, filters.progress, profile, collapse]);
  const leaves = useCallback((node: ExploreFeature, offset: number) => {
    if (!view) return;
    leafAbort.current?.abort();
    const controller = new AbortController();
    leafAbort.current = controller;
    setSpider(null);
    setLeafBusy(true);
    setLeafError(false);
    const load = familyScopedQuery(family, () => fetchExploreLeaves({ ...filters, version: view.version, node: node.id, offset, limit: SPIDER_PAGE }, profile, controller.signal));
    void load().then(page => {
      if (controller.signal.aborted) return;
      setSpider({ context, node, items: page.items, total: page.total, offset, next: page.next_offset });
      setLeafBusy(false);
    }).catch(error => {
      if (controller.signal.aborted) return;
      handlePreparedMapError(error);
      setLeafBusy(false);
      setLeafError(true);
      reload();
    });
  }, [view, context, family, filters.categories, filters.year, filters.progress, profile, reload]);
  return { spider: spider?.context === context ? spider : null, leafBusy, leafError, setLeafError, collapse, leaves };
}
