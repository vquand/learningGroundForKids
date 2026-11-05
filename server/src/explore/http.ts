import { z } from 'zod';
import { AppError } from '../errors.js';
import { normalizeMapFilters } from './maps.js';
import type { ClusterBounds } from './clusters.js';

const version = z.string().regex(/^[a-f0-9]{64}$/);
const decimal = /^-?\d+(?:\.\d+)?$/;
function number(params: URLSearchParams, key: string, fallback: number) {
  const raw = params.get(key);
  if (raw === null) return fallback;
  if (raw.length > 32 || !decimal.test(raw)) throw new AppError(400, 'INVALID_MAP_QUERY', 'Map parameters are invalid.');
  return Number(raw);
}
function check(params: URLSearchParams, allowed: string[]) {
  for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1) throw new AppError(400, 'INVALID_MAP_QUERY', 'Map parameters are invalid.');
}
function filters(params: URLSearchParams) {
  const raw = params.get('categories') ?? '';
  if (raw.length > 256) throw new AppError(400, 'INVALID_MAP_FILTER', 'Map filters are invalid.');
  return normalizeMapFilters({ categories: raw.split(',').map(c => c.trim().toLowerCase()).filter(Boolean),
    year: params.has('year') ? number(params, 'year', 0) : null,
    progress: z.enum(['all', 'todo', 'done']).parse(params.get('progress') ?? 'all') });
}
const page = (n: number, max: number) => z.number().int().min(0).max(max).parse(n);
export function parseMapViewQuery(params: URLSearchParams) {
  check(params, ['profile_id', 'categories', 'year', 'progress', 'zoom', 'bounds', 'offset', 'limit', 'known_version']);
  const zoom = z.number().min(2).max(18).parse(number(params, 'zoom', 2));
  const raw = params.get('bounds') ?? '-180,-90,180,90';
  if (raw.length > 160 || raw.split(',').some(n => !decimal.test(n))) throw new AppError(400, 'INVALID_MAP_BOUNDS', 'Map bounds are invalid.');
  const bounds = z.tuple([z.number().min(-540).max(540), z.number().min(-90).max(90), z.number().min(-540).max(540), z.number().min(-90).max(90)])
    .refine(b => b[1] <= b[3] && Math.abs(b[2] - b[0]) <= 360).parse(raw.split(',').map(Number)) as ClusterBounds;
  if (Math.abs(bounds[2] - bounds[0]) === 360) { bounds[0] = -180; bounds[2] = 180; }
  const knownVersion = params.has('known_version') ? version.parse(params.get('known_version')) : undefined;
  const limit = page(number(params, 'limit', 200), 500);
  if (!limit) throw new AppError(400, 'INVALID_MAP_QUERY', 'Map page size is invalid.');
  return { ...filters(params), zoom, bounds, offset: page(number(params, 'offset', 0), 5000), limit, ...(knownVersion ? { knownVersion } : {}) };
}
export function parseMapLeavesQuery(params: URLSearchParams, node: string) {
  check(params, ['profile_id', 'categories', 'year', 'progress', 'version', 'offset', 'limit']);
  if (!/^\d{1,4}$/.test(node)) throw new AppError(400, 'INVALID_MAP_QUERY', 'Map cluster is invalid.');
  const limit = page(number(params, 'limit', 200), 500);
  if (!limit) throw new AppError(400, 'INVALID_MAP_QUERY', 'Map page size is invalid.');
  return { ...filters(params), version: version.parse(params.get('version')), node: Number(node),
    offset: page(number(params, 'offset', 0), 5000), limit };
}
export function assertMapResponseSize(value: unknown) {
  if (Buffer.byteLength(JSON.stringify(value)) > 2 * 1024 * 1024) throw new AppError(503, 'EXPLORE_CACHE_TOO_LARGE', 'Prepared map page exceeds its size limit.');
}
