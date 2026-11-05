import { useCallback, useMemo, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { usePreparedLeaves, SPIDER_PAGE } from './usePreparedLeaves';
import { usePreparedCamera, worldLongitude } from './usePreparedCamera';
import { PreparedMarkers } from './PreparedMarkers';
import { useSpiderPositions } from './useSpiderPositions';
import { useMapProgress } from './ProgressFilter';
import { useQuery } from '@tanstack/react-query';
import { fetchProfiles } from '../../api/profiles';
import { profileQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { useFamilyStore } from '../../stores/familyStore';
import { useFilterStore } from '../../stores/filterStore';
import { completionRevision } from '../../hooks/preparedMapLifecycle';
import { usePreparedMapView } from '../../hooks/usePreparedMapView';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { MarkerClickHandler } from './MapInteractions';
import type { ExploreFeature, ExploreTimelineYear } from '../../types/explore';
import type { ItemSummary } from '../../types/item';


export function PreparedMapLayer({ profile, progressReady, done, wip, onSelect, onOpenDetail, onInputModeChange, onTimeline }: {
  profile: string | null; progressReady: boolean; done: Set<string>; wip: Set<string>; onSelect: (item: ItemSummary) => void;
  onOpenDetail: (item: ItemSummary) => void; onInputModeChange: (mode: 'mouse' | 'touch') => void;
  onTimeline?: (years: ExploreTimelineYear[], version?: string) => void;
}) {
  useUiLanguage();
  const map = useMap();
  const family = useFamilyStore(s => s.familyId);
  const categories = useFilterStore(s => s.activeCategories);
  const year = useFilterStore(s => s.activeYear);
  const { progress } = useMapProgress();
  const { data: profiles = [] } = useQuery({
    queryKey: profileQueryKey(family), queryFn: familyScopedQuery(family, fetchProfiles), enabled: Boolean(family), retry: false,
  });
  const totalDone = profiles.find(candidate => candidate.id === profile)?.total_done;
  const revision = useMemo(() => completionRevision(progress, totalDone, done, progressReady), [progress, totalDone, done, progressReady]);
  const collapseRef = useRef<() => void>(() => undefined);
  const collapse = useCallback(() => collapseRef.current(), []);
  const camera = usePreparedCamera(map, collapse);
  const filters = { categories, year, progress };
  const { view, busy, error, reload, ready } = usePreparedMapView({ ...camera, ...filters }, profile, onTimeline, revision);
  const { spider, leafBusy, leafError, setLeafError, collapse: collapseLeaves, leaves } = usePreparedLeaves(ready ? view : null, family, profile, filters, reload);
  collapseRef.current = collapseLeaves;
  const selectItem = useCallback((item: ItemSummary) => {
    collapse();
    // Motion and popup must use the same adjacent world copy as the marker.
    onSelect({ ...item, longitude: worldLongitude(map, item.longitude) });
  }, [collapse, map, onSelect]);
  const openItem = useCallback((item: ItemSummary) => {
    collapse();
    onOpenDetail(item);
  }, [collapse, onOpenDetail]);
  const expand = useCallback((node: ExploreFeature) => {
    const spread = node.bounds[0] !== node.bounds[2] || node.bounds[1] !== node.bounds[3];
    if (node.expansionZoom <= 18 && map.getZoom() < 18 && spread) map.setView([node.latitude, worldLongitude(map, node.longitude)], node.expansionZoom, { animate: false });
    else leaves(node, 0);
  }, [map, leaves]);
  const onCluster = useCallback((target: Element) => {
    const id = Number(target.getAttribute('data-explore-node'));
    const node = view?.features.find(feature => feature.id === id);
    if (node) expand(node);
  }, [view, expand]);
  const spiderPositions = useSpiderPositions(map, spider);
  const items = useMemo(() => [...(view?.features.flatMap(f => f.item ? [f.item] : []) ?? []), ...(spider?.items ?? [])], [view, spider]);
  return <>
    <PreparedMarkers map={map} view={view} spider={spider} spiderPositions={spiderPositions} done={done} wip={wip} expand={expand}/>
    <MarkerClickHandler items={items} onSelect={selectItem} onOpenDetail={openItem} onInputModeChange={onInputModeChange} onCluster={onCluster}/>
    {(busy || leafBusy) && <div className="explore-map-status" role="status">{uiText('Loading your world...')}</div>}
    {(error || leafError) && <div className="explore-map-status" role="alert"><span>{uiText('Could not load your world.')}</span> <button type="button" onClick={() => { setLeafError(false); reload(); }}>{uiText('Retry')}</button></div>}
    {spider && <div className="explore-cluster-pages" role="group" aria-label={uiText('Map items')}>
      <button type="button" disabled={spider.offset === 0} onClick={() => leaves(spider.node, Math.max(0, spider.offset - SPIDER_PAGE))}>{uiText('Previous')}</button>
      <span>{spider.offset + 1}–{spider.offset + spider.items.length} / {spider.total}</span>
      <button type="button" disabled={spider.next === null} onClick={() => leaves(spider.node, spider.next!)}>{uiText('Next')}</button>
      <button type="button" onClick={collapse}>{uiText('Close')}</button>
    </div>}
  </>;
}
