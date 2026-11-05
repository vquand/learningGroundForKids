// Synthetic server responses for verifying the real map and Playground pages.
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ActivityHubPage } from '../../src/pages/ActivityHubPage';
import { MapPage } from '../../src/pages/MapPage';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher/LanguageSwitcher';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useProfileStore } from '../../src/stores/profileStore';
import { profileQueryKey } from '../../src/lib/familyQueries';
import { setUiLanguage } from '../../src/lib/uiLanguage';
import '../../src/app.css';

useFamilyStore.setState({ familyId: 'fixture-family', sessionGeneration: 1, isInitializing: false });
useProfileStore.setState({ activeProfileId: 'kid-a' });
setUiLanguage('en');
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const profiles = [
  { id: 'kid-a', name: 'Ada', emoji: '🐻', color: '#457b9d', created_at: '2026-10-23', total_done: 12, badge_count: 0 },
  { id: 'kid-b', name: 'Ben', emoji: '🐸', color: '#457b9d', created_at: '2026-10-23', total_done: 0, badge_count: 0 },
];
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url, location.href);
  if (!url.pathname.startsWith('/api/v1/')) return originalFetch(input, init);
  let body: unknown;
  if (url.pathname === '/api/v1/profiles') body = profiles;
  else if (url.pathname.endsWith('/town/name')) body = { townName: { adjective: 'Sunny', noun: 'Meadow' } };
  else if (url.pathname.includes('/items/map/')) body = { version: 'a'.repeat(64), validator: 'b'.repeat(64), shared: true, total: 0, zoom: 2, features: [], next_offset: null, timeline: [] };
  else if (url.pathname.endsWith('/progress')) body = { done_item_ids: [], wip_item_ids: [] };
  else if (url.pathname.endsWith('/status')) body = { attempted_today: false, passed: false };
  else body = [];
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
};

function Controls() {
  return <div style={{ position: 'fixed', right: 8, bottom: 100, zIndex: 3000, display: 'flex', gap: 8 }}>
    <button onClick={() => useProfileStore.setState({ activeProfileId: 'kid-a' })}>Fixture: Ada</button>
    <button onClick={() => useProfileStore.setState({ activeProfileId: 'kid-b' })}>Fixture: Ben</button>
    <button onClick={() => {
      const selected = profiles.find(p => p.id === useProfileStore.getState().activeProfileId)!;
      selected.total_done += 1;
      void client.invalidateQueries({ queryKey: profileQueryKey('fixture-family') });
    }}>Fixture: server completion</button>
  </div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><BrowserRouter>
  <LanguageSwitcher /><Controls /><Routes><Route path="/map" element={<MapPage />} /><Route path="*" element={<ActivityHubPage />} /></Routes>
</BrowserRouter></QueryClientProvider>);
