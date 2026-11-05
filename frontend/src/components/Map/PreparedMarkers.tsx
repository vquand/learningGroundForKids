import type L from 'leaflet';
import { memo, useMemo } from 'react';
import { Marker, Polyline } from 'react-leaflet';
import { createClusterIcon } from './ClusterIcon';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { ItemMarker } from './ItemMarker';
import { markerState } from './mapHelpers';
import { worldLongitude } from './usePreparedCamera';
import type { ExploreFeature, ExploreView } from '../../types/explore';
import type { ItemSummary } from '../../types/item';
import type { Spider } from './usePreparedLeaves';

const PreparedCluster = memo(function PreparedCluster({ feature, longitude, expand }: { feature: ExploreFeature; longitude: number; expand: (node: ExploreFeature) => void }) {
  const language = useUiLanguage();
  const icon = useMemo(() => createClusterIcon({ getChildCount: () => feature.count }, feature.id), [feature.id, feature.count, language]);
  const position = useMemo<L.LatLngTuple>(() => [feature.latitude, longitude], [feature.latitude, longitude]);
  const events = useMemo(() => ({ click: () => expand(feature) }), [expand, feature]);
  return <Marker position={position} icon={icon} eventHandlers={events}/>;
});

export function PreparedMarkers({ map, view, spider, spiderPositions, done, wip, expand }: {
  map: L.Map; view: ExploreView | null; spider: Spider | null;
  spiderPositions: { item: ItemSummary; position: L.LatLngTuple }[];
  done: Set<string>; wip: Set<string>; expand: (feature: ExploreFeature) => void;
}) {
  const markers = useMemo(() => <>
    {view?.features.filter(f => f.id !== spider?.node.id).map(feature => feature.item ?
      <ItemMarker key={`item-${feature.item.id}`} item={feature.item} state={markerState(feature.item, done, wip)} longitudeOverride={worldLongitude(map, feature.longitude)}/> :
      <PreparedCluster key={`cluster-${feature.id}`} feature={feature} longitude={worldLongitude(map, feature.longitude)} expand={expand}/>)}
    {spiderPositions.map(({ item, position }) => <ItemMarker key={`spider-${item.id}`} item={item} positionOverride={position} state={markerState(item, done, wip)}/>)}
  </>, [view, spider, spiderPositions, map, done, wip, expand]);
  return <>
    {markers}
    {spider && spiderPositions.map(({ item, position }) => <Polyline key={`leg-${item.id}`} positions={[[spider.node.latitude, worldLongitude(map, spider.node.longitude)], position]} interactive={false} pathOptions={{ color: '#7860bc', weight: 1.5, opacity: 0.7 }}/>) }
  </>;
}
