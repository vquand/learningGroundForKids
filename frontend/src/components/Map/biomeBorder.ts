export type BorderPoint = readonly [number, number];
export interface BorderBounds { left: number; top: number; right: number; bottom: number }

/** Clip one segment parametrically, retaining its position along the original line. */
export function clipBorderSegment(a: BorderPoint, b: BorderPoint, bounds: BorderBounds): [number, number] | null {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  let start = 0, end = 1;
  for (const [p, q] of [[-dx, a[0] - bounds.left], [dx, bounds.right - a[0]],
    [-dy, a[1] - bounds.top], [dy, bounds.bottom - a[1]]]) {
    if (p === 0) { if (q! < 0) return null; continue; }
    const ratio = q! / p!;
    if (p! < 0) start = Math.max(start, ratio); else end = Math.min(end, ratio);
    if (start > end) return null;
  }
  return [start, end];
}

/**
 * SVG expands tiny non-scaling dashes along the ENTIRE world-sized ellipse,
 * even offscreen. Clip only the border; retain the full biome fill/land mask.
 * Preserve the original dash phase using distance in projected screen pixels.
 */
export function clippedBiomeBorder(points: readonly BorderPoint[], bounds: BorderBounds, worldSize: number) {
  if (!points.length) return [];
  if (points.every(([x, y]) => x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom)) {
    return [{ path: `${points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')} Z`, dashOffset: 0 }];
  }
  const parts: { path: string; dashOffset: number }[] = [];
  let distance = 0;
  let last: BorderPoint | null = null;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.hypot(dx * worldSize / 720, dy * worldSize / 360);
    const range = clipBorderSegment(a, b, bounds);
    if (range && range[1] > range[0]) {
      const from: BorderPoint = [a[0] + dx * range[0], a[1] + dy * range[0]];
      const to: BorderPoint = [a[0] + dx * range[1], a[1] + dy * range[1]];
      if (last && Math.abs(last[0] - from[0]) < 1e-10 && Math.abs(last[1] - from[1]) < 1e-10) {
        parts.at(-1)!.path += ` L${to[0]},${to[1]}`;
      } else {
        parts.push({ path: `M${from[0]},${from[1]} L${to[0]},${to[1]}`, dashOffset: -((distance + length * range[0]) % 6) });
      }
      last = range[1] === 1 ? to : null;
    } else last = null;
    distance += length;
  }
  return parts;
}
