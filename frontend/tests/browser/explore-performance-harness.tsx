// Production-built route harness: real pages/providers, deterministic API at HTTP boundary.
import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import L from 'leaflet';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher/LanguageSwitcher';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useProfileStore } from '../../src/stores/profileStore';
import { useFilterStore } from '../../src/stores/filterStore';
import '../../src/app.css';

const MapPage = lazy(() => import('../../src/pages/MapPage').then(m => ({ default: m.MapPage })));
const ItemDetailPage = lazy(() => import('../../src/pages/ItemDetailPage').then(m => ({ default: m.ItemDetailPage })));
useFamilyStore.setState({ familyId: 'family-a', sessionGeneration: 1, isInitializing: false });
useProfileStore.setState({ activeProfileId: 'kid-a' });
L.Map.addInitHook(function (this: L.Map) { Object.assign(window, { exploreMap: this }); });
Object.assign(window, { exploreTest: { filters: useFilterStore, profiles: useProfileStore, family: useFamilyStore, L } });
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <BrowserRouter><LanguageSwitcher /><Suspense fallback={<p>Loading route…</p>}><Routes>
      <Route path="/map" element={<MapPage />} />
      <Route path="/items/:id" element={<ItemDetailPage />} />
    </Routes></Suspense></BrowserRouter>
  </QueryClientProvider>,
);
