import { useFilterStore } from '../../stores/filterStore';
import { useMapProgress } from './ProgressFilter';
import { WORLD_MAP_OPTIONS } from './mapOptions';
import { saveMapViewport } from './mapHelpers';
import L from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AttributionControl, MapContainer } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useFamilyStore } from '../../stores/familyStore';
import { useProfileStore } from '../../stores/profileStore';
import { fetchItem } from '../../api/items';
import { useProgressData } from '../../hooks/useProgress';
import { familyScopedQuery } from '../../lib/familyQueries';
import { exploreViewport } from './exploreViewport';
import { IllustratedEarthLayer } from './IllustratedEarthLayer';
import { RememberMapViewport, MapMotionController } from './MapInteractions';
import { MapZoomControls } from './MapZoomControls';
import { ItemPreviewPopup } from './ItemPreviewPopup';
import { PreparedMapLayer } from './PreparedMapLayer';
import { EXPLORE_POPUP_PADDING } from './popupViewport';
import type { ItemSummary } from '../../types/item';
import type { ProgressResponse } from '../../types/progress';
import type { ExploreTimelineYear } from '../../types/explore';

export function PreparedWorldMap({ progressOverride, onOpenDetail, onTimeline }: {
  progressOverride?: ProgressResponse; onOpenDetail?: (item: ItemSummary) => void; onTimeline?: (years: ExploreTimelineYear[], version?: string) => void;
}) {
  const family = useFamilyStore(s => s.familyId), generation = useFamilyStore(s => s.sessionGeneration);
  const profile = useProfileStore(s => s.activeProfileId), scope = `${family}:${generation}`;
  const initial = exploreViewport(scope, profile ?? 'practice'), mapRef = useRef<L.Map | null>(null);
  const navigate = useNavigate();
  const { progress: completionFilter } = useMapProgress();
  const categories = useFilterStore(s => s.activeCategories);
  const year = useFilterStore(s => s.activeYear);
  const meaning = JSON.stringify([categories, year, completionFilter]);
  const [selection, setSelection] = useState<{ item: ItemSummary; meaning: string } | null>(null);
  const selected = selection?.meaning === meaning ? selection.item : null;
  const setSelected = useCallback((item: ItemSummary | null) => setSelection(item ? { item, meaning } : null), [meaning]);
  const [inputMode, setInputMode] = useState<'mouse' | 'touch'>('mouse');
  const { progress, ready: progressReady } = useProgressData(profile, progressOverride);
  const done = useMemo(() => new Set(progress.done_item_ids), [progress.done_item_ids]);
  const wip = useMemo(() => new Set(progress.wip_item_ids), [progress.wip_item_ids]);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!selected || !family || !profile) return;
    void queryClient.prefetchQuery({
      queryKey: ['item', family, profile, selected.id, 'en'],
      queryFn: familyScopedQuery(family, () => fetchItem(selected.id, 'en', profile)),
    });
  }, [family, profile, queryClient, selected]);
  const open = useCallback((item: ItemSummary) => {
    const map = mapRef.current;
    saveMapViewport(map, scope, profile ?? 'practice');
    if (onOpenDetail) onOpenDetail(item); else navigate(`/items/${encodeURIComponent(item.id)}`);
  }, [scope, profile, onOpenDetail, navigate]);
  return <MapContainer ref={mapRef} center={initial.center} zoom={initial.zoom} {...WORLD_MAP_OPTIONS}>
    <AttributionControl prefix='World data &copy; <a href="https://www.naturalearthdata.com/">Natural Earth</a>'/>
    <IllustratedEarthLayer/>
    <RememberMapViewport family={scope} profile={profile ?? 'practice'}/>
    <PreparedMapLayer profile={profile} progressReady={progressReady} done={done} wip={wip} onSelect={setSelected} onOpenDetail={open} onInputModeChange={setInputMode} onTimeline={onTimeline}/>
    <MapMotionController selectedItem={selected}/>
    <MapZoomControls/>
    {selected && <ItemPreviewPopup item={selected} touchOptimized={inputMode === 'touch'} viewportPadding={EXPLORE_POPUP_PADDING} onClose={() => setSelected(null)} onViewDetail={() => open(selected)}/>}
  </MapContainer>;
}
