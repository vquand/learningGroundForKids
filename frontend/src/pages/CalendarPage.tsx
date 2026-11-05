import { CalendarShareButton } from '../components/Calendar/CalendarShareButton';
import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CalendarApiError, deleteCalendarOverride, renameCalendarItem, saveCalendarList } from '../api/calendar';
import { KidBackButton } from '../components/KidBackButton';
import { CalendarViewTabs, type CalendarView } from '../components/Calendar/CalendarViewTabs';
import { CalendarWeekToggle } from '../components/Calendar/CalendarWeekToggle';
import { CALENDAR_COPY } from '../components/Calendar/calendarCopy';
import { ListEditorDrawer } from '../components/Calendar/ListEditorDrawer';
import { StudyGrid } from '../components/Calendar/StudyGrid';
import { MealsView } from '../components/Calendar/MealsView';
import { EventsView } from '../components/Calendar/EventsView';
import '../components/Calendar/Calendar.css';
import { useCalendar } from '../hooks/useCalendar';
import { useCalendarWeather } from '../hooks/useCalendarWeather';
import { calendarNotificationsQueryKey } from '../hooks/useCalendarNotifications';
import { useFamilyStore } from '../stores/familyStore';
import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiText } from '../i18n/uiText';
import {
  buildCalendarListWriteFromRevisions, refreshListSnapshot, restoreRevisionOf, snapshotListRevisions, type CalendarListRevisions, viewSlideDirection, weekSlideDirection, type PaneSlide } from '../lib/calendarHelpers';
import type { CalendarDay, CalendarList, StudyArea, StudyItem } from '../types/calendar';
import { useProfileStore } from '../stores/profileStore';

interface EditorState {
  day: CalendarDay;
  area: StudyArea;
  list: CalendarList;
  key: string;
  /** Revisions captured when the editor opened. Saves and restores send these, never live query data. */
  revisions: CalendarListRevisions<StudyArea>;
}

