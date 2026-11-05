import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BadgeDisplayPage } from '../../src/pages/BadgeDisplayPage';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher/LanguageSwitcher';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useProfileStore } from '../../src/stores/profileStore';
import '../../src/app.css';

document.documentElement.lang = 'en';
try { localStorage.removeItem('plg-ui-language'); } catch { /* Browser storage is optional. */ }
useFamilyStore.setState({ familyId: 'family-a', sessionGeneration: 1, isInitializing: false });
useProfileStore.setState({ activeProfileId: 'profile-a' });

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={['/profile/profile-a/badges']}>
      <LanguageSwitcher />
      <Routes>
        <Route path="/profile/:profileId/badges" element={<BadgeDisplayPage />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>,
);
