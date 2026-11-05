import type { ItemSummaryRecord } from '../contracts/db.js';
import { setImmediate as yieldToEventLoop } from 'node:timers/promises';

const MIN_ZOOM = 2, MAX_ZOOM = 18, RADIUS = 60;
const MAX_LATITUDE = 85.0511287798;
export type ClusterBounds = [west: number, south: number, east: number, north: number];
interface Node {
  id: number; count: number; x: number; y: number; bounds: ClusterBounds;
  itemIndex: number | null; children: number[]; splitZoom: number;
}
export interface ClusterTree { format: 1; items: ItemSummaryRecord[]; nodes: Node[]; levels: number[][] }
export interface ClusterFeature {
  id: number; count: number; longitude: number; latitude: number;
  bounds: ClusterBounds; expansionZoom: number; item: ItemSummaryRecord | null;
}

const wrap = (x: number) => x - Math.floor(x);
const delta = (x: number) => x - Math.round(x);
function point(latitude: number, longitude: number): [number, number] {
  const sine = Math.sin(Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude)) * Math.PI / 180);
  return [wrap((longitude + 180) / 360), Math.max(0, Math.min(1, 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)))];
}

/** All input membership must already be authorized and filtered by the caller. */
export async function buildClusterTree(input: readonly ItemSummaryRecord[], signal?: AbortSignal): Promise<ClusterTree> {
  signal?.throwIfAborted();
  if (input.length > 5000) throw new Error('Cluster membership exceeds 5000 items');
  const items = [...input].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const seen = new Set<string>();
  const nodes: Node[] = items.map((item, id) => {
    if (seen.has(item.id) || !Number.isFinite(item.latitude) || !Number.isFinite(item.longitude) ||
      Math.abs(item.latitude) > 90 || Math.abs(item.longitude) > 180) throw new Error('Invalid cluster item');
    seen.add(item.id);
    const [x, y] = point(item.latitude, item.longitude), longitude = item.longitude === 180 ? -180 : item.longitude;
    return { id, count: 1, x, y, bounds: [longitude, item.latitude, longitude, item.latitude], itemIndex: id, children: [], splitZoom: MAX_ZOOM + 1 };
  });
  const levels: number[][] = Array.from({ length: MAX_ZOOM - MIN_ZOOM + 1 }, () => []);
  let current = nodes.map(node => node.id);
  let work = 0;
  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom--) {
    signal?.throwIfAborted();
    const radius = RADIUS / (256 * 2 ** zoom), grid = new Map<string, Set<number>>();
    const cell = (node: Node) => `${Math.floor(node.x / radius)},${Math.floor(node.y / radius)}`;
    for (const id of current) {
      if (++work % 256 === 0) { await yieldToEventLoop(); signal?.throwIfAborted(); }
      const key = cell(nodes[id]!), bucket = grid.get(key) ?? new Set<number>();
      bucket.add(id); grid.set(key, bucket);
    }
    const next: number[] = [];
    for (const id of current) {
      if (++work % 256 === 0) { await yieldToEventLoop(); signal?.throwIfAborted(); }
      const origin = nodes[id]!;
      if (!grid.get(cell(origin))?.has(id)) continue;
      if (id % 128 === 0) signal?.throwIfAborted();
      const neighbors = new Set<number>();
      // Query ordinary and wrapped cells. Removing consumed nodes keeps dense
      // buckets from being rescanned for every already-merged leaf.
      for (const shift of [-1, 0, 1]) {
        const gx = Math.floor((origin.x + shift) / radius), gy = Math.floor(origin.y / radius);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          for (const candidate of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
            if (++work % 256 === 0) { await yieldToEventLoop(); signal?.throwIfAborted(); }
            const node = nodes[candidate]!;
            if (delta(node.x - origin.x) ** 2 + (node.y - origin.y) ** 2 <= radius ** 2) neighbors.add(candidate);
          }
        }
      }
      const children = [...neighbors].sort((a, b) => a - b);
      for (const child of children) {
        if (++work % 256 === 0) { await yieldToEventLoop(); signal?.throwIfAborted(); }
        const key = cell(nodes[child]!), bucket = grid.get(key)!;
        bucket.delete(child); if (!bucket.size) grid.delete(key);
      }
      if (children.length === 1) { next.push(id); continue; }
      let count = 0, x = 0, y = 0;
      const bounds: ClusterBounds = [Infinity, Infinity, -Infinity, -Infinity];
      for (const child of children) {
        if (++work % 256 === 0) { await yieldToEventLoop(); signal?.throwIfAborted(); }
        const node = nodes[child]!, localX = origin.x + delta(node.x - origin.x);
        count += node.count; x += localX * node.count; y += node.y * node.count;
        const shift = 360 * Math.round(localX - node.x);
        bounds[0] = Math.min(bounds[0], node.bounds[0] + shift);
        bounds[1] = Math.min(bounds[1], node.bounds[1]);
        bounds[2] = Math.max(bounds[2], node.bounds[2] + shift);
        bounds[3] = Math.max(bounds[3], node.bounds[3]);
      }
      x /= count; y /= count;
      const turns = Math.floor(x); bounds[0] -= turns * 360; bounds[2] -= turns * 360;
      const cluster: Node = { id: nodes.length, count, x: wrap(x), y, bounds, children, itemIndex: null, splitZoom: zoom + 1 };
      nodes.push(cluster); next.push(cluster.id);
    }
    levels[zoom - MIN_ZOOM] = next; current = next;
  }
  return { format: 1, items, nodes, levels };
}

