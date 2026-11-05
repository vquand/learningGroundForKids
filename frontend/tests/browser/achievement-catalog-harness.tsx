import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AdminAchievementsPage } from '../../src/pages/admin/AdminAchievementsPage';
import { AdminNavigation } from '../../src/components/admin/AdminNavigation';
import { InfinidrillAchievements } from '../../src/features/infinidrill/InfinidrillAchievements';
import { useFamilyStore } from '../../src/stores/familyStore';
import '../../src/app.css';
useFamilyStore.setState({ familyId: 'family-a', sessionGeneration: 1, isInitializing: false });
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>
  {location.hash === '#badges' ? <main className="p-4"><InfinidrillAchievements profileId="profile-a" /></main> : <><AdminNavigation /><AdminAchievementsPage /></>}
</MemoryRouter></QueryClientProvider>);
