import { CookingPage } from '../../src/features/cooking/CookingPage';
import { CookingMenuPage } from '../../src/features/cooking/CookingMenuPage';
import { BurgerPage } from '../../src/features/cooking/burger/BurgerPage';
import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProfilePickerPage } from '../../src/pages/ProfilePickerPage';
import { ActivityHubPage } from '../../src/pages/ActivityHubPage';
import { MapPage } from '../../src/pages/MapPage';
import { ParentRoutes } from '../../src/features/parent/ParentRoutes';
import { ParentGate } from '../../src/components/ParentGate';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher/LanguageSwitcher';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useProfileStore } from '../../src/stores/profileStore';
import { bootstrapUiLanguage } from './ui-language-bootstrap';
import '../../src/app.css';
await bootstrapUiLanguage();
const cache = new QueryClient({ defaultOptions:{queries:{retry:false}} });
await useFamilyStore.getState().initSession();
useProfileStore.setState({activeProfileId:'kid-a'});
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={cache}><BrowserRouter><LanguageSwitcher /><Suspense fallback={<p>Loading…</p>}><Routes>
  <Route path="/" element={<ProfilePickerPage />} />
  <Route path="/playground" element={<ActivityHubPage />} />
  <Route path="/cooking" element={<CookingMenuPage />} />
  <Route path="/kitchen" element={<CookingMenuPage />} />
  <Route path="/cooking/burger" element={<BurgerPage />} />
  <Route path="/cooking/:mealId" element={<CookingPage />} />
  <Route path="/map" element={<MapPage />} />
  <Route path="/parent/*" element={<ParentGate><ParentRoutes /></ParentGate>} />
</Routes></Suspense></BrowserRouter></QueryClientProvider></StrictMode>);
