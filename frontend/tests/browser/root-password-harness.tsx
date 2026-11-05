import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { RootPasswordControl } from '../../src/components/admin/RootPasswordControl';
import { AdminGate } from '../../src/components/admin/AdminGate';
import { FamilyLoginPage } from '../../src/pages/FamilyLoginPage';
import { useFamilyStore } from '../../src/stores/familyStore';
import '../../src/app.css';

function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const familyId = useFamilyStore((state) => state.familyId);
  return <nav>
    <button onClick={() => navigate('/parent')}>Parent route</button>
    <button onClick={() => navigate('/admin')}>Admin route</button>
    <button onClick={() => navigate('/family-login')}>Family login route</button>
    <output aria-label="Current route">{location.pathname}</output>
    <output aria-label="Current family">{familyId ?? 'signed-out'}</output>
  </nav>;
}

await useFamilyStore.getState().initSession();
const root = createRoot(document.getElementById('root')!);
root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>
  <Navigation />
  <RootPasswordControl />
  <Routes>
    <Route path="/" element={<h1>Family route</h1>} />
    <Route path="/parent" element={<h1>Parent route</h1>} />
    <Route path="/admin" element={<AdminGate><h1>Admin dashboard</h1></AdminGate>} />
    <Route path="/family-login" element={<FamilyLoginPage />} />
  </Routes>
</MemoryRouter></QueryClientProvider>);

Object.assign(window, { rootPasswordTest: {
  refreshSession: () => useFamilyStore.getState().initSession(),
  unmount: () => root.unmount(),
} });
