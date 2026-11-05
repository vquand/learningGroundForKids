interface PixelPoint { x: number; y: number }

/** Keep the SVG surface bounded, even when the projected world is millions of pixels wide. */
export function earthViewport(min: PixelPoint, max: PixelPoint, worldSize: number) {
  const padding = 256;
  // Small overview surfaces are cheap to retain and cache. Reframing them
  // during each half-step button zoom costs more than the offscreen pixels.
  const overview = worldSize <= 2048;
  const left = overview ? 0 : Math.max(0, Math.floor(min.x - padding));
  const right = overview ? worldSize : Math.min(worldSize, Math.ceil(max.x + padding));
  const top = overview ? 0 : Math.max(0, Math.floor(min.y - padding));
  const bottom = overview ? worldSize : Math.min(worldSize, Math.ceil(max.y + padding));
  return {
    min: { x: left, y: top }, max: { x: right, y: bottom },
    viewBox: [left * 720 / worldSize, top * 360 / worldSize,
      (right - left) * 720 / worldSize, (bottom - top) * 360 / worldSize].join(' '),
    strokeBounds: { left: left * 720 / worldSize, right: right * 720 / worldSize,
      top: top * 360 / worldSize, bottom: bottom * 360 / worldSize },
  };
}
