import {
  getVehicleFacingScaleX,
  getVehicleMotionTransform,
  getVehicleSpriteView,
  type VehicleTransition,
} from "./vehicleMotion.ts";
import type { VehicleType } from "../../types/journey.ts";

/** Updates the mounted vehicle DOM without asking Leaflet to rebuild its icon. */
export function updateVehicleIconElement(
  element: HTMLElement,
  vehicle: VehicleType,
  bearing: number,
  motionPhaseMs: number,
  transition?: VehicleTransition,
): void {
  const heading = element.querySelector<HTMLElement>('[data-journey-heading]');
  if (heading) heading.style.transform = `translateX(-50%) rotate(${bearing}deg)`;

  const view = getVehicleSpriteView(bearing);
  const facingScaleX = getVehicleFacingScaleX(bearing);
  const hasTransition = Boolean(transition && transition.progress < 1);
  for (const layer of element.querySelectorAll<HTMLElement>('[data-journey-vehicle-layer]')) {
    const layerVehicle = layer.dataset.vehicle;
    const opacity = hasTransition
      ? layerVehicle === transition!.from ? 1 - transition!.progress : layerVehicle === vehicle ? transition!.progress : 0
      : layerVehicle === vehicle ? 1 : 0;
    const motion = getVehicleMotionTransform((layerVehicle ?? vehicle) as VehicleType, motionPhaseMs);
    layer.style.opacity = String(opacity);
    layer.style.transform = `translate(${motion.x}px,${motion.y}px) scaleX(${facingScaleX}) rotate(${motion.rotation}deg)`;
    layer.dataset.view = view;
  }
}
