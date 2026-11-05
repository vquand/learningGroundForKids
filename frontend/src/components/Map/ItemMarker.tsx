import L from "leaflet";
import { Marker } from "react-leaflet";
import { memo, useMemo } from "react";
import type { ItemSummary } from "../../types/item";
import { markerAttribute } from './markerHtml';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { itemPreviewLabel } from './mapMarkerLabels';

/** Category-to-color mapping for marker icons */
export const CATEGORY_COLORS: Record<string, string> = {
  food: "#FF6B6B",
  monument: "#4ECDC4",
  landmark: "#45B7D1",
  music: "#96CEB4",
  movie: "#FFEAA7",
  phenomenon: "#FF9F43",
  animal: "#6C5CE7",
};

/** Category-to-emoji mapping for marker icons */
export const CATEGORY_EMOJIS: Record<string, string> = {
  food: "\u{1F35C}",       // 🍜
  monument: "\u{1F3DB}",   // 🏛
  landmark: "\u26F0",      // ⛰
  music: "\u{1F3B5}",      // 🎵
  movie: "\u{1F3AC}",      // 🎬
  phenomenon: "\u{1F32A}",  // 🌪️
  animal: "\u{1F43E}",      // 🐾
};

export const ANIMAL_ICON_URL = "/map/animal-paw.svg";

export type MarkerState = 'default' | 'wip' | 'done';

/**
 * Creates a 64x64 circular DivIcon for an item category.
 * data-item-id is embedded in the HTML so WorldMap's map-level click
 * handler can detect which item was tapped (react-leaflet-cluster v4
 * breaks standard Leaflet marker click binding).
 * MAP-03: minimum 64px for child-friendly tap targets.
 */
export function createCategoryIcon(
  category: string,
  itemId: string,
  state: MarkerState = 'default',
  itemTitle = '',
): L.DivIcon {
  const color = CATEGORY_COLORS[category] ?? "#999";
  const emoji = CATEGORY_EMOJIS[category] ?? "?";
  // Leaflet resets marker-pane image width, so SVGs need explicit CSS dimensions.
  const symbol = category === 'animal'
    ? `<img src="${ANIMAL_ICON_URL}" width="32" height="32" style="display:block;width:32px;height:32px" alt="" draggable="false">`
    : emoji;

  const borderColor =
    state === 'done' ? '#22c55e' :
    state === 'wip'  ? '#f59e0b' :
    'white';

  const boxShadow =
    state === 'wip'
      ? `0 4px 12px rgba(0,0,0,0.25), 0 0 0 0 rgba(245,158,11,0.5)`
      : '0 4px 12px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.1)';

  const animClass = state === 'wip' ? 'wip-pulse' : '';
  const className = ['map-item-marker', animClass].filter(Boolean).join(' ');

  return L.divIcon({
    iconSize: [64, 64],
    iconAnchor: [32, 32],
    className,
    html: `<div data-item-id="${markerAttribute(itemId)}" class="map-marker-hit-target" style="
      width:64px;height:64px;border-radius:50%;
      background:linear-gradient(135deg,${color},${color}dd);
      display:flex;align-items:center;justify-content:center;
      font-size:28px;border:4px solid ${borderColor};
      box-shadow:${boxShadow};
    "><span aria-hidden="true">${symbol}</span><span class="map-marker-sr-only">${itemPreviewLabel(itemTitle)}</span></div>`,
  });
}

/** Individual item marker on the map with category-colored icon */
export const ItemMarker = memo(function ItemMarker({
  item,
  state = 'default',
  positionOverride,
  longitudeOverride,
}: {
  item: ItemSummary;
  state?: MarkerState;
  positionOverride?: L.LatLngTuple;
  longitudeOverride?: number;
}) {
  const language = useUiLanguage();
  const position = useMemo<L.LatLngTuple>(
    () => positionOverride ?? [item.latitude, longitudeOverride ?? item.longitude],
    [item.latitude, item.longitude, longitudeOverride, positionOverride],
  );
  const icon = useMemo(
    () => createCategoryIcon(item.category, item.id, state, item.title),
    [item.category, item.id, item.title, language, state],
  );
  return (
    <Marker
      position={position}
      icon={icon}
    />
  );
});
