import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MinigameBadgesButton } from '../../src/features/achievements/MinigameBadgesButton';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useProfileStore } from '../../src/stores/profileStore';
import { setUiLanguage } from '../../src/lib/uiLanguage';
import { loadUiLanguage } from '../../src/i18n/uiText';
import { ACHIEVEMENT_GROUPS } from '../../../server/src/achievement-catalog';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CookingPage } from '../../src/features/cooking/CookingPage';
import { BurgerPage } from '../../src/features/cooking/burger/BurgerPage';
import { CabbageRollPage } from '../../src/features/cooking/cabbage-rolls/CabbageRollPage';
import { FoodAndDrinkPage } from '../../src/features/food-and-drink/FoodAndDrinkPage';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher/LanguageSwitcher';
import '../../src/app.css';
// Optional isolated preview data. Never used by application routes.
if (new URLSearchParams(location.search).has('fixture')) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => String(input).endsWith('/achievement-groups')
    ? Promise.resolve(Response.json(ACHIEVEMENT_GROUPS.map(group => ({ ...group, achievements: group.achievements.map((badge, index) => ({ ...badge, earned: group.earning === 'server-verified' && index === 0, earned_at: index === 0 ? '2026-10-19T00:00:00Z' : null })) }))))
    : originalFetch(input, init);
}
useFamilyStore.setState({ familyId: 'family-a', sessionGeneration: 1, isInitializing: false });
useProfileStore.setState({ activeProfileId: 'profile-a' });
const game = new URLSearchParams(location.search).get('game');
const preview = game === 'burger' ? <BurgerPage /> : game === 'cabbage-rolls' ? <CabbageRollPage /> : game === 'food-and-drink' ? <FoodAndDrinkPage /> : game === 'cooking' || game === 'grill' ? <CookingPage /> : null;
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  {preview ? <MemoryRouter initialEntries={[game === 'food-and-drink' ? '/uat/food-and-drink' : `/uat/cooking/${game === 'grill' ? 'grilled-steak' : game}`]}><LanguageSwitcher /><Routes><Route path="/uat/cooking/:mealId" element={preview} /><Route path="/uat/food-and-drink" element={preview} /></Routes></MemoryRouter> : <MemoryRouter><LanguageSwitcher />
  <header className="kid-nav"><MinigameBadgesButton groupIds={[new URLSearchParams(location.search).get('group') ?? 'shoo-shoo-ufo']} /></header>
  <button onClick={() => void loadUiLanguage('vi').then(() => setUiLanguage('vi'))}>Vietnamese</button>
  </MemoryRouter>}
</QueryClientProvider>);
