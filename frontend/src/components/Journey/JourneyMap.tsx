import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { splitPathAtWorldEdges } from "./journeyPathWrap";
import { AttributionControl, MapContainer, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import {
  JourneyAnimator,
  buildJourneyRouteSegments,
  normalizeLng,
} from "./JourneyAnimator";
import { createVehicleIcon } from "./VehicleIcon";
import { updateVehicleIconElement } from "./vehicleIconDom";
import {
  getVehicleFacingScaleX,
  getVehicleSpriteView,
  getVehicleTransitionProgress,
  type VehicleTransition,
} from "./vehicleMotion.ts";
import { createJourneyWaypointPopupElement } from "./journeyWaypointPopup.ts";
import { isJourneyDiagnosticsEnabled } from "./journeyDiagnostics";
import { CATEGORY_COLORS } from "../Map/ItemMarker";
import { IllustratedEarthLayer } from "../Map/IllustratedEarthLayer";
import type {
  JourneyWaypoint,
  AnimationState,
  VehicleType,
  JourneySpeed,
} from "../../types/journey";

interface JourneyMapProps {
  origin: {
    latitude: number;
    longitude: number;
    title: string;
  };
  waypoints: JourneyWaypoint[];
  profileEmoji: string;
  profileColor: string;
  isPlaying: boolean;
  speedMultiplier: JourneySpeed;
  onStateChange: (state: AnimationState) => void;
  onWaypointArrive: (index: number, waypoint: JourneyWaypoint) => void;
  onComplete: () => void;
}

export interface JourneyDebugState {
  mapReady: boolean;
  markerMounted: boolean;
  markerInDom: boolean;
  markerTransform: string;
  markerLeft: string;
  markerTop: string;
  mapCenterLat: number;
  mapCenterLng: number;
  mapZoom: number;
  currentLat: number;
  currentLng: number;
  bearing: number;
  currentSegment: number;
  segmentProgress: number;
  totalSegments: number;
  status: AnimationState["status"];
  lastEvent: string;
}

interface MapControllerProps extends JourneyMapProps {
  centerLng: number;
  onDebugChange: (debug: Partial<JourneyDebugState>) => void;
}

export const JOURNEY_DIAGNOSTICS_ENABLED = isJourneyDiagnosticsEnabled(import.meta.env);

function getSafeMapSnapshot(map: L.Map) {
  try {
    if (!(map as L.Map & { _loaded?: boolean })._loaded) {
      return null;
    }

    const center = map.getCenter();
    return {
      mapCenterLat: center.lat,
      mapCenterLng: center.lng,
      mapZoom: map.getZoom(),
    };
  } catch {
    return null;
  }
}

function unwrapAroundCenter(lng: number, center: number): number {
  return center + normalizeLng(lng - center);
}

function unwrapPath(
  path: [number, number][],
  center: number,
): [number, number][] {
  return path.map(([lat, lng]) => [lat, unwrapAroundCenter(lng, center)]);
}

const WORLD_CENTER_LNG = 0;

/** Inner component that manages animated marker + animator via useMap() */
function MapController({
  origin,
  waypoints,
  profileEmoji,
  profileColor,
  isPlaying,
  speedMultiplier,
  centerLng,
  onStateChange,
  onWaypointArrive,
  onComplete,
  onDebugChange,
}: MapControllerProps) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const animatorRef = useRef<JourneyAnimator | null>(null);
  const waypointMarkersRef = useRef<L.CircleMarker[]>([]);
  const arrivalPopupRef = useRef<L.Popup | null>(null);
  const arrivalPopupTimeoutRef = useRef<number | null>(null);
  const statusRef = useRef<AnimationState["status"]>("idle");
  const vehicleRef = useRef<VehicleType>("car");
  const vehicleTransitionRef = useRef<{
    from: VehicleType;
    startedAtMs: number;
  } | null>(null);
  const bearingRef = useRef(0);
  const iconSignatureRef = useRef<string | null>(null);
  const centerLngRef = useRef(centerLng);

  useEffect(() => {
    centerLngRef.current = centerLng;
  }, [centerLng]);

  const publishDebug = useCallback(
    (patch: Partial<JourneyDebugState>) => {
      if (!JOURNEY_DIAGNOSTICS_ENABLED) return;
      const snapshot = getSafeMapSnapshot(map);
      onDebugChange({
        ...(snapshot ?? {}),
        ...patch,
      });
    },
    [map, onDebugChange],
  );

  const clearArrivalPopup = useCallback(() => {
    if (arrivalPopupTimeoutRef.current !== null) {
      window.clearTimeout(arrivalPopupTimeoutRef.current);
      arrivalPopupTimeoutRef.current = null;
    }
    if (arrivalPopupRef.current) {
      map.closePopup(arrivalPopupRef.current);
      arrivalPopupRef.current = null;
    }
  }, [map]);

  const showArrivalPopup = useCallback(
    (waypoint: JourneyWaypoint) => {
      clearArrivalPopup();
      const popup = L.popup({
        autoClose: true,
        closeButton: false,
        closeOnClick: false,
        className: "journey-waypoint-popup",
        offset: [0, -18],
      })
        .setLatLng([
          waypoint.latitude,
          unwrapAroundCenter(waypoint.longitude, centerLngRef.current),
        ])
        .setContent(createJourneyWaypointPopupElement(waypoint))
        .openOn(map);

      arrivalPopupRef.current = popup;
      arrivalPopupTimeoutRef.current = window.setTimeout(() => {
        clearArrivalPopup();
      }, 2200);
    },
    [clearArrivalPopup, map],
  );

  const updateMarkerIcon = useCallback(
    (
      bearingDeg: number,
      motionPhaseMs: number = 0,
      transition?: VehicleTransition,
    ) => {
      const marker = markerRef.current;
      if (!marker) return;
      const view = getVehicleSpriteView(bearingDeg);
      const facingScaleX = getVehicleFacingScaleX(bearingDeg);
      const signature = `${vehicleRef.current}:${view}:${facingScaleX}`;
      if (iconSignatureRef.current !== signature) {
        marker.setIcon(createVehicleIcon(vehicleRef.current, profileEmoji, profileColor, bearingDeg, motionPhaseMs, transition));
        iconSignatureRef.current = signature;
      }
      const element = marker.getElement();
      if (element) updateVehicleIconElement(element, vehicleRef.current, bearingDeg, motionPhaseMs, transition);
    },
    [profileColor, profileEmoji],
  );

  // Fix Leaflet rendering inside flex container — must call after layout paint
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 100);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize marker and animator on mount
  useEffect(() => {
    if (waypoints.length < 1) return;

    vehicleRef.current = "car";
    vehicleTransitionRef.current = null;
    bearingRef.current = 0;
    const originLng = unwrapAroundCenter(origin.longitude, centerLngRef.current);
    const marker = L.marker([origin.latitude, originLng], {
      icon: createVehicleIcon(vehicleRef.current, profileEmoji, profileColor, 0),
      zIndexOffset: 1000,
      interactive: false,
    }).addTo(map);
    markerRef.current = marker;
    iconSignatureRef.current = `car:${getVehicleSpriteView(0)}:${getVehicleFacingScaleX(0)}`;
    publishDebug({
      markerMounted: true,
      currentLat: origin.latitude,
      currentLng: originLng,
      bearing: 0,
      currentSegment: 0,
      segmentProgress: 0,
      totalSegments: waypoints.length,
      status: "idle",
      lastEvent: "marker-mounted",
    });

    const animator = new JourneyAnimator(origin, waypoints, {
      onPositionUpdate: (lat, lng, bearingDeg, _segmentIndex, motionPhaseMs) => {
        const displayLng = unwrapAroundCenter(lng, centerLngRef.current);
        bearingRef.current = bearingDeg;
        marker.setLatLng([lat, displayLng]);
        const transitionState = vehicleTransitionRef.current;
        const transition = transitionState
          ? {
              from: transitionState.from,
              progress: getVehicleTransitionProgress(
                transitionState.startedAtMs,
                motionPhaseMs,
              ),
            }
          : undefined;
        if (transition?.progress === 1) vehicleTransitionRef.current = null;
        updateMarkerIcon(
          bearingDeg,
          motionPhaseMs,
          transition?.progress === 1 ? undefined : transition,
        );
        if (JOURNEY_DIAGNOSTICS_ENABLED) publishDebug({
          currentLat: lat,
          currentLng: displayLng,
          bearing: bearingDeg,
          lastEvent: "position-update",
        });
      },

      onSegmentChange: (_segmentIndex, vehicle) => {
        if (vehicleRef.current !== vehicle) {
          vehicleTransitionRef.current = {
            from: vehicleRef.current,
            startedAtMs: performance.now(),
          };
        }
        vehicleRef.current = vehicle;
        const transitionState = vehicleTransitionRef.current;
        updateMarkerIcon(
          bearingRef.current,
          performance.now(),
          transitionState ? { from: transitionState.from, progress: 0 } : undefined,
        );
        publishDebug({
          lastEvent: `segment-change:${_segmentIndex}:${vehicle}`,
        });
      },

      onWaypointArrive: (waypointIndex, waypoint) => {
        // Add a small dot at waypoint position
        const color =
          CATEGORY_COLORS[waypoint.category] ?? "#FBBF24";
        const waypointLng = unwrapAroundCenter(
          waypoint.longitude,
          centerLngRef.current,
        );
        const dot = L.circleMarker(
          [waypoint.latitude, waypointLng],
          {
            radius: 6,
            fillColor: color,
            fillOpacity: 0.9,
            color: "#fff",
            weight: 2,
          },
        ).addTo(map);
        waypointMarkersRef.current.push(dot);
        showArrivalPopup(waypoint);
        publishDebug({
          currentLat: waypoint.latitude,
          currentLng: waypointLng,
          lastEvent: `arrived:${waypointIndex}:${waypoint.title}`,
        });
        onWaypointArrive(waypointIndex, waypoint);
      },

      onStateChange: (state) => {
        statusRef.current = state.status;
        publishDebug({
          status: state.status,
          currentSegment: state.currentSegment,
          segmentProgress: state.segmentProgress,
          totalSegments: state.totalSegments,
          lastEvent: `state:${state.status}`,
        });
        onStateChange(state);
      },

      onComplete: () => {
        publishDebug({
          status: "complete",
          currentSegment: waypoints.length,
          segmentProgress: 1,
          totalSegments: waypoints.length,
          lastEvent: "complete",
        });
        onComplete();
      },
    });

    animatorRef.current = animator;

    const syncMarkerDom = () => {
      const markerEl = markerRef.current?.getElement();
      publishDebug({
        markerInDom: Boolean(markerEl?.isConnected),
        markerTransform: markerEl?.style.transform ?? "",
        markerLeft: markerEl?.style.left ?? "",
        markerTop: markerEl?.style.top ?? "",
      });
    };

    if (JOURNEY_DIAGNOSTICS_ENABLED) {
      syncMarkerDom();
      map.on("move zoom", syncMarkerDom);
    }
    const intervalId = JOURNEY_DIAGNOSTICS_ENABLED ? window.setInterval(syncMarkerDom, 250) : null;

    return () => {
      if (JOURNEY_DIAGNOSTICS_ENABLED) map.off("move zoom", syncMarkerDom);
      if (intervalId !== null) window.clearInterval(intervalId);
      clearArrivalPopup();
      animator.dispose();
      marker.remove();
      if (JOURNEY_DIAGNOSTICS_ENABLED) onDebugChange({
        markerMounted: false,
        markerInDom: false,
        markerTransform: "",
        markerLeft: "",
        markerTop: "",
        lastEvent: "marker-removed",
      });
      markerRef.current = null;
      iconSignatureRef.current = null;
      vehicleTransitionRef.current = null;
      waypointMarkersRef.current.forEach((m) => m.remove());
      waypointMarkersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearArrivalPopup, origin, waypoints, map, onComplete, onStateChange, onWaypointArrive, profileColor, profileEmoji, publishDebug, showArrivalPopup, updateMarkerIcon]);

  // React to isPlaying changes
  useEffect(() => {
    const animator = animatorRef.current;
    if (!animator) return;

    const status = statusRef.current;

    if (isPlaying) {
      if (status === "idle") {
        animator.play();
      } else if (status === "paused") {
        animator.resume();
      }
    } else {
      if (status === "playing") {
        animator.pause();
      }
    }
  }, [isPlaying]);

  // React to speed changes
  useEffect(() => {
    animatorRef.current?.setSpeed(speedMultiplier);
  }, [speedMultiplier]);

  return null;
}

