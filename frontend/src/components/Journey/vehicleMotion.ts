import type { VehicleType } from "../../types/journey.ts";

export const VEHICLE_SWAP_DURATION_MS = 320;

export type VehicleMotionKind = "land" | "water" | "air";
export type VehicleSpriteView = "side" | "front" | "back";

export interface VehicleMotionTransform {
  x: number;
  y: number;
  rotation: number;
}

export interface VehicleCameraView {
  view: VehicleSpriteView;
  scaleX: 1 | -1;
}

export interface VehicleTransition {
  from: VehicleType;
  progress: number;
}

export function getVehicleMotionKind(vehicle: VehicleType): VehicleMotionKind {
  if (vehicle === "boat" || vehicle === "submarine") return "water";
  if (vehicle === "zeppelin") return "air";
  return "land";
}

/**
 * Select the view whose axis dominates the geographic bearing. Northbound
 * travel shows the rear, southbound travel shows the front, and east/west
 * travel uses the side artwork.
 */
export function getVehicleSpriteView(bearing: number): VehicleSpriteView {
  const radians = (bearing * Math.PI) / 180;
  const eastWestComponent = Math.sin(radians);
  const northSouthComponent = Math.cos(radians);

  if (Math.abs(northSouthComponent) > Math.abs(eastWestComponent)) {
    return northSouthComponent >= 0 ? "back" : "front";
  }
  return "side";
}

/** Mirror only westbound side artwork; front and rear views remain centered. */
export function getVehicleFacingScaleX(bearing: number): 1 | -1 {
  if (getVehicleSpriteView(bearing) !== "side") return 1;
  const eastWestComponent = Math.sin((bearing * Math.PI) / 180);
  return eastWestComponent < -0.000001 ? -1 : 1;
}

function normalizeBearingDelta(bearing: number): number {
  return ((bearing + 180) % 360 + 360) % 360 - 180;
}

/**
 * Select the vehicle artwork from the camera's position relative to the
 * vehicle's travel heading. A camera ahead of the vehicle sees its front,
 * behind it sees the rear, and cameras on either side see mirrored side art.
 */
export function getVehicleCameraView(
  vehicleBearing: number,
  cameraBearing: number,
): VehicleCameraView {
  const relativeBearing = normalizeBearingDelta(cameraBearing - vehicleBearing);
  const absoluteBearing = Math.abs(relativeBearing);

  if (absoluteBearing <= 45) return { view: "front", scaleX: 1 };
  if (absoluteBearing >= 135) return { view: "back", scaleX: 1 };
  return {
    view: "side",
    scaleX: relativeBearing < 0 ? -1 : 1,
  };
}

export function getVehicleTransitionProgress(
  startedAtMs: number,
  nowMs: number,
): number {
  if (nowMs <= startedAtMs) return 0;
  return Math.min(1, (nowMs - startedAtMs) / VEHICLE_SWAP_DURATION_MS);
}

/**
 * Returns a subtle transform in sprite-space. The motion is deliberately
 * small enough to survive zooming out while still making terrain changes
 * readable: land bounces, water waddles, and air floats.
 */
export function getVehicleMotionTransform(
  vehicle: VehicleType,
  phaseMs: number,
): VehicleMotionTransform {
  const seconds = phaseMs / 1000;
  const kind = getVehicleMotionKind(vehicle);

  if (kind === "water") {
    const wave = Math.sin(seconds * Math.PI * 2 * 1.35);
    return {
      x: Math.sin(seconds * Math.PI * 2 * 0.7) * 0.55,
      y: wave * 1.05,
      rotation: wave * 2.8 + Math.sin(seconds * Math.PI * 2 * 2.7) * 0.7,
    };
  }

  if (kind === "air") {
    const float = Math.sin(seconds * Math.PI * 2 * 0.82);
    return {
      x: Math.sin(seconds * Math.PI * 2 * 0.43) * 0.45,
      y: float * 1.35,
      rotation: float * 1.1,
    };
  }

  const bounce = Math.sin(seconds * Math.PI * 2 * 1.55);
  return {
    x: 0,
    y: bounce * 0.75,
    rotation: bounce * 1.15,
  };
}
