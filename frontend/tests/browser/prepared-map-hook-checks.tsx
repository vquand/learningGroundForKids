import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { usePreparedMapView } from '../../src/hooks/usePreparedMapView';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useFilterStore } from '../../src/stores/filterStore';
import type { ExploreViewRequest } from '../../src/types/explore';

function check(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}
async function until(predicate: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Hook check timed out');
}

/** Run via the isolated fixture's ?hooks query; no live API or database. */
export async function checkPreparedMapHook() {
  const realFetch = window.fetch;
  const container = document.createElement('div');
  const root = createRoot(container);
  const pending: ((response: Response) => void)[] = [];
  let state!: ReturnType<typeof usePreparedMapView>;
  const initial: ExploreViewRequest = { categories: [], year: null, progress: 'todo', zoom: 2, bounds: [-180, -85, 180, 85] };
  const response = { version: 'a'.repeat(64), validator: 'b'.repeat(64), shared: false, total: 2, zoom: 2,
    features: [{ id: 1, count: 2, latitude: 0, longitude: 0, bounds: [0, 0, 1, 1], expansionZoom: 3, item: null }], timeline: [], next_offset: null };
  function Probe({ request }: { request: ExploreViewRequest }) {
    state = usePreparedMapView(request, 'hook-child');
    return null;
  }
  const render = (request: ExploreViewRequest) => flushSync(() => root.render(<Probe request={request}/>));
  const deliver = (body: unknown, status = 200) => pending.shift()!(Response.json(body, { status }));
  try {
    window.fetch = async () => new Promise(resolve => pending.push(resolve));
    useFamilyStore.setState({ familyId: 'hook-family', sessionGeneration: 7 });
    render(initial);
    await until(() => pending.length === 1);
    deliver(response);
    await until(() => !state.busy);
    check(state.view?.features[0]?.id === 1, 'initial view loads');
    render({ ...initial, zoom: 3 });
    check(state.view?.features[0]?.id === 1 && state.busy, 'camera change keeps previous markers');
    await until(() => pending.length === 1);
    deliver({ ...response, zoom: 3, features: [{ ...response.features[0], id: 2 }] });
    await until(() => !state.busy);
    render(initial);
    check(state.view?.features[0]?.id === 1, 'zoom-back instantly uses cached markers');
    await until(() => pending.length === 1);
    render({ ...initial, progress: 'done' });
    check(state.view === null, 'meaning change immediately clears old markers');
    deliver(response); // Late response from the cancelled camera request.
    await until(() => pending.length === 1);
    deliver({ ...response, features: [] });
    await until(() => !state.busy);
    check(state.view?.features.length === 0, 'cancelled response never replaces the current view');
    useFilterStore.getState().setActiveYear(1500);
    flushSync(() => state.reload());
    await until(() => pending.length === 1);
    deliver({ error: { code: 'INVALID_MAP_YEAR', message: 'Invalid year' } }, 400);
    await until(() => state.error);
    check(useFilterStore.getState().activeYear === null, 'invalid year clears the era');
    flushSync(() => state.reload());
    await until(() => pending.length === 1);
    deliver({ error: { code: 'UNAUTHORIZED', message: 'Sign in' } }, 401);
    await until(() => useFamilyStore.getState().familyId === null);
    return 'passed';
  } finally {
    flushSync(() => root.unmount());
    window.fetch = realFetch;
  }
}
