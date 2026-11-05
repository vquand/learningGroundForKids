import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { InfinidrillPage } from '../../src/features/infinidrill/InfinidrillPage';
import { ActivityHubPage } from '../../src/pages/ActivityHubPage';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useProfileStore } from '../../src/stores/profileStore';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher/LanguageSwitcher';
import '../../src/app.css';

useFamilyStore.setState({ familyId: 'family-a', sessionGeneration: 1, isInitializing: false });
useProfileStore.setState({ activeProfileId: 'profile-a' });
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/infinidrill']}>
      <LanguageSwitcher />
      <Routes>
        <Route path="/infinidrill" element={<InfinidrillPage />} />
        <Route path="/playground" element={<ActivityHubPage />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>,
);
