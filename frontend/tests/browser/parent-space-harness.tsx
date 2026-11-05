import { clearParentQueryCache } from '../../src/lib/parentQueryCache';
import { Suspense, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { ParentRoutes } from '../../src/features/parent/ParentRoutes';
import { ParentGate } from '../../src/components/ParentGate';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher/LanguageSwitcher';
import { useFamilyStore } from '../../src/stores/familyStore';
import { bootstrapUiLanguage } from './ui-language-bootstrap';
import '../../src/app.css';

await bootstrapUiLanguage();
useFamilyStore.setState({ session: { user: { id: 'family-a', email: 'parent@test.local', name: 'The Willow family' } }, familyId: 'family-a', familyName: 'The Willow family', sessionGeneration: 1, isInitializing: false });
const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
Object.assign(window, { parentTest: { keys: () => cache.getQueryCache().getAll().map(query => query.queryKey) } });
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={cache}><BrowserRouter><LanguageSwitcher /><Suspense fallback={<p>Loading…</p>}><Routes>
  <Route path="/parent/*" element={<ParentGate onAccessLost={() => clearParentQueryCache(cache)}><ParentRoutes /></ParentGate>} />
  <Route path="*" element={<Link to="/parent">Parent Space</Link>} />
</Routes></Suspense></BrowserRouter></QueryClientProvider></StrictMode>);
