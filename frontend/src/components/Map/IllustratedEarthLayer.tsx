import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import L from 'leaflet';
import { flushSync } from 'react-dom';
import { earthViewport } from './earthViewport';
import { clippedBiomeBorder, type BorderBounds } from './biomeBorder';
import { cachedSolidBorder } from './solidBorder';
import { atlasGeometry } from './atlasGeometry';
import { createContext, Fragment, memo, useContext, useId, useLayoutEffect, useRef, useState } from "react";
import { Pane, useMap, useMapEvents } from "react-leaflet";
import { ViewportSVGOverlay } from './ViewportSVGOverlay';

import {
  DESERT_REGIONS,
  ICE_REGIONS,
  MAJOR_FOREST_REGIONS,
  WORLD_SURFACE_PALETTE,
  ellipticalRegionPath,
  ellipticalRegionPoints,
  terrainDetailForZoom,
  type TerrainDetail,
  type TerrainRegion,
} from "./illustratedEarth";

const SvgScope = createContext("");

const FOREST_PATHS = MAJOR_FOREST_REGIONS.map((region) => ({ region, path: ellipticalRegionPath(region), points: ellipticalRegionPoints(region) }));
const DESERT_PATHS = DESERT_REGIONS.map((region) => ({ region, path: ellipticalRegionPath(region), points: ellipticalRegionPoints(region) }));
const ICE_PATHS = ICE_REGIONS.map((region) => ({ region, path: ellipticalRegionPath(region), points: ellipticalRegionPoints(region) }));

function IllustratedEarthDefs({ hatchSize }: { hatchSize: number }) {
  useUiLanguage();
  const scope = useContext(SvgScope);
  const { LAND_PATH } = atlasGeometry();
  return (
    <defs>
      <pattern id={`${scope}-illustrated-earth-hatching`} width={hatchSize} height={hatchSize} patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
        <path d={`M0 0 V${hatchSize}`} stroke="#5c5048" strokeOpacity="0.09" strokeWidth={hatchSize * 0.08} />
      </pattern>
      <clipPath id={`${scope}-illustrated-earth-world-clip`}><rect width="720" height="360" /></clipPath>
      <clipPath id={`${scope}-illustrated-earth-land-clip`}>
        <path d={LAND_PATH} clipRule="evenodd" />
      </clipPath>
    </defs>
  );
}

