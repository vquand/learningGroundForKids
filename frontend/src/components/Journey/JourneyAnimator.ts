import greatCircle from "@turf/great-circle";
import { distance } from "@turf/distance";
import { point } from "@turf/helpers";
import {
  classifyPathTerrains,
  classifyPointTerrain,
  classifySegment,
} from "./terrainClassifier";
import { getJourneySegmentBearing } from "./journeyBearing.ts";
import { getLastReachedWaypointIndex } from "./journeyWaypointLabel.ts";
import type {
  JourneyWaypoint,
  VehicleType,
  TerrainType,
  JourneySpeed,
  AnimationState,
} from "../../types/journey";
import type { Feature, LineString } from "geojson";

const TERRAIN_TO_VEHICLE: Record<TerrainType, VehicleType> = {
  land: "car",
  ocean: "boat",
  undersea: "submarine",
  mountain_air: "zeppelin",
  hot_desert: "camel",
  cold_desert: "sled",
};

interface AnimatorCallbacks {
  onPositionUpdate: (
    lat: number,
    lng: number,
    bearing: number,
    segmentIndex: number,
    motionPhaseMs: number,
    lastReachedWaypointIndex: number,
  ) => void;
  onSegmentChange: (
    segmentIndex: number,
    vehicle: VehicleType,
    terrain: TerrainType,
  ) => void;
  onWaypointArrive: (waypointIndex: number, waypoint: JourneyWaypoint) => void;
  onStateChange: (state: AnimationState) => void;
  onComplete: () => void;
}

interface JourneyOrigin {
  latitude: number;
  longitude: number;
}

export function normalizeLng(lng: number): number {
  return (((lng + 180) % 360) + 360) % 360 - 180;
}

export function unwrapRouteLongitudes<
  O extends { longitude: number },
  W extends { longitude: number },
>(origin: O, waypoints: W[]): { origin: O; waypoints: W[] } {
  const outOrigin: O = { ...origin };
  const outWaypoints: W[] = [];
  let prevLng = origin.longitude;

  for (const waypoint of waypoints) {
    let lng = waypoint.longitude;
    const diff = lng - prevLng;
    if (diff > 180) lng -= 360;
    else if (diff < -180) lng += 360;
    outWaypoints.push({ ...waypoint, longitude: lng });
    prevLng = lng;
  }

  return { origin: outOrigin, waypoints: outWaypoints };
}

function stitchArcCoordinates(
  arc: Feature<LineString> | { geometry: { type: string; coordinates: unknown } },
): Array<[number, number]> {
  if (arc.geometry.type === "LineString") {
    return (arc.geometry.coordinates as Array<[number, number]>).map(
      ([lng, lat]) => [lng, lat],
    );
  }

  const parts = arc.geometry.coordinates as Array<Array<[number, number]>>;
  const out: Array<[number, number]> = [];
  let partOffset = 0;

  for (const part of parts) {
    if (!part || part.length === 0) continue;
    if (out.length > 0) {
      const prev = out[out.length - 1]!;
      const firstCandidate = part[0]![0] + partOffset;
      const delta = firstCandidate - prev[0];
      if (delta > 180) partOffset -= 360;
      else if (delta < -180) partOffset += 360;
    }

    for (const [lng, lat] of part) {
      out.push([lng + partOffset, lat]);
    }
  }

  return out;
}

