import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { commitCalendarLibraryUpdate, refreshCalendarLibrary } from '../src/lib/calendarLibraryCache.ts';
import type { CalendarWindow } from '../src/types/calendar.ts';

for (const field of ['meal_library', 'study_library'] as const) test(`${field}: a late refetch cannot overwrite a committed save or removal or cancel another family`, async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = ['calendar', 'family', 'child'], other = ['calendar', 'other-family', 'child'];
  const initial = { [field]: [{ id: 'old' }] } as unknown as CalendarWindow;
  client.setQueryData(key, initial);
  let resolveOld!: (data: CalendarWindow) => void, resolveOther!: (data: CalendarWindow) => void;
  const stale = client.fetchQuery({ queryKey: key, queryFn: () => new Promise<CalendarWindow>(resolve => { resolveOld = resolve; }) }).catch(() => undefined);
  const independent = client.fetchQuery({ queryKey: other, queryFn: () => new Promise<CalendarWindow>(resolve => { resolveOther = resolve; }) });
  const saved = { [field]: [{ id: 'saved' }] } as unknown as CalendarWindow;
  await commitCalendarLibraryUpdate(client, key, () => saved);
  resolveOld(initial); await stale;
  assert.deepEqual(client.getQueryData(key), saved);
  assert.equal(client.getQueryState(other)?.fetchStatus, 'fetching');
  let resolveBeforeRemove!: (data: CalendarWindow) => void;
  const beforeRemove = client.fetchQuery({ queryKey: key, queryFn: () => new Promise<CalendarWindow>(resolve => { resolveBeforeRemove = resolve; }) }).catch(() => undefined);
  await commitCalendarLibraryUpdate(client, key, current => ({ ...current, [field]: [] }));
  resolveBeforeRemove(saved); await beforeRemove;
  assert.deepEqual((client.getQueryData(key) as CalendarWindow)[field], []);
  resolveOther(initial); await independent; client.clear();
});

test('refresh treats a resolved refetch error result and cached error as failure, and retry can recover', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = ['calendar', 'family', 'child'];
  client.setQueryData(key, { meal_library: [] });
  const error = new Error('offline');
  await assert.rejects(refreshCalendarLibrary(client, key, async () => ({ isError: true, error })), /offline/);
  await assert.rejects(refreshCalendarLibrary(client, key, async () => {
    await client.fetchQuery({ queryKey: key, queryFn: async () => { throw error; } }).catch(() => undefined);
    return client.getQueryData(key);
  }), /offline/);
  await refreshCalendarLibrary(client, key, () => client.fetchQuery({ queryKey: key, queryFn: async () => ({ meal_library: [] }) }));
  client.clear();
});

test('a committed result cannot restore private data after the family session changes', async () => {
  const client = new QueryClient();
  const key = ['calendar', 'family', 'child'];
  const current = { meal_library: [] };
  client.setQueryData(key, current);
  await commitCalendarLibraryUpdate(client, key, () => ({ meal_library: [{ id: 'old-session' }] }) as unknown as CalendarWindow, () => false);
  assert.deepEqual(client.getQueryData(key), current);
  client.clear();
});
