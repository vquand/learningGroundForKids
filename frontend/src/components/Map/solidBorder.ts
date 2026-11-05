import { clipBorderSegment, type BorderBounds, type BorderPoint } from './biomeBorder.ts';

interface BorderRing { path: string; points: BorderPoint[]; bounds: BorderBounds }
interface SolidBorder { path: string; rings: BorderRing[] }
const number = '[-+]?(?:\\d*\\.)?\\d+(?:[eE][-+]?\\d+)?';
const coordinates = new RegExp(`([ML])\\s*(${number})\\s*,\\s*(${number})`, 'g');

/** Parse the atlas's authored M/L/Z geometry once, retaining compound rings. */
export function prepareSolidBorder(path: string): SolidBorder {
  return { path, rings: (path.match(/M[^M]*/g) ?? []).map(source => {
    const points: BorderPoint[] = [];
    const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (const match of source.matchAll(coordinates)) {
      const x = Number(match[2]), y = Number(match[3]);
      points.push([x, y]);
      bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x);
      bounds.top = Math.min(bounds.top, y); bounds.bottom = Math.max(bounds.bottom, y);
    }
    return { path: source.trim(), points, bounds };
  }) };
}

const contains = (outer: BorderBounds, inner: BorderBounds) => outer.left <= inner.left && outer.top <= inner.top && outer.right >= inner.right && outer.bottom >= inner.bottom;
const same = (a: BorderPoint, b: BorderPoint) => Math.abs(a[0] - b[0]) < 1e-10 && Math.abs(a[1] - b[1]) < 1e-10;

/** Clip strokes, never fills: viewport-edge joins must not become coastlines. */
export function clippedSolidBorder(border: SolidBorder, bounds: BorderBounds): string {
  if (border.rings.every(ring => contains(bounds, ring.bounds))) return border.path;
  const paths: string[] = [];
  for (const ring of border.rings) {
    if (ring.bounds.right < bounds.left || ring.bounds.left > bounds.right || ring.bounds.bottom < bounds.top || ring.bounds.top > bounds.bottom) continue;
    if (contains(bounds, ring.bounds)) { paths.push(ring.path); continue; }
    const parts: BorderPoint[][] = [];
    let active: BorderPoint[] | null = null;
    for (let i = 0; i < ring.points.length; i++) {
      const a = ring.points[i]!, b = ring.points[(i + 1) % ring.points.length]!;
      if (same(a, b)) continue;
      const range = clipBorderSegment(a, b, bounds);
      if (!range || range[1] <= range[0]) { active = null; continue; }
      const from: BorderPoint = [a[0] + (b[0] - a[0]) * range[0], a[1] + (b[1] - a[1]) * range[0]];
      const to: BorderPoint = [a[0] + (b[0] - a[0]) * range[1], a[1] + (b[1] - a[1]) * range[1]];
      if (active && same(active.at(-1)!, from)) active.push(to);
      else { active = [from, to]; parts.push(active); }
      if (range[1] < 1) active = null;
    }
    // Unlike a dashed border, a solid line can rotate its start without a
    // phase change. Join through the ring seam to retain the original join.
    if (parts.length > 1 && same(parts.at(-1)!.at(-1)!, parts[0]![0]!)) {
      const last = parts.pop()!;
      parts[0] = last.concat(parts[0]!.slice(1));
    }
    paths.push(...parts.map(points => points.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join(' ')));
  }
  return paths.join(' ');
}

const outlineCache = new WeakMap<SolidBorder, Map<string, string>>();
const borderExtents = new WeakMap<SolidBorder, BorderBounds>();

/** Viewport bounds are already quantized to pixels by earthViewport. Keep their
 * exact values: further rounding would move cut endpoints at seams/dateline. */
export function cachedSolidBorder(border: SolidBorder, bounds: BorderBounds): string {
  let cache = outlineCache.get(border);
  if (!cache) { cache = new Map(); outlineCache.set(border, cache); }
  const key = `${bounds.left},${bounds.top},${bounds.right},${bounds.bottom}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  let extents = borderExtents.get(border);
  if (!extents) {
    extents = border.rings.reduce((box, ring) => ({
      left: Math.min(box.left, ring.bounds.left), top: Math.min(box.top, ring.bounds.top),
      right: Math.max(box.right, ring.bounds.right), bottom: Math.max(box.bottom, ring.bounds.bottom),
    }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    borderExtents.set(border, extents);
  }
  const outside = extents.right < bounds.left || extents.left > bounds.right || extents.bottom < bounds.top || extents.top > bounds.bottom;
  const result = outside ? '' : clippedSolidBorder(border, bounds);
  cache.set(key, result);
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
  return result;
}