function RouteBoundsController({
  origin,
  waypoints,
  routeSegments,
  centerLng,
  onReady,
  onDebugChange,
}: {
  origin: JourneyMapProps["origin"];
  waypoints: JourneyWaypoint[];
  routeSegments: [number, number][][];
  centerLng: number;
  onReady: () => void;
  onDebugChange: (debug: Partial<JourneyDebugState>) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const originPoint: [number, number] = [
      origin.latitude,
      unwrapAroundCenter(origin.longitude, centerLng),
    ];
    const routePoints: [number, number][] = [originPoint];
    for (const waypoint of waypoints) {
      routePoints.push([
        waypoint.latitude,
        unwrapAroundCenter(waypoint.longitude, centerLng),
      ]);
    }
    for (const segment of routeSegments) {
      routePoints.push(...unwrapPath(segment, centerLng));
    }

    if (routePoints.length > 1) {
      const bounds = L.latLngBounds(routePoints).pad(0.2);
      const fitZoom = map.getBoundsZoom(bounds, false, L.point(32, 32));
      const containerWidth = Math.max(1, map.getSize().x);
      const noWrapZoom = Math.log2(containerWidth / 256);
      const targetZoom = Math.max(fitZoom, noWrapZoom);
      map.setView(bounds.getCenter(), targetZoom, { animate: false });
    } else {
      map.setView(originPoint, 3, { animate: false });
    }
    onDebugChange({
      mapReady: false,
      ...(getSafeMapSnapshot(map) ?? {}),
      currentLat: origin.latitude,
      currentLng: originPoint[1],
      lastEvent: "map-set-view",
    });

    const id = window.setTimeout(() => {
      map.invalidateSize(false);
      onDebugChange({
        mapReady: true,
        ...(getSafeMapSnapshot(map) ?? {}),
        lastEvent: "map-ready",
      });
      onReady();
    }, 0);
    return () => window.clearTimeout(id);
  }, [map, onDebugChange, onReady, origin, waypoints, routeSegments, centerLng]);

  return null;
}

