import { z } from 'zod';
import { createHash } from 'node:crypto';
import { AppError } from '../errors.js';
import { CachedCatalog, parseCatalogSnapshot } from './catalog.js';
import { buildClusterTree, clusterLeaves, clusterLevelPage, filterClusterTree, type ClusterBounds, type ClusterTree } from './clusters.js';
import type { ExploreRepository, MapFilters, MapLeavesInput, MapScope, MapTimelineYear, MapViewInput } from './contracts.js';

export const MAP_CATEGORIES = ['animal', 'food', 'landmark', 'monument', 'movie', 'music', 'phenomenon'] as const;
const integer = z.number().int().min(-2147483648).max(2147483647);
const boundsSchema = z.tuple([z.number().finite(), z.number().min(-90).max(90), z.number().finite(), z.number().min(-90).max(90)]);
const treeSchema = z.object({ format: z.literal(1), items: z.array(z.unknown()).max(5000), nodes: z.array(z.object({
  id: z.number().int().min(0).max(9999), count: z.number().int().min(1).max(5000),
  x: z.number().min(0).lt(1), y: z.number().min(0).max(1), bounds: boundsSchema,
  itemIndex: z.number().int().min(0).max(4999).nullable(), children: z.array(z.number().int().min(0).max(9999)).max(5000),
  splitZoom: z.number().int().min(3).max(19),
})).max(9999), levels: z.array(z.array(z.number().int().min(0).max(9999)).max(5000)).length(17) });
const preparedSchema = z.object({ format: z.literal(1), tree: treeSchema,
  timeline: z.array(z.object({ year: integer, count: z.number().int().min(1).max(5000) })).max(5000) });
interface Prepared { format: 1; tree: ClusterTree; timeline: MapTimelineYear[] }

/** Durable JSON is bounded and checked before resolving any node references. */
export function parsePreparedMap(value: unknown): Prepared {
  const parsed = preparedSchema.parse(value), tree = parsed.tree;
  const items = parseCatalogSnapshot({ format: 1, items: tree.items }).items;
  if (tree.nodes.length >= Math.max(1, items.length * 2) || tree.nodes.length < items.length) throw new Error('Invalid prepared node count');
  for (const [index, node] of tree.nodes.entries()) {
    if (node.id !== index || node.bounds[0] > node.bounds[2] || node.bounds[1] > node.bounds[3] ||
      node.children.some(child => child >= index) || new Set(node.children).size !== node.children.length) throw new Error('Invalid prepared node');
    if (index < items.length) {
      if (node.itemIndex !== index || node.count !== 1 || node.children.length || node.splitZoom !== 19) throw new Error('Invalid prepared leaf');
    } else if (node.itemIndex !== null || node.children.length < 2 || node.children.reduce((n, id) => n + tree.nodes[id]!.count, 0) !== node.count) throw new Error('Invalid prepared cluster');
  }
  for (const level of tree.levels) if (new Set(level).size !== level.length ||
    level.some(id => !tree.nodes[id]) || level.reduce((n, id) => n + tree.nodes[id]!.count, 0) !== items.length) throw new Error('Invalid prepared level');
  if (parsed.timeline.reduce((n, r) => n + r.count, 0) > 5000) throw new Error('Invalid prepared timeline');
  return { format: 1, tree: { ...tree, items }, timeline: parsed.timeline };
}

export function normalizeMapFilters(input: MapFilters): MapFilters {
  if (input.categories.length > 14 || input.categories.some(c => !(MAP_CATEGORIES as readonly string[]).includes(c)) ||
    (input.year !== null && !integer.safeParse(input.year).success)) throw new AppError(400, 'INVALID_MAP_FILTER', 'Map filters are invalid.');
  const categories = [...new Set(input.categories)].sort();
  const progress = input.progress ?? 'all';
  if (!['all', 'todo', 'done'].includes(progress)) throw new AppError(400, 'INVALID_MAP_FILTER', 'Map progress filter is invalid.');
  return { categories: categories.length === MAP_CATEGORIES.length ? [] : categories, year: input.year, progress };
}

