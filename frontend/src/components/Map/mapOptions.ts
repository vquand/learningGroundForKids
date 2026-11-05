import type { MapContainerProps } from 'react-leaflet';

export const WORLD_MAP_OPTIONS: MapContainerProps = {
  minZoom: 2, maxZoom: 18, zoomControl: false, className: 'illustrated-world-map',
  maxBounds: [[-85, -180], [85, 180]], maxBoundsViscosity: 0.65,
  dragging: true, touchZoom: true, scrollWheelZoom: true, inertia: true,
  inertiaDeceleration: 2200, inertiaMaxSpeed: 1800, easeLinearity: 0.18,
  zoomAnimation: true, fadeAnimation: true, markerZoomAnimation: true,
  zoomSnap: 0.25, zoomDelta: 0.5, wheelDebounceTime: 48, wheelPxPerZoomLevel: 96,
  bounceAtZoomLimits: false, style: { height: '100%', width: '100%' },
};
