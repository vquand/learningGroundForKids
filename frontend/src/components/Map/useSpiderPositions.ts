import L from 'leaflet';
import { useMemo } from 'react';
import { worldLongitude } from './usePreparedCamera';
import type { Spider } from './usePreparedLeaves';

export function useSpiderPositions(map: L.Map, spider: Spider | null) {
  return useMemo(() => {
    if (!spider) return [];
    const size = map.getSize();
    const radius = Math.min(spider.items.length > 8 ? 125 : 85, Math.max(70, (size.y - 396) / 2));
    const source = map.latLngToContainerPoint([spider.node.latitude, worldLongitude(map, spider.node.longitude)]);
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    // Keep the current leaf page inside the play area, above the pager/actions
    // and below the timeline. Legs still point to the actual cluster position.
    const center = L.point(clamp(source.x, 96 + radius + 32, size.x - radius - 84), clamp(source.y, 148 + radius + 32, size.y - 176 - radius - 32));
    return spider.items.map((item, i) => {
      const angle = i * 2 * Math.PI / spider.items.length - Math.PI / 2;
      const point = map.containerPointToLatLng(center.add(L.point(Math.cos(angle) * radius, Math.sin(angle) * radius)));
      return { item, position: [point.lat, point.lng] as L.LatLngTuple };
    });
  }, [map, spider]);
}