export class ExploreMaps implements ExploreRepository {
  constructor(private readonly catalog: CachedCatalog,
    private readonly doneIds?: (scope: MapScope, ids: string[]) => Promise<string[]>) {}

  private async projection(input: MapScope & MapFilters) {
    const progress = normalizeMapFilters(input).progress!;
    if (progress !== 'all' && !input.profileId) throw new AppError(400, 'INVALID_MAP_PROFILE', 'Choose a profile for progress filters.');
    const prepared = await this.prepare(input);
    if (progress === 'all') return prepared;
    if (!this.doneIds) throw new AppError(503, 'EXPLORE_UNAVAILABLE', 'Map progress is unavailable.');
    const tree = prepared.value.tree, done = new Set(await this.doneIds(input, tree.items.map(item => item.id)));
    const matches = new Set(tree.items.filter(item => done.has(item.id) === (progress === 'done')).map(item => item.id));
    const version = createHash('sha256').update(JSON.stringify([prepared.version, input.familyId, input.profileId, progress,
      tree.items.filter(item => done.has(item.id)).map(item => item.id)])).digest('hex');
    return { version, shared: false, value: { ...prepared.value, tree: await filterClusterTree(tree, matches) }, total: matches.size };
  }

  private prepare(input: MapScope & MapFilters) {
    const filters = normalizeMapFilters(input), currentYear = new Date().getUTCFullYear();
    const variant = (items: import('../contracts/db.js').ItemSummaryRecord[]) => {
      // The UI selects authored start years, not arbitrary 32-bit variants.
      // Validate before claiming a projection job to bound cache-miss churn.
      if (filters.year !== null && !items.some(i => i.start_year === filters.year)) throw new AppError(400, 'INVALID_MAP_YEAR', 'Choose a year from this map timeline.');
      return JSON.stringify(['clusters-v1', filters.categories, filters.year, filters.year === null ? null : currentYear]);
    };
    return this.catalog.project({ familyId: input.familyId, ...(input.profileId ? { profileId: input.profileId } : {}) }, variant, async (items, signal): Promise<Prepared> => {
      const years = new Map<number, number>();
      for (const item of items) if (item.start_year != null) years.set(item.start_year, (years.get(item.start_year) ?? 0) + 1);
      const selected = items.filter(item => (!filters.categories.length || filters.categories.includes(item.category)) &&
        (filters.year === null || (item.start_year != null && item.start_year <= filters.year && filters.year <= (item.end_year ?? currentYear))));
      return { format: 1, tree: await buildClusterTree(selected, signal),
        timeline: [...years].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count })) };
    }, parsePreparedMap);
  }

  async view(input: MapViewInput) {
    const prepared = await this.projection(input);
    const validator = createHash('sha256').update(JSON.stringify(['map-view-v1', prepared.version, Math.floor(input.zoom), input.bounds, input.offset, input.limit])).digest('hex');
    // Only common, authorized views may be reused from durable browser storage.
    if (prepared.shared && input.knownVersion === validator) return { version: prepared.version, validator, not_modified: true as const };
    const visible = clusterLevelPage(prepared.value.tree, input.zoom, input.bounds, input.offset, input.limit);
    return { version: prepared.version, validator, shared: prepared.shared, total: 'total' in prepared ? prepared.total : prepared.value.tree.items.length, zoom: Math.floor(input.zoom),
      features: visible.features, timeline: prepared.value.timeline,
      next_offset: input.offset + input.limit < visible.total ? input.offset + input.limit : null };
  }

  async leaves(input: MapLeavesInput) {
    const prepared = await this.projection(input);
    if (prepared.version !== input.version) throw new AppError(409, 'EXPLORE_VIEW_CHANGED', 'The map changed. Reload this view.');
    const node = prepared.value.tree.nodes[input.node];
    if (!node || !node.count) throw new AppError(404, 'EXPLORE_CLUSTER_NOT_FOUND', 'Map cluster not found.');
    return { version: prepared.version, total: node.count, items: clusterLeaves(prepared.value.tree, input.node, input.offset, input.limit),
      next_offset: input.offset + input.limit < node.count ? input.offset + input.limit : null };
  }
}
