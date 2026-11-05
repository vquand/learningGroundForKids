import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MinikuPage } from '../../src/features/miniku/MinikuPage';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useProfileStore } from '../../src/stores/profileStore';
import '../../src/app.css';

const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
useFamilyStore.setState({ familyId: 'family-a', sessionGeneration: 1, isInitializing: false });
useProfileStore.setState({ activeProfileId: 'profile-a' });
Object.assign(window, { minikuTest: {
  changeOwner(mode: string) {
    cache.removeQueries();
    if (mode === 'logout') useFamilyStore.getState().clearSession();
    if (mode === 'relogin') useFamilyStore.setState({ sessionGeneration: 2 });
    if (mode === 'profile') useProfileStore.setState({ activeProfileId: 'profile-b' });
  },
  revisions: () => cache.getQueryCache().getAll().map(query => ({ key: query.queryKey, revision: (query.state.data as { revision?: number } | undefined)?.revision })),
} });
createRoot(document.getElementById('root')!).render(<StrictMode>
  <QueryClientProvider client={cache}><MemoryRouter initialEntries={['/miniku']}><Routes>
    <Route path="/miniku" element={<MinikuPage />} />
    <Route path="/playground" element={<main>Playground test destination</main>} />
  </Routes></MemoryRouter></QueryClientProvider>
</StrictMode>);
