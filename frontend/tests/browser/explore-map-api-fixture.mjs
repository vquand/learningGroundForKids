// HTTP-boundary fixture for the production browser harness. Real PostgreSQL,
// authentication and publication tests live in server/tests/db/explore-*.
import { createHash } from 'node:crypto';
import { buildClusterTree, clusterLeaves, clusterLevel } from '../../../server/src/explore/clusters.ts';
const trees = new Map();
export async function preparedMapFixture(url, items) {
  const p = url.searchParams, categories = (p.get('categories') ?? '').split(',').filter(Boolean).sort(), year = p.has('year') ? Number(p.get('year')) : null;
  const key = JSON.stringify([items[0]?.id, items.length, categories, year]);
  let cached = trees.get(key);
  if (!cached) {
    const normalized = items.map(item => ({ ...item, has_quiz: Boolean(item.has_quiz) }));
    const selected = normalized.filter(i => (!categories.length || categories.includes(i.category)) && (year === null || (i.start_year != null && i.start_year <= year && year <= (i.end_year ?? new Date().getUTCFullYear()))));
    cached = { tree: await buildClusterTree(selected), version: createHash('sha256').update(key).digest('hex') };
    trees.set(key, cached); if (trees.size > 32) trees.delete(trees.keys().next().value);
  }
  const { tree, version } = cached, offset = Number(p.get('offset') ?? 0), limit = Number(p.get('limit') ?? 200);
  const node = url.pathname.match(/\/map\/clusters\/(\d+)\/leaves$/)?.[1];
  if (node) {
    if (p.get('version') !== version) throw new Error('Fixture version changed');
    const total = tree.nodes[Number(node)].count;
    return { version, total, items: clusterLeaves(tree, Number(node), offset, limit), next_offset: offset + limit < total ? offset + limit : null };
  }
  const zoom = Math.floor(Number(p.get('zoom') ?? 2)), bounds = (p.get('bounds') ?? '-180,-90,180,90').split(',').map(Number);
  const validator = createHash('sha256').update(JSON.stringify([version, zoom, bounds, offset, limit])).digest('hex');
  if (p.get('known_version') === validator) return { version, validator, not_modified: true };
  const west = bounds[0], east = bounds[2] < west ? bounds[2] + 360 : bounds[2];
  const visible = clusterLevel(tree, zoom).filter(f => {
    const shift = 360 * Math.round(((west + east) - (f.bounds[0] + f.bounds[2])) / 720);
    return f.bounds[2] + shift >= west && f.bounds[0] + shift <= east && f.bounds[3] >= bounds[1] && f.bounds[1] <= bounds[3];
  });
  const years = new Map(); for (const i of items) if (i.start_year != null) years.set(i.start_year, (years.get(i.start_year) ?? 0) + 1);
  return { version, validator, shared: true, total: tree.items.length, zoom, features: visible.slice(offset, offset + limit),
    next_offset: offset + limit < visible.length ? offset + limit : null,
    timeline: [...years].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count })) };
}