export function buildJourneyRouteSegments(
  origin: JourneyOrigin,
  waypoints: JourneyWaypoint[],
): [number, number][][] {
  const unwrapped = unwrapRouteLongitudes(origin, waypoints);
  const allPoints = [unwrapped.origin, ...unwrapped.waypoints];
  const segments: [number, number][][] = [];

  for (let i = 0; i < allPoints.length - 1; i++) {
    const wp1 = allPoints[i]!;
    const wp2 = allPoints[i + 1]!;

    const wp1Norm = normalizeLng(wp1.longitude);
    const wp2Norm = normalizeLng(wp2.longitude);
    const arc = greatCircle(
      [wp1Norm, wp1.latitude],
      [wp2Norm, wp2.latitude],
      { npoints: 160 },
    );
    const stitched = stitchArcCoordinates(arc as Feature<LineString>);
    const arcShift = stitched.length > 0 ? wp1.longitude - stitched[0]![0] : 0;
    const coordinates =
      arcShift === 0
        ? stitched
        : stitched.map(([lng, lat]) => [lng + arcShift, lat] as [number, number]);

    const latLngs = coordinates
      .filter(
        (coordinate) =>
          Array.isArray(coordinate) &&
          coordinate.length >= 2 &&
          isFinite(coordinate[0] as number) &&
          isFinite(coordinate[1] as number),
      )
      .map(([lng, lat]) => [lat, lng] as [number, number]);

    if (latLngs.length >= 2) {
      segments.push(latLngs);
    }
  }

  return segments;
}

type JourneyRoutePhase = {
  latLngs: [number, number][];
  distanceKm: number;
  terrain: TerrainType;
  vehicle: VehicleType;
};

type AnimationSegment = {
  line: Feature<LineString>;
  distanceKm: number;
  terrain: TerrainType;
  vehicle: VehicleType;
  waypointArrivalIndex: number | null;
};

function computePathDistanceKm(latLngs: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < latLngs.length; i++) {
    total += distance(
      point([latLngs[i - 1]![1], latLngs[i - 1]![0]]),
      point([latLngs[i]![1], latLngs[i]![0]]),
    );
  }
  return total;
}

function terrainAtPoint(latLng: [number, number]): TerrainType {
  return classifyPointTerrain(latLng[0], latLng[1]);
}

function interpolateLatLng(
  from: [number, number],
  to: [number, number],
  t: number,
): [number, number] {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
  ];
}

