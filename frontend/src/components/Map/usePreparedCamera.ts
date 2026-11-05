import type L from 'leaflet';
import { useEffect, useState } from 'react';
import type { ExploreBounds } from '../../types/explore';

function viewport(map: L.Map, padding: number) {
  const box = map.getBounds().pad(padding);
  const width = box.getEast() - box.getWest();
  const west = ((box.getWest() + 180) % 360 + 360) % 360 - 180;
  return { zoom: Math.floor(map.getZoom()), bounds: (width >= 360 ? [-180, Math.max(-90, box.getSouth()), 180, Math.min(90, box.getNorth())] :
    [west, Math.max(-90, box.getSouth()), west + width, Math.min(90, box.getNorth())]) as ExploreBounds };
}
function contains(outer: ExploreBounds, inner: ExploreBounds) {
  const shift = 360 * Math.round(((outer[0] + outer[2]) - (inner[0] + inner[2])) / 720);
  return (outer[2] - outer[0] >= 360 || (inner[0] + shift >= outer[0] && inner[2] + shift <= outer[2])) && inner[1] >= outer[1] && inner[3] <= outer[3];
}
export const worldLongitude = (map: L.Map, lng: number) => lng + 360 * Math.round((map.getCenter().lng - lng) / 360);

export function usePreparedCamera(map: L.Map, collapse: () => void) {
  const [camera, setCamera] = useState(() => viewport(map, 0.25));
  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const actual = viewport(map, 0);
        setCamera(previous => previous.zoom === actual.zoom && contains(previous.bounds, actual.bounds) ? previous : viewport(map, 0.25));
      });
    };
    map.on('moveend zoomend resize', update);
    map.on('zoomstart dragstart resize', collapse);
    return () => {
      cancelAnimationFrame(frame);
      map.off('moveend zoomend resize', update);
      map.off('zoomstart dragstart resize', collapse);
    };
  }, [map, collapse]);
  return camera;
}
