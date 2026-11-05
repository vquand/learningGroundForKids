import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CookingPage } from '../../src/features/cooking/CookingPage';
import { CookingMenuPage } from '../../src/features/cooking/CookingMenuPage';
import { ActivityHubPage } from '../../src/pages/ActivityHubPage';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher/LanguageSwitcher';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useProfileStore } from '../../src/stores/profileStore';
import '../../src/app.css';

useFamilyStore.setState({ familyId: 'family-a', sessionGeneration: 1, isInitializing: false });
useProfileStore.setState({ activeProfileId: 'profile-a' });
const query = new URLSearchParams(location.search);
const route = query.has('hub') ? '/playground' : query.has('menu') ? '/uat/cooking' : '/uat/cooking/grilled-steak';
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[route]}>
      <LanguageSwitcher />
      <Routes>
        <Route path="/uat/cooking/:mealId" element={<CookingPage />} />
        <Route path="/uat/cooking" element={<CookingMenuPage />} />
        <Route path="/playground" element={<ActivityHubPage />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>,
);