export function CalendarPage() {
  useUiLanguage();
  const navigate = useNavigate();
  const profileId = useProfileStore((state) => state.activeProfileId);
  const calendar = useCalendar(profileId);
  const weather = useCalendarWeather(profileId);
  const queryClient = useQueryClient();
  const familyId = useFamilyStore((state) => state.familyId);
  // Events and meals change what the family Notifications panel shows, so refresh it with the calendar.
  const refreshAfterChange = useCallback(async () => {
    const result = await calendar.refetch();
    void queryClient.invalidateQueries({ queryKey: calendarNotificationsQueryKey(familyId) });
    return result.data;
  }, [calendar, familyId, queryClient]);
  const [weekIndex, setWeekIndex] = useState(0);
  const [slide, setSlide] = useState<PaneSlide>(null);
  const changeWeek = useCallback((next: number) => {
    setSlide(weekSlideDirection(weekIndex, next));
    setWeekIndex(next);
  }, [weekIndex]);
  const [view, setView] = useState<CalendarView>('study');
  const changeView = useCallback((next: CalendarView) => {
    setSlide(viewSlideDirection(view, next));
    setView(next);
  }, [view]);
  // Rail action slot (bottom of the rail): Events and Meals portal their own action button (Add event, My meals) into it.
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const cellRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const returnFocus = editor ? cellRefs.current[editor.key] ?? null : null;

  const closeEditor = useCallback(() => setEditor(null), []);

  const openEditor = useCallback((day: CalendarDay, area: StudyArea) => {
    const key = `${day.date}:${area}`;
    if (!calendar.data) return;
    setEditor({ day, area, list: day.lists[area] ?? { id: null, items: [], revision: 0, source: 'empty' }, key, revisions: snapshotListRevisions(calendar.data, day, area) });
  }, [calendar.data]);

  // After a displayed 409 the draft stays. The editor adopts the refreshed day and revisions, so the next Save is deliberate.
  const adoptRefreshedEditor = useCallback(async (): Promise<Error> => {
    const refreshed = await calendar.refetch();
    setEditor((current) => {
      if (!current) return current;
      const fresh = refreshListSnapshot(refreshed.data, current.day.date, current.area);
      return fresh ? { ...current, day: fresh.day, list: fresh.day.lists[current.area], revisions: fresh.revisions } : current;
    });
    return new Error(uiText(CALENDAR_COPY.saveConflict));
  }, [calendar]);

  const save = useCallback(async (draft: { items: StudyItem[]; scope: 'template' | 'date' }) => {
    if (!editor || !profileId) return;
    const input = buildCalendarListWriteFromRevisions(editor.revisions, draft.scope, draft.items);
    try {
      await saveCalendarList(profileId, input);
      await calendar.refetch();
    } catch (error) {
      if (error instanceof CalendarApiError && error.status === 409) throw await adoptRefreshedEditor();
      throw new Error(uiText(CALENDAR_COPY.saveError));
    }
  }, [adoptRefreshedEditor, calendar, editor, profileId]);

  const restore = useCallback(async () => {
    if (!editor || !profileId) return;
    const revision = restoreRevisionOf(editor.revisions);
    // The day had no override when the editor opened, so there is nothing to delete at that revision.
    if (revision === null) throw await adoptRefreshedEditor();
    try {
      await deleteCalendarOverride(profileId, editor.revisions.date, editor.revisions.area, revision);
      await calendar.refetch();
    } catch (error) {
      if (error instanceof CalendarApiError && error.status === 409) throw await adoptRefreshedEditor();
      throw new Error(uiText(CALENDAR_COPY.restoreError));
    }
  }, [adoptRefreshedEditor, calendar, editor, profileId]);

  const rename = async (index: number, name: string) => {
    if (!editor || !profileId) throw new Error(uiText(CALENDAR_COPY.saveError));
    try {
      const saved = await renameCalendarItem(profileId, { date: editor.day.date, area: editor.area, index, name, expected_revision: editor.list.revision, expected_template_revision: editor.revisions.templateRevision });
      const fresh = await refreshAfterChange();
      setEditor(current => {
        if (!current || current.key !== editor.key) return current;
        const next = refreshListSnapshot(fresh, current.day.date, current.area);
        return next ? { ...current, day: next.day, list: next.day.lists[current.area], revisions: next.revisions } : current;
      });
      return saved;
    } catch (error) {
      if (error instanceof CalendarApiError && error.status === 409) throw await adoptRefreshedEditor();
      throw error;
    }
  };

  const weeks = calendar.data?.weeks ?? [];
  const week = weeks[weekIndex] ?? weeks[0];

  return (
    <div className="calendar-page" data-view={view}>
      <header className="calendar-header">
        <div className="kid-nav calendar-nav">
          <div className="calendar-nav-actions"><KidBackButton onClick={() => navigate('/playground')} /><CalendarShareButton key={`${familyId}:${profileId}`} data={calendar.data} weather={weather.data} profileId={profileId} familyId={familyId} /></div>
          <h1>{uiText(CALENDAR_COPY.pageTitle)}</h1>
          {calendar.isError && calendar.data && <button type="button" className="kid-nav-action calendar-refresh-retry" title={uiText(CALENDAR_COPY.refreshError)} aria-label={uiText(CALENDAR_COPY.refreshError)} onClick={() => void calendar.refetch()}>{uiText(CALENDAR_COPY.retry)}</button>}
        </div>
      </header>
      <main className="calendar-main">
        {/* Left rail, full height: week group at the top, the three views centred, the view's adding action at the bottom. */}
        <div className="calendar-rail">
          <CalendarWeekToggle weeks={weeks} active={weekIndex} onChange={changeWeek} orientation="vertical" />
          <CalendarViewTabs active={view} onChange={changeView} orientation="vertical" />
          <div className="calendar-toolbar-action" ref={setToolbarSlot} />
        </div>
        <div className="calendar-stage">
          {calendar.isLoading && <div className="calendar-status" role="status"><p>{uiText(CALENDAR_COPY.loading)}</p></div>}
          {calendar.isError && !calendar.data && !calendar.isLoading && <div className="calendar-status" role="alert"><h2>{uiText(CALENDAR_COPY.loadError)}</h2><button type="button" className="calendar-save-button" onClick={() => void calendar.refetch()}>{uiText(CALENDAR_COPY.retry)}</button></div>}
          {calendar.data && week && (
            <div className="calendar-week-pane" key={`${view}:${weekIndex}`} data-slide={slide ?? undefined}>
              {view === 'meals' && profileId && <MealsView profileId={profileId} week={week} data={calendar.data} today={calendar.data.today} onChanged={refreshAfterChange} toolbarSlot={toolbarSlot} />}
              {view === 'events' && profileId && <EventsView profileId={profileId} week={week} data={calendar.data} today={calendar.data.today} onChanged={refreshAfterChange} toolbarSlot={toolbarSlot} />}
              {view === 'study' && <StudyGrid week={week} today={calendar.data.today} onEdit={(day, area) => openEditor(day, area)} cellRefs={cellRefs} weather={weather.data} weatherLoading={weather.isLoading} weatherError={weather.isError} />}
            </div>
          )}
          {calendar.data && !calendar.isError && calendar.data.weeks.length === 0 && <div className="calendar-status" role="status"><h2>{uiText(CALENDAR_COPY.emptyTitle)}</h2><p>{uiText(CALENDAR_COPY.emptyDescription)}</p></div>}
        </div>
      </main>
      {editor && calendar.data && profileId && <ListEditorDrawer key={editor.key} profileId={profileId} library={calendar.data.study_library ?? []} onLibraryChanged={refreshAfterChange} onRename={rename} day={editor.day} area={editor.area} list={editor.list} onClose={closeEditor} onSave={save} onRestore={restore} returnFocus={returnFocus} />}
    </div>
  );
}