function refineTerrainBoundary(
  from: [number, number],
  to: [number, number],
  startTerrain: TerrainType,
): [number, number] {
  let low = from;
  let high = to;

  for (let i = 0; i < 18; i++) {
    const mid = interpolateLatLng(low, high, 0.5);
    if (terrainAtPoint(mid) === startTerrain) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return interpolateLatLng(low, high, 0.5);
}

function buildRoutePhases(latLngs: [number, number][]): JourneyRoutePhase[] {
  if (latLngs.length < 2) {
    return [
      {
        latLngs,
        distanceKm: 0,
        terrain: "land",
        vehicle: TERRAIN_TO_VEHICLE.land,
      },
    ];
  }

  const path = [...latLngs];
  const terrains = classifyPathTerrains(path);
  const phases: JourneyRoutePhase[] = [];
  let phaseStart = 0;
  let currentTerrain = terrains[0] ?? "land";

  for (let i = 1; i < terrains.length; i++) {
    if (terrains[i] === currentTerrain) continue;

    const transitionPoint = refineTerrainBoundary(
      path[i - 1]!,
      path[i]!,
      currentTerrain,
    );

    const phaseLatLngs = [...path.slice(phaseStart, i), transitionPoint];
    if (phaseLatLngs.length >= 2) {
      phases.push({
        latLngs: phaseLatLngs,
        distanceKm: computePathDistanceKm(phaseLatLngs),
        terrain: currentTerrain,
        vehicle: TERRAIN_TO_VEHICLE[currentTerrain],
      });
    }

    path[i - 1] = transitionPoint;
    phaseStart = i - 1;
    currentTerrain = terrains[i] ?? currentTerrain;
  }

  const tailLatLngs = path.slice(phaseStart);
  if (tailLatLngs.length >= 2) {
    phases.push({
      latLngs: tailLatLngs,
      distanceKm: computePathDistanceKm(tailLatLngs),
      terrain: currentTerrain,
      vehicle: TERRAIN_TO_VEHICLE[currentTerrain],
    });
  }

  return phases.length > 0
    ? phases
    : [
        {
          latLngs,
          distanceKm: computePathDistanceKm(latLngs),
          terrain: "land",
          vehicle: TERRAIN_TO_VEHICLE.land,
        },
      ];
}

/**
 * rAF-based animation controller that drives a marker along great-circle arcs
 * between journey waypoints, with terrain-based vehicle swapping.
 */
export class JourneyAnimator {
  private segments: Feature<LineString>[] = [];
  private segmentDistances: number[] = [];
  private segmentTerrains: TerrainType[] = [];
  private segmentVehicles: VehicleType[] = [];
  private segmentWaypointArrivals: Array<number | null> = [];
  private allPoints: JourneyOrigin[] = [];
  private waypoints: JourneyWaypoint[];
  private state: AnimationState;
  private rafId: number | null = null;
  private lastTimestamp = 0;
  private speedMultiplier: JourneySpeed = 1;
  private speedKmPerSec = 400;
  private callbacks: AnimatorCallbacks;

  constructor(
    origin: JourneyOrigin,
    waypoints: JourneyWaypoint[],
    callbacks: AnimatorCallbacks,
  ) {
    this.waypoints = waypoints;
    this.callbacks = callbacks;
    const unwrapped = unwrapRouteLongitudes(origin, waypoints);
    this.allPoints = [unwrapped.origin, ...unwrapped.waypoints];

    const routeSegments = buildJourneyRouteSegments(origin, waypoints);
    const animationSegments: AnimationSegment[] = [];

    for (let i = 0; i < routeSegments.length; i++) {
      const wp1 = this.allPoints[i]!;
      const wp2 = this.allPoints[i + 1]!;
      const fallbackTerrain = classifySegment(
        [wp1.latitude, wp1.longitude],
        [wp2.latitude, wp2.longitude],
      );

      const phases = buildRoutePhases(
        routeSegments[i]!,
      );

      for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex++) {
        const phase = phases[phaseIndex]!;
        animationSegments.push({
          line: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: phase.latLngs.map(([lat, lng]) => [lng, lat]),
            },
          },
          distanceKm:
            phase.distanceKm > 0
              ? phase.distanceKm
              : distance(
                  point([wp1.longitude, wp1.latitude]),
                  point([wp2.longitude, wp2.latitude]),
                ),
          terrain: phase.terrain ?? fallbackTerrain,
          vehicle: phase.vehicle ?? TERRAIN_TO_VEHICLE[fallbackTerrain],
          waypointArrivalIndex: phaseIndex === phases.length - 1 ? i : null,
        });
      }
    }

    for (const animationSegment of animationSegments) {
      this.segments.push(animationSegment.line);
      this.segmentDistances.push(animationSegment.distanceKm);
      this.segmentTerrains.push(animationSegment.terrain);
      this.segmentVehicles.push(animationSegment.vehicle);
      this.segmentWaypointArrivals.push(animationSegment.waypointArrivalIndex);
    }

    this.state = {
      status: "idle",
      currentSegment: 0,
      segmentProgress: 0,
      totalSegments: this.segments.length,
    };
  }

  play(): void {
    this.state.status = "playing";
    this.state.currentSegment = 0;
    this.state.segmentProgress = 0;
    this.lastTimestamp = performance.now();

    if (this.segments.length > 0) {
      this.callbacks.onSegmentChange(
        0,
        this.segmentVehicles[0]!,
        this.segmentTerrains[0]!,
      );
    }
    this.callbacks.onStateChange({ ...this.state });

    if (this.segments.length > 0) {
      this.rafId = requestAnimationFrame(this._tick.bind(this));
    } else {
      this.state.status = "complete";
      this.callbacks.onStateChange({ ...this.state });
      this.callbacks.onComplete();
    }
  }

  pause(): void {
    this.state.status = "paused";
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.callbacks.onStateChange({ ...this.state });
  }

  resume(): void {
    this.state.status = "playing";
    this.lastTimestamp = performance.now();
    this.callbacks.onStateChange({ ...this.state });
    this.rafId = requestAnimationFrame(this._tick.bind(this));
  }

  setSpeed(multiplier: JourneySpeed): void {
    this.speedMultiplier = multiplier;
  }

  dispose(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.state.status = "idle";
  }

  getState(): AnimationState {
    return { ...this.state };
  }

  private _tick(timestamp: number): void {
    if (this.state.status !== "playing") return;

    const deltaMs = Math.min(timestamp - this.lastTimestamp, 100);
    this.lastTimestamp = timestamp;

    const segIdx = this.state.currentSegment;
    const segment = this.segments[segIdx];
    const segDist = this.segmentDistances[segIdx];

    if (!segment || segDist == null || !isFinite(segDist)) {
      this.state.status = "complete";
      this.callbacks.onStateChange({ ...this.state });
      this.callbacks.onComplete();
      return;
    }

    const baseDuration =
      (segDist / this.speedKmPerSec) * 1000;
    const clampedBaseDuration = Math.max(3000, Math.min(baseDuration, 12000));
    const segmentDuration = clampedBaseDuration / this.speedMultiplier;

    this.state.segmentProgress += deltaMs / segmentDuration;

    if (this.state.segmentProgress >= 1) {
      const waypointArrivalIndex = this.segmentWaypointArrivals[segIdx];
      if (
        waypointArrivalIndex != null &&
        waypointArrivalIndex < this.waypoints.length
      ) {
        this.callbacks.onWaypointArrive(
          waypointArrivalIndex,
          this.waypoints[waypointArrivalIndex]!,
        );
      }

      this.state.currentSegment = segIdx + 1;
      this.state.segmentProgress = 0;

      if (this.state.currentSegment >= this.segments.length) {
        this.state.status = "complete";
        this.callbacks.onStateChange({ ...this.state });
        this.callbacks.onComplete();
        return;
      }

      this.callbacks.onSegmentChange(
        this.state.currentSegment,
        this.segmentVehicles[this.state.currentSegment]!,
        this.segmentTerrains[this.state.currentSegment]!,
      );
      this.callbacks.onStateChange({ ...this.state });
      this.rafId = requestAnimationFrame(this._tick.bind(this));
      return;
    }

    const coords = segment.geometry.coordinates;
    if (!coords || coords.length < 2) {
      this.rafId = requestAnimationFrame(this._tick.bind(this));
      return;
    }

    const t = this.state.segmentProgress;
    const floatIdx = t * (coords.length - 1);
    const idx0 = Math.floor(floatIdx);
    const idx1 = Math.min(idx0 + 1, coords.length - 1);
    const frac = floatIdx - idx0;

    const c0 = coords[idx0];
    const c1 = coords[idx1];
    if (!c0 || !c1) {
      this.state.currentSegment = segIdx + 1;
      this.state.segmentProgress = 0;

      if (this.state.currentSegment >= this.segments.length) {
        this.state.status = "complete";
        this.callbacks.onStateChange({ ...this.state });
        this.callbacks.onComplete();
        return;
      }

      this.callbacks.onSegmentChange(
        this.state.currentSegment,
        this.segmentVehicles[this.state.currentSegment]!,
        this.segmentTerrains[this.state.currentSegment]!,
      );
      this.callbacks.onStateChange({ ...this.state });
      this.rafId = requestAnimationFrame(this._tick.bind(this));
      return;
    }

    const lng =
      (c0[0] as number) + ((c1[0] as number) - (c0[0] as number)) * frac;
    const lat =
      (c0[1] as number) + ((c1[1] as number) - (c0[1] as number)) * frac;

    const currentBearing = getJourneySegmentBearing(
      c0 as [number, number],
      c1 as [number, number],
    );

    this.callbacks.onPositionUpdate(
      lat,
      lng,
      currentBearing,
      segIdx,
      timestamp,
      getLastReachedWaypointIndex(this.segmentWaypointArrivals, segIdx),
    );
    this.callbacks.onStateChange({ ...this.state });
    this.rafId = requestAnimationFrame(this._tick.bind(this));
  }
}