function feature(tree: ClusterTree, node: Node): ClusterFeature {
  const item = node.itemIndex === null ? null : normalizedItem(tree.items[node.itemIndex]!);
  return { id: node.id, count: node.count, longitude: item?.longitude ?? node.x * 360 - 180,
    latitude: item?.latitude ?? Math.atan(Math.sinh(Math.PI * (1 - 2 * node.y))) * 180 / Math.PI,
    bounds: node.bounds, expansionZoom: node.splitZoom, item };
}

function normalizedItem(item: ItemSummaryRecord): ItemSummaryRecord {
  return item.longitude === 180 ? { ...item, longitude: -180 } : item;
}

/** Geographic bounds may use an unwrapped longitude interval at the seam. */
function intersects(bounds: ClusterBounds, viewport: ClusterBounds): boolean {
  const clamp = (lat: number) => Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
  if (clamp(bounds[3]) < viewport[1] - 1e-8 || clamp(bounds[1]) > viewport[3] + 1e-8) return false;
  const west = viewport[0], east = viewport[2] < west ? viewport[2] + 360 : viewport[2];
  const shift = 360 * Math.round(((west + east) - (bounds[0] + bounds[2])) / 720);
  return bounds[2] + shift >= west && bounds[0] + shift <= east;
}

export function clusterLevel(tree: ClusterTree, zoom: number, bounds?: ClusterBounds, offset = 0, limit = 5000): ClusterFeature[] {
  return clusterLevelPage(tree, zoom, bounds, offset, limit).features;
}

export function clusterLevelPage(tree: ClusterTree, zoom: number, bounds?: ClusterBounds, offset = 0, limit = 5000) {
  if (!Number.isFinite(zoom) || zoom < MIN_ZOOM || zoom > MAX_ZOOM) throw new Error('Invalid cluster zoom');
  const features: ClusterFeature[] = [];
  let total = 0;
  for (const id of tree.levels[Math.floor(zoom) - MIN_ZOOM]!) {
    const node = tree.nodes[id]!;
    if (!node.count || (bounds && !intersects(node.bounds, bounds))) continue;
    if (total >= offset && features.length < limit) features.push(feature(tree, node));
    total++;
  }
  return { features, total };
}

/** Request-local overlay: retain common node IDs, never mutate/persist progress. */
export async function filterClusterTree(tree: ClusterTree, matches: ReadonlySet<string>, signal?: AbortSignal): Promise<ClusterTree> {
  const nodes: Node[] = [];
  let work = 0;
  for (const original of tree.nodes) {
    if (++work % 256 === 0) { await yieldToEventLoop(); signal?.throwIfAborted(); }
    signal?.throwIfAborted();
    if (original.itemIndex !== null) {
      nodes.push({ ...original, count: matches.has(tree.items[original.itemIndex]!.id) ? 1 : 0 });
      continue;
    }
    const children = original.children.filter(id => nodes[id]!.count > 0);
    if (children.length <= 1) {
      const child = children.length ? nodes[children[0]!]! : original;
      nodes.push({ ...child, id: original.id, count: children.length ? child.count : 0 });
      continue;
    }
    let count = 0, x = 0, y = 0;
    const bounds: ClusterBounds = [Infinity, Infinity, -Infinity, -Infinity];
    for (const id of children) {
      if (++work % 256 === 0) { await yieldToEventLoop(); signal?.throwIfAborted(); }
      const child = nodes[id]!, localX = original.x + delta(child.x - original.x);
      count += child.count; x += localX * child.count; y += child.y * child.count;
      const shift = 360 * Math.round(localX - child.x);
      bounds[0] = Math.min(bounds[0], child.bounds[0] + shift); bounds[1] = Math.min(bounds[1], child.bounds[1]);
      bounds[2] = Math.max(bounds[2], child.bounds[2] + shift); bounds[3] = Math.max(bounds[3], child.bounds[3]);
    }
    x /= count; y /= count;
    const turns = Math.floor(x); bounds[0] -= turns * 360; bounds[2] -= turns * 360;
    nodes.push({ ...original, children, count, x: wrap(x), y, bounds });
  }
  return { ...tree, nodes };
}

/** DFS skips entire subtrees before the page; never materialize all leaves. */
export function clusterLeaves(tree: ClusterTree, nodeId: number, offset: number, limit: number): ItemSummaryRecord[] {
  if (!Number.isInteger(nodeId) || !tree.nodes[nodeId] || !Number.isInteger(offset) || offset < 0 ||
    !Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Invalid cluster leaf page');
  const result: ItemSummaryRecord[] = [], pending = [nodeId];
  while (pending.length && result.length < limit) {
    const node = tree.nodes[pending.pop()!]!;
    if (offset >= node.count) { offset -= node.count; continue; }
    if (node.itemIndex !== null) result.push(normalizedItem(tree.items[node.itemIndex]!));
    else for (let i = node.children.length - 1; i >= 0; i--) pending.push(node.children[i]!);
  }
  return result;
}
