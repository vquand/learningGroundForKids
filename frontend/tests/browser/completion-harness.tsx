import { lazy, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { ItemDetailPage } from '../../src/pages/ItemDetailPage';
import { CATEGORY_REGISTRY } from '../../src/components/ItemDetail/CategoryRegistry';
import { useDoneTracking } from '../../src/components/DoneTracking/useDoneTracking';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useProfileStore } from '../../src/stores/profileStore';

// Real React, routing, queries, and DOM observers; only category loading and API
// responses are controlled by the tests.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
useFamilyStore.setState({ familyId: 'family-a', sessionGeneration: 1, isInitializing: false });
useProfileStore.setState({ activeProfileId: 'profile-a' });
let releaseCategory: () => void;
const categoryReady = new Promise<void>((resolve) => { releaseCategory = resolve; });
CATEGORY_REGISTRY.animal.component = lazy(async () => {
  await categoryReady;
  return { default: ({ onMediaInteract }: { onMediaInteract?: () => void }) => (
    <section data-checkpoint="description" style={{ height: 100 }}>
      Loaded category <button onClick={onMediaInteract}>Play media</button>
    </section>
  ) };
});

function HookHarness() {
  const ref = useRef<HTMLDivElement>(null);
  const [hasMedia, setHasMedia] = useState(false);
  const tracking = useDoneTracking('item-a', hasMedia, ref);
  return <div ref={ref}>
    <section data-checkpoint="one" style={{ height: 100 }}>First checkpoint</section>
    <button onClick={() => setHasMedia(true)}>Load media</button>
    <button onClick={tracking.markMediaInteracted}>Play media</button>
    <button onClick={tracking.retryCompletion}>Retry completion</button>
    <output>{JSON.stringify(tracking)}</output>
  </div>;
}

function Navigation() {
  const navigate = useNavigate();
  return <nav>
    <button onClick={() => navigate('/items/item-b')}>Next item</button>
    <button onClick={() => useProfileStore.setState({ activeProfileId: 'profile-b' })}>Next profile</button>
    <button onClick={() => useFamilyStore.setState({ familyId: 'family-b', sessionGeneration: 2 })}>Next family</button>
    <button onClick={() => useFamilyStore.setState({ sessionGeneration: 2 })}>New session</button>
    <button onClick={() => root.unmount()}>Unmount</button>
  </nav>;
}

const root = createRoot(document.getElementById('root')!);
root.render(<QueryClientProvider client={queryClient}>
  <MemoryRouter initialEntries={['/items/item-a']}>
    <Navigation />
    {new URLSearchParams(location.search).has('hook') ? <HookHarness /> :
      <Routes><Route path="/items/:id" element={<ItemDetailPage />} /></Routes>}
  </MemoryRouter>
</QueryClientProvider>);

Object.assign(window, {
  completionTest: {
    releaseCategory: () => releaseCategory(),
    addCheckpoint: () => {
      const el = document.createElement('section');
      el.dataset.checkpoint = 'later';
      el.textContent = 'Later checkpoint';
      el.style.height = '100px';
      document.querySelector('[data-checkpoint]')!.parentElement!.append(el);
    },
    makeCheckpointTall: () => { (document.querySelector('[data-checkpoint]') as HTMLElement).style.height = '3000px'; },
    cache: () => queryClient.getQueryCache().getAll().map((query) => ({
      key: query.queryKey, invalidated: query.state.isInvalidated,
    })),
    seedCaches: () => {
      for (const key of [
        ['badges', 'family-a', 'profile-a'], ['achievements', 'family-a', 'profile-a'],
        ['profiles', 'family-a'], ['badges', 'family-b', 'profile-b'],
      ]) queryClient.setQueryData(key, []);
    },
  },
});
