import type { QueryClient, QueryKey } from '@tanstack/react-query';
// UI invalidation only. Server-side parent access remains the authorization boundary.
let accessGeneration = 0;
export const getParentAccessGeneration = () => accessGeneration;
export function isParentQueryKey(key: QueryKey): boolean {
  return typeof key[0] === 'string' && (key[0].startsWith('parent-') || ['miniku-puzzles', 'miniku-settings'].includes(key[0]));
}
export async function clearParentQueryCache(client: Pick<QueryClient, 'cancelQueries' | 'removeQueries'>) {
  accessGeneration++;
  const filters = { predicate: (query: { queryKey: QueryKey }) => isParentQueryKey(query.queryKey) };
  await client.cancelQueries(filters);
  client.removeQueries(filters);
}
