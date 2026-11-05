import { getVehicleSvg } from "./vehicleSprites.ts";
import {
  getVehicleFacingScaleX,
  getVehicleCameraView,
  getVehicleMotionTransform,
  getVehicleSpriteView,
  type VehicleTransition,
} from "./vehicleMotion.ts";
import type { VehicleType } from "../../types/journey.ts";

/** Keep the moving journey marker visible when the camera looks across the globe. */
export const JOURNEY_VEHICLE_DISABLE_DEPTH_TEST_DISTANCE = Number.POSITIVE_INFINITY;

/**
 * Cesium reloads a billboard image when its data URL changes. Keep the image
 * stable between meaningful view/motion frames so camera-follow does not
 * constantly invalidate the cute vehicle texture.
 */
export function getVehicleBillboardRenderKey(
  vehicle: VehicleType,
  bearing: number,
  motionPhaseMs: number,
  transition?: VehicleTransition,
  cameraBearing?: number,
): string {
  const cameraView = cameraBearing === undefined
    ? undefined
    : getVehicleCameraView(bearing, cameraBearing);
  const view = cameraView?.view ?? getVehicleSpriteView(bearing);
  const facingScaleX = cameraView?.scaleX ?? getVehicleFacingScaleX(bearing);
  const transitionKey = transition
    ? `${transition.from}:${Math.round(transition.progress * 20)}`
    : "none";
  const motionFrame = Math.floor(motionPhaseMs / 120);

  return `${vehicle}:${view}:${facingScaleX}:${transitionKey}:${motionFrame}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unwrapSvgMarkup(svg: string): string {
  return svg
    .replace(/<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
}

export function createVehicleBillboard(
  vehicle: VehicleType,
  emoji: string,
  color: string,
  bearing: number,
  scale: number = 1,
  motionPhaseMs: number = 0,
  transition?: VehicleTransition,
  cameraBearing?: number,
): string {
  const renderVehicleGroup = (
    vehicleType: VehicleType,
    opacity: number,
  ): string => {
    const cameraView = cameraBearing === undefined
      ? undefined
      : getVehicleCameraView(bearing, cameraBearing);
    const view = cameraView?.view ?? getVehicleSpriteView(bearing);
    const sprite = getVehicleSvg(vehicleType, view);
    const vehicleMarkup = unwrapSvgMarkup(sprite);
    const motion = getVehicleMotionTransform(vehicleType, motionPhaseMs);
    const vehicleSize = 48 * scale;
    const vehicleOffsetX = 48 - vehicleSize / 2 + motion.x;
    const vehicleOffsetY = 40 - vehicleSize / 2 + motion.y;
    const facingScaleX = cameraView?.scaleX ?? getVehicleFacingScaleX(bearing);
    return `<g data-vehicle="${vehicleType}" data-view="${view}" opacity="${opacity}" transform="translate(${vehicleOffsetX} ${vehicleOffsetY}) scale(${scale})"><g transform="translate(24 24) scale(${facingScaleX} 1) rotate(${motion.rotation}) translate(-24 -24)">${vehicleMarkup}</g></g>`;
  };
  const hasTransition = Boolean(transition && transition.progress < 1);
  const vehicleMarkup = hasTransition
    ? `${renderVehicleGroup(transition!.from, 1 - transition!.progress)}${renderVehicleGroup(vehicle, transition!.progress)}`
    : renderVehicleGroup(vehicle, 1);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="rgba(15,23,42,0.28)" />
        </filter>
      </defs>
      <g filter="url(#shadow)">
        ${vehicleMarkup}
        <circle cx="48" cy="18" r="16" fill="${escapeXml(color)}" stroke="#ffffff" stroke-width="3" />
        <text x="48" y="24" text-anchor="middle" font-size="18">${escapeXml(emoji)}</text>
      </g>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
