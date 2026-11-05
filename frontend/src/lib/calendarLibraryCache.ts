import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { CalendarWindow } from '../types/calendar';

/** Cancel the exact family/profile read before publishing a server-committed favorite. */
export async function commitCalendarLibraryUpdate(client: QueryClient, key: QueryKey, update: (current: CalendarWindow) => CalendarWindow, isCurrent = () => true): Promise<void> {
  if (!isCurrent()) return;
  await client.cancelQueries({ queryKey: key, exact: true });
  if (isCurrent()) client.setQueryData<CalendarWindow>(key, current => current ? update(current) : current);
}

/** React Query refetch normally resolves on failure, often with retained stale data. */
export async function refreshCalendarLibrary(client: QueryClient, key: QueryKey, refresh: () => Promise<unknown>): Promise<void> {
  const result = await refresh();
  if (result && typeof result === 'object' && 'isError' in result && result.isError) {
    throw 'error' in result ? result.error : new Error('Calendar refresh failed');
  }
  const state = client.getQueryState(key);
  if (state?.status === 'error') throw state.error;
}
