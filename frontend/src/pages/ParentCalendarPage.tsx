import { CalendarPeopleSettingsDialog } from '../components/Calendar/CalendarPeopleSettingsDialog';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchParentCalendar } from '../api/calendarParent';
import { CalendarViewTabs, type CalendarView } from '../components/Calendar/CalendarViewTabs';
import { CalendarWeekToggle } from '../components/Calendar/CalendarWeekToggle';
import { CALENDAR_COPY } from '../components/Calendar/calendarCopy';
import { EventsView } from '../components/Calendar/EventsView';
import { MealsView } from '../components/Calendar/MealsView';
import { StudyGrid } from '../components/Calendar/StudyGrid';
import '../components/Calendar/Calendar.css';
import { ParentReportStatus } from '../features/parent/ParentReportViews';
import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiText } from '../i18n/uiText';
import { nextVietnamMidnightDelay } from '../lib/calendarHelpers';
import { familyQueryKey, familyScopedQuery } from '../lib/familyQueries';
import { useFamilyStore } from '../stores/familyStore';
import type { CalendarWindow } from '../types/calendar';
import './ParentCalendarPage.css';

export const PARENT_MEDICINE_NOTE = 'Medicine reminders are set by your child and are not medical advice.';

const noopEdit = () => undefined;
const noopChanged = async () => undefined;

/** Parent-side read model. Query keys start with `parent-`, so lock clears them with the other parent data. */
export function useParentCalendar(profileId: string) {
  const familyId = useFamilyStore((state) => state.familyId);
  const query = useQuery({
    queryKey: familyQueryKey('parent-calendar', familyId, profileId),
    queryFn: familyScopedQuery(familyId, () => fetchParentCalendar(profileId)),
    enabled: Boolean(familyId),
    retry: false,
    refetchOnMount: 'always',
  });
  const today = query.data?.today;
  useEffect(() => {
    if (!today || !familyId || typeof window === 'undefined') return undefined;
    const timer = window.setTimeout(() => { void query.refetch(); }, nextVietnamMidnightDelay(today));
    return () => window.clearTimeout(timer);
  }, [familyId, query.refetch, today]);
  return query;
}

export interface ParentCalendarViewProps {
  profileId: string;
  childName: string;
  data: CalendarWindow;
  weekIndex: number;
  view: CalendarView;
  onWeekChange: (index: number) => void;
  onViewChange: (view: CalendarView) => void;
}

/** Read-only presentation: every view is rendered without edit controls, so no edit affordance exists in the DOM. */
export function ParentCalendarView({ profileId, childName, data, weekIndex, view, onWeekChange, onViewChange }: ParentCalendarViewProps) {
  useUiLanguage();
  const [peopleSettings,setPeopleSettings] = useState(false);
  const cellRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const weeks = data.weeks;
  const week = weeks[weekIndex] ?? weeks[0];
  return (
    <div className="parent-calendar">
      <div className="parent-calendar-top">
        <Link className="parent-back" to={`/parent/children/${encodeURIComponent(profileId)}`}>← {uiText('Back to child report')}</Link>
        <h1>{childName}</h1>
        <span className="parent-calendar-badge">{uiText('View only')}</span>
      </div>
      <div className="parent-calendar-controls">
        <button type="button" className="calendar-library-button" data-calendar-family-settings="true" onClick={() => setPeopleSettings(true)}>{uiText('Family members in events')}</button>
        <CalendarWeekToggle weeks={weeks} active={weekIndex} onChange={onWeekChange} />
        <CalendarViewTabs active={view} onChange={onViewChange} />
      </div>
      {view === 'meals' && <p className="parent-calendar-note">{uiText(PARENT_MEDICINE_NOTE)}</p>}
      {peopleSettings && <CalendarPeopleSettingsDialog onClose={() => setPeopleSettings(false)} />}
      <div className="parent-calendar-body">
        {!week && <div className="calendar-status" role="status"><h2>{uiText(CALENDAR_COPY.emptyTitle)}</h2></div>}
        {week && view === 'study' && <StudyGrid week={week} today={data.today} onEdit={noopEdit} cellRefs={cellRefs} readOnly />}
        {week && view === 'meals' && <MealsView profileId={profileId} week={week} data={data} today={data.today} onChanged={noopChanged} readOnly />}
        {week && view === 'events' && <EventsView profileId={profileId} week={week} data={data} today={data.today} onChanged={noopChanged} readOnly />}
      </div>
    </div>
  );
}

function ParentCalendarLoader({ profileId, childName }: { profileId: string; childName: string }) {
  const query = useParentCalendar(profileId);
  const [weekIndex, setWeekIndex] = useState(0);
  const [view, setView] = useState<CalendarView>('study');
  if (query.isPending) return <div className="parent-panel parent-loading" role="status">{uiText(CALENDAR_COPY.loading)}</div>;
  if (query.isError || !query.data) {
    return <div className="parent-panel parent-empty" role="alert"><h2>{uiText('Could not load this calendar. Please try again.')}</h2><button className="parent-button" type="button" onClick={() => void query.refetch()}>{uiText(CALENDAR_COPY.retry)}</button></div>;
  }
  return <ParentCalendarView profileId={profileId} childName={childName} data={query.data} weekIndex={weekIndex} view={view} onWeekChange={setWeekIndex} onViewChange={setView} />;
}

export function ParentCalendarPage() {
  useUiLanguage();
  const { profileId } = useParams();
  return <ParentReportStatus>{report => {
    const child = report.children.find(item => item.id === profileId);
    if (!child) return <div className="parent-panel parent-empty"><h1>{uiText('Child profile not found')}</h1><Link to="/parent/children">{uiText('Back to children')}</Link></div>;
    return <ParentCalendarLoader key={child.id} profileId={child.id} childName={child.name} />;
  }}</ParentReportStatus>;
}