/** Dedicated MapContainer for journey replay with animated marker + path trail */
export function JourneyMap({
  origin,
  waypoints,
  profileEmoji,
  profileColor,
  isPlaying,
  speedMultiplier,
  onStateChange,
  onWaypointArrive,
  onComplete,
}: JourneyMapProps) {
  const [completedPaths, setCompletedPaths] = useState<
    [number, number][][]
  >([]);
  const [mapReady, setMapReady] = useState(false);
  const routeSegments = useMemo(
    () => buildJourneyRouteSegments(origin, waypoints),
    [origin, waypoints],
  );
  // The painted world is one image clipped to -180..180, so routes wrap at its fixed edges.
  const centerLng = WORLD_CENTER_LNG;
  const originDisplayLng = useMemo(
    () => unwrapAroundCenter(origin.longitude, centerLng),
    [origin.longitude, centerLng],
  );
  const [debug, setDebug] = useState<JourneyDebugState | null>(() => {
    if (!JOURNEY_DIAGNOSTICS_ENABLED) return null;
    return {
      mapReady: false,
      markerMounted: false,
      markerInDom: false,
      markerTransform: "",
      markerLeft: "",
      markerTop: "",
      mapCenterLat: origin.latitude,
      mapCenterLng: originDisplayLng,
      mapZoom: 0,
      currentLat: origin.latitude,
      currentLng: originDisplayLng,
      bearing: 0,
      currentSegment: 0,
      segmentProgress: 0,
      totalSegments: waypoints.length,
      status: "idle",
      lastEvent: "init",
    };
  });

  useEffect(() => {
    setMapReady(false);
    setCompletedPaths([]);
    if (JOURNEY_DIAGNOSTICS_ENABLED) setDebug({
      mapReady: false,
      markerMounted: false,
      markerInDom: false,
      markerTransform: "",
      markerLeft: "",
      markerTop: "",
      mapCenterLat: origin.latitude,
      mapCenterLng: originDisplayLng,
      mapZoom: 0,
      currentLat: origin.latitude,
      currentLng: originDisplayLng,
      bearing: 0,
      currentSegment: 0,
      segmentProgress: 0,
      totalSegments: waypoints.length,
      status: "idle",
      lastEvent: "route-reset",
    });
  }, [origin, waypoints, originDisplayLng]);

  const handleDebugChange = useCallback(
    (patch: Partial<JourneyDebugState>) => {
      if (!JOURNEY_DIAGNOSTICS_ENABLED) return;
      setDebug((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        (
          window as typeof window & {
            __journeyDebug?: JourneyDebugState;
          }
        ).__journeyDebug = next;
        return next;
      });
    },
    [],
  );

  const initialCenter: [number, number] =
    waypoints.length > 0
      ? [origin.latitude, originDisplayLng]
      : [20, 0];

  // Track completed path segments from waypoint arrivals
  const handleWaypointArrive = useCallback(
    (index: number, waypoint: JourneyWaypoint) => {
      const segment = routeSegments[index];
      if (segment && segment.length > 1) {
        setCompletedPaths((paths) => [
          ...paths,
          ...splitPathAtWorldEdges(segment, centerLng),
        ]);
      }
      onWaypointArrive(index, waypoint);
    },
    [onWaypointArrive, routeSegments, centerLng],
  );
  const handleMapReady = useCallback(() => setMapReady(true), []);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={initialCenter}
        zoom={4}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <AttributionControl
          prefix='World data &copy; <a href="https://www.naturalearthdata.com/">Natural Earth</a>'
        />
        <IllustratedEarthLayer />
        {routeSegments.map((path, index) => (
          <Polyline
            key={`route-preview-${index}`}
            positions={splitPathAtWorldEdges(path, centerLng)}
            pathOptions={{
              color: "#fbbf24",
              opacity: 0.5,
              weight: 5,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        ))}
        {completedPaths.map((path, i) => (
          <Polyline
            key={i}
            positions={path}
            pathOptions={{
              color: "#FDE68A",
              opacity: 0.95,
              weight: 6,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        ))}
        <RouteBoundsController
          origin={origin}
          waypoints={waypoints}
          routeSegments={routeSegments}
          centerLng={centerLng}
          onReady={handleMapReady}
          onDebugChange={handleDebugChange}
        />
        <MapController
          origin={origin}
          waypoints={waypoints}
          profileEmoji={profileEmoji}
          profileColor={profileColor}
          isPlaying={isPlaying && mapReady}
          speedMultiplier={speedMultiplier}
          centerLng={centerLng}
          onStateChange={onStateChange}
          onWaypointArrive={handleWaypointArrive}
          onComplete={onComplete}
          onDebugChange={handleDebugChange}
        />
      </MapContainer>
      {JOURNEY_DIAGNOSTICS_ENABLED && debug && <div className="pointer-events-none absolute bottom-3 left-3 z-[1200] max-w-[320px] rounded-xl bg-black/70 px-3 py-2 text-[11px] leading-4 text-white shadow-lg backdrop-blur-sm">
        <div>status: {debug.status}</div>
        <div>
          segment: {debug.currentSegment}/{debug.totalSegments} (
          {(debug.segmentProgress * 100).toFixed(0)}%)
        </div>
        <div>
          marker: {debug.markerMounted ? "mounted" : "missing"} /{" "}
          {debug.markerInDom ? "in-dom" : "not-in-dom"}
        </div>
        <div>
          pos: {debug.currentLat.toFixed(4)}, {debug.currentLng.toFixed(4)}
        </div>
        <div>
          center: {debug.mapCenterLat.toFixed(4)},{" "}
          {debug.mapCenterLng.toFixed(4)} z{debug.mapZoom.toFixed(1)}
        </div>
        <div>
          style: {debug.markerLeft || "-"} / {debug.markerTop || "-"}
        </div>
        <div className="truncate">transform: {debug.markerTransform || "-"}</div>
        <div className="truncate">event: {debug.lastEvent}</div>
      </div>}
    </div>
  );
}
