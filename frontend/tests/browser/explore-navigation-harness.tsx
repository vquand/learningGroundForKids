import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import L from 'leaflet';
import { MapPage } from '../../src/pages/MapPage';
import { ItemDetailPage } from '../../src/pages/ItemDetailPage';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher/LanguageSwitcher';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useProfileStore } from '../../src/stores/profileStore';
import '../../src/app.css';

useFamilyStore.setState({ familyId: 'family-a', sessionGeneration: 1, isInitializing: false });
useProfileStore.setState({ activeProfileId: 'kid-a' });
L.Map.addInitHook(function (this: L.Map) { Object.assign(window, { exploreMap: this }); });
const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
Object.assign(window, { exploreNavigation: {
  setDone: (done: boolean) => cache.setQueryData(['progress', 'family-a', 'kid-a', 'polar-vortex'], done),
  switchChild: () => useProfileStore.setState({ activeProfileId: 'kid-b' }),
} });
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={cache}><BrowserRouter>
  <LanguageSwitcher />
  <Routes><Route path="/map" element={<MapPage />} /><Route path="/items/:id" element={<ItemDetailPage />} /></Routes>
</BrowserRouter></QueryClientProvider>);
