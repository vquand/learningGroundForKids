import L from 'leaflet';
import { forwardRef, useImperativeHandle, useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';

/**
 * SVGOverlay normally changes SVG width/height on every continuous pinch/fly
 * zoom. Transform the existing surface instead, then reframe through setBounds
 * at gesture end. This keeps the atlas off the layout/paint path while moving.
 */
export const ViewportSVGOverlay = forwardRef<L.SVGOverlay, {
  bounds: L.LatLngBounds;
  attributes: Record<string, string>;
  children: ReactNode;
}>(function ViewportSVGOverlay({ bounds, attributes, children }, ref) {
  const map = useMap();
  const [surface] = useState(() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // Leaflet's SVGOverlay uses DomUtil on SVG too; its helper typings accept
    // only HTMLElement even though both expose the CSS style used here.
    const cssSurface = svg as unknown as HTMLElement;
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    for (const [name, value] of Object.entries(attributes)) svg.setAttribute(name, value);
    const layer = L.svgOverlay(svg, bounds, { pane: 'illustrated-earth-pane' });
    let baseZoom = map.getZoom();
    const setBounds = layer.setBounds;
    layer.setBounds = function (nextBounds) {
      baseZoom = map.getZoom();
      return setBounds.call(this, nextBounds);
    };
    const events = layer.getEvents!();
    const reset = events.viewreset!;
    events.viewreset = event => { baseZoom = map.getZoom(); reset.call(layer, event); };
    events.zoom = () => {
      const origin = map.latLngToLayerPoint(layer.getBounds().getNorthWest());
      L.DomUtil.setTransform(cssSurface, origin, map.getZoomScale(map.getZoom(), baseZoom));
    };
    events.zoomanim = event => {
      const target = event as L.ZoomAnimEvent;
      const pane = L.DomUtil.getPosition(map.getPane('mapPane')!);
      const pixelOrigin = map.project(target.center, target.zoom).subtract(map.getSize().divideBy(2)).add(pane).round();
      const origin = map.project(layer.getBounds().getNorthWest(), target.zoom).subtract(pixelOrigin);
      L.DomUtil.setTransform(cssSurface, origin, map.getZoomScale(target.zoom, baseZoom));
    };
    // Leaflet calls getEvents again on removal: retain the same callbacks.
    layer.getEvents = () => events;
    return { svg, layer };
  });
  useLayoutEffect(() => {
    surface.layer.addTo(map);
    return () => { surface.layer.remove(); };
  }, [map, surface]);
  useImperativeHandle(ref, () => surface.layer, [surface]);
  return createPortal(children, surface.svg);
});
