import { expandLocalCluster } from './localClusterInteraction';
import { WORLD_MAP_OPTIONS } from './mapOptions';
import { saveMapViewport, markerState } from './mapHelpers';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import L from "leaflet";
import { useCallback, useMemo, useRef, useState } from "react";
import { AttributionControl, MapContainer } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { useNavigate } from "react-router-dom";

import { useItems } from "../../hooks/useItems";
import { useFilterStore } from "../../stores/filterStore";
import { useProgress } from "../../hooks/useProgress";
import { useProfileStore } from "../../stores/profileStore";
import { useFamilyStore } from '../../stores/familyStore';
import { exploreViewport } from './exploreViewport';
import { createClusterIcon } from "./ClusterIcon";
import { ItemMarker } from "./ItemMarker";
import { ItemPreviewPopup } from "./ItemPreviewPopup";
import { IllustratedEarthLayer } from "./IllustratedEarthLayer";
import { MapZoomControls } from "./MapZoomControls";
import { RememberMapViewport, MarkerClickHandler, MapMotionController } from "./MapInteractions";

import type { ExploreTimelineYear } from "../../types/explore";
import type { ItemSummary } from "../../types/item";
import type { ProgressResponse } from "../../types/progress";

function eraMatches(item: ItemSummary, activeYear: number | null): boolean {
  if (activeYear === null) return true;
  if (item.start_year == null) return false; // era filter active: items without a year are hidden
  const end = item.end_year ?? new Date().getFullYear();
  return item.start_year <= activeYear && activeYear <= end;
}

export interface WorldMapProps {
  itemsOverride?: readonly ItemSummary[];
  progressOverride?: ProgressResponse;
  onOpenDetail?: (item: ItemSummary) => void;
  onTimeline?: (years: ExploreTimelineYear[], version?: string) => void;
}

export function LocalWorldMap({ itemsOverride, progressOverride, onOpenDetail }: WorldMapProps) {
  const language = useUiLanguage();
  const { data: items, isLoading } = useItems(itemsOverride);
  const activeCategories = useFilterStore((s) => s.activeCategories);
  const activeYear = useFilterStore((s) => s.activeYear);
  const navigate = useNavigate();
  const [selectedItem, setSelectedItem] = useState<ItemSummary | null>(null);
  const [inputMode, setInputMode] = useState<"mouse" | "touch">("mouse");

  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const familyId = useFamilyStore(state => state.familyId);
  const generation = useFamilyStore(state => state.sessionGeneration);
  const familyScope = `${familyId}:${generation}`;
  const profileScope = activeProfileId ?? 'practice';
  const mapRef = useRef<L.Map | null>(null);
  const initialView = exploreViewport(familyScope, profileScope);
  const progress = useProgress(activeProfileId, progressOverride);
  const doneSet = useMemo(() => new Set(progress.done_item_ids), [progress.done_item_ids]);
  const wipSet = useMemo(() => new Set(progress.wip_item_ids), [progress.wip_item_ids]);
  const clusterIcon = useCallback((cluster: L.MarkerCluster) => createClusterIcon(cluster), [language]);

  const filteredItems = useMemo(() =>
    items?.filter(
      (item) =>
        (activeCategories.length === 0 ||
        activeCategories.includes(item.category)) &&
        eraMatches(item, activeYear),
    ) ?? [], [items, activeCategories, activeYear]);

  const handleOpenDetail = useCallback((item: ItemSummary) => {
    const map = mapRef.current;
    saveMapViewport(map, familyScope, profileScope);
    if (onOpenDetail) onOpenDetail(item);
    else if (itemsOverride) setSelectedItem(item);
    else navigate(`/items/${item.id}`);
  }, [onOpenDetail, itemsOverride, navigate, familyScope, profileScope]);

  const expand = useCallback((element: Element) => {
    if (mapRef.current) expandLocalCluster(mapRef.current, element);
  }, []);

  // Preview/input changes must not rebuild thousands of Leaflet markers.
  const markers = useMemo(() => filteredItems.map(item => <ItemMarker
    key={item.id}
    item={item}
    state={markerState(item, doneSet, wipSet)}
  />), [filteredItems, doneSet, wipSet]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-blue-50">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <span className="text-6xl">🗺️</span>
          <p className="text-lg text-blue-300 font-semibold">
            {uiText("Loading your world...")}</p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      key={`${familyScope}:${profileScope}`}
      ref={mapRef}
      center={initialView.center}
      zoom={initialView.zoom}
      {...WORLD_MAP_OPTIONS}
    >
      <AttributionControl
        prefix='World data &copy; <a href="https://www.naturalearthdata.com/">Natural Earth</a>'
      />
      <IllustratedEarthLayer />
      <RememberMapViewport family={familyScope} profile={profileScope} />
      <MarkerClusterGroup
        iconCreateFunction={clusterIcon}
        maxClusterRadius={60}
        spiderfyOnMaxZoom={true}
        showCoverageOnHover={false}
        zoomToBoundsOnClick={true}
        animate={false}
        animateAddingMarkers={false}
        chunkedLoading={true}
      >
        {markers}
      </MarkerClusterGroup>

      <MarkerClickHandler
        items={filteredItems}
        onCluster={expand}
        onSelect={setSelectedItem}
        onOpenDetail={handleOpenDetail}
        onInputModeChange={setInputMode}
      />
      <MapMotionController selectedItem={selectedItem} />
      <MapZoomControls />

      {selectedItem && (
        <ItemPreviewPopup
          item={selectedItem}
          touchOptimized={inputMode === "touch"}
          onClose={() => setSelectedItem(null)}
          onViewDetail={itemsOverride
            ? (onOpenDetail ? () => onOpenDetail(selectedItem) : undefined)
            : () => handleOpenDetail(selectedItem)}
        />
      )}
    </MapContainer>
  );
}

