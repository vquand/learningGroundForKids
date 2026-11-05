// Synthetic session only; browser tests serve the calendar API on an isolated port.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCalendar } from '../../src/api/calendar';
import { ParentCalendarView } from '../../src/pages/ParentCalendarPage';
import type { CalendarView } from '../../src/components/Calendar/CalendarViewTabs';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { CalendarPage } from '../../src/pages/CalendarPage';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher/LanguageSwitcher';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useProfileStore } from '../../src/stores/profileStore';
import { bootstrapUiLanguage } from '../browser/ui-language-bootstrap';
import '../../src/app.css';

useFamilyStore.setState({ familyId: 'fixture-family', sessionGeneration: 1, isInitializing: false });
useProfileStore.setState({ activeProfileId: 'fixture-child' });
await bootstrapUiLanguage();
function ParentFixture() {
  const query = useQuery({ queryKey: ['calendar', 'fixture'], queryFn: () => fetchCalendar('fixture-child') });
  const [week, setWeek] = useState(0); const [view, setView] = useState<CalendarView>('events');
  return query.data ? <ParentCalendarView profileId="fixture-child" childName="Fixture child" data={query.data} view={view} weekIndex={week} onWeekChange={setWeek} onViewChange={setView} /> : null;
}
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <BrowserRouter><LanguageSwitcher />{new URLSearchParams(location.search).has('parent') ? <ParentFixture /> : <CalendarPage />}</BrowserRouter>
  </QueryClientProvider>,
);
