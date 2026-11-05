import L from "leaflet";
import { getVehicleSvg } from "./vehicleSprites.ts";
import { getVehicleFacingScaleX, getVehicleMotionTransform, getVehicleSpriteView, type VehicleTransition } from "./vehicleMotion.ts";
import type { VehicleType } from "../../types/journey.ts";
export { updateVehicleIconElement } from "./vehicleIconDom.ts";

/**
 * Creates an 80x80 Leaflet DivIcon compositing a vehicle SVG + profile avatar circle.
 * The pointer shows the full heading while the side-view sprite mirrors east/west.
 */
export function createVehicleIcon(
  vehicle: VehicleType,
  emoji: string,
  color: string,
  bearing: number = 0,
  motionPhaseMs: number = 0,
  transition?: VehicleTransition,
): L.DivIcon {
  const renderVehicleLayer = (vehicleType: VehicleType, opacity: number): string => {
    const motion = getVehicleMotionTransform(vehicleType, motionPhaseMs);
    const view = getVehicleSpriteView(bearing);
    const facingScaleX = getVehicleFacingScaleX(bearing);
    const sprite = getVehicleSvg(vehicleType, view);
    return `<span data-journey-vehicle-layer="true" data-vehicle="${vehicleType}" data-view="${view}" style="position:absolute;inset:0;opacity:${opacity};transform:translate(${motion.x}px,${motion.y}px) scaleX(${facingScaleX}) rotate(${motion.rotation}deg);">${sprite}</span>`;
  };
  const hasTransition = Boolean(transition && transition.progress < 1);
  const vehicleMarkup = hasTransition
    ? `${renderVehicleLayer(transition!.from, 1 - transition!.progress)}${renderVehicleLayer(vehicle, transition!.progress)}`
    : renderVehicleLayer(vehicle, 1);
  return L.divIcon({
    iconSize: [80, 80],
    iconAnchor: [40, 40],
    className: "",
    html: `<div style="width:80px;height:80px;position:relative;">
      <div style="
        position:absolute;
        left:50%;
        top:26px;
        width:0;
        height:0;
        transform:translateX(-50%) rotate(${bearing}deg);
        transform-origin:50% 18px;
        z-index:1;
      " data-journey-heading="true">
        <div style="
          position:absolute;
          left:-7px;
          top:-16px;
          width:14px;
          height:18px;
          clip-path:polygon(50% 0%, 100% 100%, 50% 72%, 0% 100%);
          background:#ef4444;
          border:2px solid #333;
          box-sizing:border-box;
          filter:drop-shadow(0 1px 2px rgba(0,0,0,0.25));
        "></div>
      </div>
      <div class="journey-vehicle" style="
        position:absolute;
        bottom:0;
        left:50%;
        transform:translateX(-50%);
        width:48px;
        height:48px;
        z-index:2;
      ">${vehicleMarkup}</div>
      <div style="
        position:absolute;
        top:0;
        left:50%;
        transform:translateX(-50%);
        width:32px;
        height:32px;
        border-radius:50%;
        background:${color};
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:18px;
        border:2px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
        z-index:3;
      ">${emoji}</div>
    </div>`,
  });
}