function BiomeRegions({
  className,
  detail,
  farOpacity = 0.82,
  groundOpacity = 0.82,
  regions,
  bounds,
  worldSize,
}: {
  className: string;
  detail: TerrainDetail;
  farOpacity?: number;
  groundOpacity?: number;
  regions: readonly { region: TerrainRegion; path: string; points: [number, number][] }[];
  bounds: BorderBounds;
  worldSize: number;
}) {
  useUiLanguage();
  const scope = useContext(SvgScope);
  return (
    <g className={className} clipPath={`url(#${scope}-illustrated-earth-land-clip)`}>
      {regions.map(({ region, path, points }) => {
        const parts = clippedBiomeBorder(points, bounds, worldSize);
        const opacity = detail === "detail" ? 0.58 : 0.4;
        // Isolate alpha only when fragments can overlap at the closed seam.
        // A single border needs no offscreen group compositing surface.
        const grouped = parts.length > 1;
        const borders = parts.map((part, index) => <path
            key={index}
            className="illustrated-earth__biome-border"
            d={part.path}
            strokeDashoffset={part.dashOffset}
            fill="none"
            stroke="#756c61"
            strokeOpacity={grouped ? 1 : opacity}
            strokeWidth="1.5"
            strokeDasharray="1.5 4.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />);
        return <Fragment key={region.id}>
          <path d={path} fill={region.fill} fillOpacity={detail === "detail" ? groundOpacity : farOpacity} />
          {grouped ? <g opacity={opacity}>{borders}</g> : borders}
        </Fragment>;
      })}
    </g>
  );
}

/** Real Earth geometry rendered with a deterministic, hand-inked biome atlas. */
export const IllustratedEarthLayer = memo(function IllustratedEarthLayer() {
  useUiLanguage();
  const scope = useId().replace(/:/g, "");
  const map = useMap();
  const overlay = useRef<L.SVGOverlay | null>(null);
  const viewport = () => {
    const pixels = map.getPixelBounds();
    const zoom = map.getZoom();
    const view = earthViewport(pixels.min!, pixels.max!, map.options.crs!.scale(zoom));
    return { ...view, zoom, bounds: L.latLngBounds(
      map.unproject(L.point(view.min.x, view.min.y), zoom),
      map.unproject(L.point(view.max.x, view.max.y), zoom),
    ) };
  };
  const [view, setView] = useState(viewport);
  const initialBounds = useRef(view.bounds);
  const mounted = useRef(true);
  const pending = useRef<((current: typeof view) => typeof view)[]>([]);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const updateView = (change: (current: typeof view) => typeof view) => {
    pending.current.push(change);
    if (pending.current.length > 1) return;
    // Camera events can fire inside React effects as well as Leaflet animation
    // frames. Coalesce them, leave the current lifecycle, then commit before
    // paint so a new camera never displays an old outline envelope.
    queueMicrotask(() => {
      const changes = pending.current;
      pending.current = [];
      if (mounted.current) flushSync(() => setView(current => changes.reduce((next, apply) => apply(next), current)));
    });
  };
  const updateViewport = () => updateView(() => viewport());
  const extendOutline = (target: BorderBounds) => updateView(current => {
    const bounds = current.strokeBounds;
    if (target.left >= bounds.left && target.top >= bounds.top && target.right <= bounds.right && target.bottom <= bounds.bottom) return current;
    return { ...current, strokeBounds: {
      left: Math.min(bounds.left, target.left), top: Math.min(bounds.top, target.top),
      right: Math.max(bounds.right, target.right), bottom: Math.max(bounds.bottom, target.bottom),
    } };
  });
  useMapEvents({
    zoomend: updateViewport,
    zoomanim: (event) => {
      const center = map.project(event.center, event.zoom);
      const halfSize = map.getSize().divideBy(2);
      const target = earthViewport(center.subtract(halfSize), center.add(halfSize), map.options.crs!.scale(event.zoom)).strokeBounds;
      // Prepare all outline segments that the CSS animation can reveal, without
      // resetting the overlay's transform in the middle of Leaflet's animation.
      extendOutline(target);
    },
    moveend: updateViewport,
    resize: updateViewport,
    move: () => {
      // Overflow preserves the full fills during motion. Extend only the
      // outline envelope; reframe the SVG once on moveend.
      const pixels = map.getPixelBounds();
      const size = map.options.crs!.scale(map.getZoom());
      const marginX = 64 * 720 / size, marginY = 64 * 360 / size;
      if ((view.strokeBounds.left > 0 && pixels.min!.x * 720 / size < view.strokeBounds.left + marginX) ||
        (view.strokeBounds.right < 720 && pixels.max!.x * 720 / size > view.strokeBounds.right - marginX) ||
        (view.strokeBounds.top > 0 && pixels.min!.y * 360 / size < view.strokeBounds.top + marginY) ||
        (view.strokeBounds.bottom < 360 && pixels.max!.y * 360 / size > view.strokeBounds.bottom - marginY)) {
        const target = earthViewport(pixels.min!, pixels.max!, size).strokeBounds;
        extendOutline(target);
      }
    },
  });

  // React Leaflet only reads SVG attributes on creation. Update the viewBox and
  // bounds together before paint so geography never jumps between two scales.
  useLayoutEffect(() => {
    const layer = overlay.current;
    layer?.getElement()?.setAttribute('viewBox', view.viewBox);
    layer?.setBounds(view.bounds);
  }, [view.bounds, view.viewBox]);

  const detail = terrainDetailForZoom(view.zoom);
  const zoomScale = 2 ** Math.max(0, view.zoom - 2);
  return (
    <SvgScope.Provider value={scope}>
      <Pane name="illustrated-earth-pane" style={{ zIndex: 200 }}>
        <ViewportSVGOverlay
          ref={overlay}
          bounds={initialBounds.current}
          attributes={{
            class: "illustrated-earth",
            viewBox: view.viewBox,
            preserveAspectRatio: "none",
            // Preserve coverage through zoom-out/fly animations. The artwork
            // has its own canonical-world clip, independent of this viewport.
            overflow: "visible",
            role: "img",
            "aria-label": uiText("Illustrated map of Earth"),
          }}
        >
          <EarthArtwork detail={detail} hatchSize={5 / zoomScale} scope={scope} bounds={view.strokeBounds} worldSize={map.options.crs!.scale(view.zoom)} />
        </ViewportSVGOverlay>
      </Pane>
    </SvgScope.Provider>
  );
});

// Fills retain the authored geometry; only offscreen outlines are clipped.
const EarthArtwork = memo(function EarthArtwork({ detail, hatchSize, scope, bounds, worldSize }: {
  detail: TerrainDetail; hatchSize: number; scope: string; bounds: BorderBounds; worldSize: number;
}) {
  // Keep cut endpoints beyond the widest stroke's miter even at world edges.
  // The canonical world clip still masks all authored off-world geometry.
  const strokeBounds = { left: bounds.left - 32 * 720 / worldSize, top: bounds.top - 32 * 360 / worldSize,
    right: bounds.right + 32 * 720 / worldSize, bottom: bounds.bottom + 32 * 360 / worldSize };
  const { LAND_PATH, LAND_BORDER, COUNTRY_PATHS } = atlasGeometry();
  const landOutline = cachedSolidBorder(LAND_BORDER, strokeBounds);
  return <>
          <IllustratedEarthDefs hatchSize={hatchSize} />
          <g data-terrain-detail={detail} data-outline-bounds={`${bounds.left} ${bounds.top} ${bounds.right} ${bounds.bottom}`} clipPath={`url(#${scope}-illustrated-earth-world-clip)`}>
            <g className="illustrated-earth__ocean" pointerEvents="none">
                <rect
                  x={0}
                  y={0}
                  width={720}
                  height={360}
                  fill={WORLD_SURFACE_PALETTE.ocean}
                />
            </g>
              <svg x={0} y={0} width={720} height={360} viewBox="0 0 720 360" overflow="hidden">
                <g className="illustrated-earth__shallows" pointerEvents="none">
                  <path d={landOutline} fill="none" stroke="#c7d5c8" strokeWidth="10" vectorEffect="non-scaling-stroke" />
                  <path d={landOutline} fill="none" stroke="#dce1cf" strokeWidth="5" vectorEffect="non-scaling-stroke" />
                </g>
                <path d={LAND_PATH} fill={WORLD_SURFACE_PALETTE.coast} fillRule="evenodd" />
                <path className="illustrated-earth__coast-shadow" d={landOutline} fill="none" stroke="#51463f" strokeOpacity="0.22" strokeWidth="5" vectorEffect="non-scaling-stroke" />
                <g className="illustrated-earth__countries">
                  {COUNTRY_PATHS.map((country) => {
                    const outline = cachedSolidBorder(country.border, strokeBounds);
                    // Fully visible outlines need no split path or extra SVG node.
                    if (outline === country.path) return <path key={country.key} d={country.path} fill={country.fill} fillRule="evenodd" stroke="#64584f" strokeOpacity="0.42" strokeWidth="0.65" vectorEffect="non-scaling-stroke" />;
                    // The custom pane uses normal SVG paint order: fill, stroke.
                    return <Fragment key={country.key}>
                      <path d={country.path} fill={country.fill} fillRule="evenodd" />
                      {outline && <path d={outline} fill="none" stroke="#64584f" strokeOpacity="0.42" strokeWidth="0.65" vectorEffect="non-scaling-stroke" />}
                    </Fragment>;
                  })}
                </g>
                <path d={LAND_PATH} fill={`url(#${scope}-illustrated-earth-hatching)`} fillRule="evenodd" pointerEvents="none" />
                <BiomeRegions className="illustrated-earth__deserts" detail={detail} regions={DESERT_PATHS} bounds={bounds} worldSize={worldSize} />
                <BiomeRegions className="illustrated-earth__forests" detail={detail} farOpacity={0.96} groundOpacity={0.14} regions={FOREST_PATHS} bounds={bounds} worldSize={worldSize} />
                <BiomeRegions className="illustrated-earth__ice" detail={detail} regions={ICE_PATHS} bounds={bounds} worldSize={worldSize} />
                <path className="illustrated-earth__coast-ink" d={landOutline} fill="none" stroke="#3f3732" strokeOpacity="0.9" strokeWidth="1.25" vectorEffect="non-scaling-stroke" pointerEvents="none" />
                <rect
                  className="illustrated-earth__frame illustrated-earth__frame--outer"
                  x="2"
                  y="2"
                  width="716"
                  height="356"
                  rx="7"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
                <rect
                  className="illustrated-earth__frame illustrated-earth__frame--inner"
                  x="8"
                  y="8"
                  width="704"
                  height="344"
                  rx="5"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              </svg>
          </g>
  </>;
});
