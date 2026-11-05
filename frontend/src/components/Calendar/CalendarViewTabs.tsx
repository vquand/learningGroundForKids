import { uiText } from '../../i18n/uiText';
import { CALENDAR_COPY } from './calendarCopy';

export type CalendarView = 'study' | 'meals' | 'events';

export type CalendarTabsOrientation = 'horizontal' | 'vertical';

interface Props {
  active: CalendarView;
  onChange: (view: CalendarView) => void;
  /** Horizontal is the Parent Space row. Vertical is the kid calendar's left rail. */
  orientation?: CalendarTabsOrientation;
}

export const CALENDAR_VIEW_ICONS: Readonly<Record<CalendarView, string>> = {
  study: '/calendar/icons/ui/tab_study.webp',
  meals: '/calendar/icons/ui/tab_meals.webp',
  events: '/calendar/icons/ui/tab_events.webp',
};

const AVAILABLE_VIEWS: readonly { id: CalendarView; label: string }[] = [
  { id: 'study', label: CALENDAR_COPY.study },
  { id: 'meals', label: CALENDAR_COPY.meals },
  { id: 'events', label: CALENDAR_COPY.events },
];

export function CalendarViewTabs({ active, onChange, orientation = 'horizontal' }: Props) {
  const vertical = orientation === 'vertical';
  return (
    <div
      className={vertical ? 'calendar-view-tabs is-vertical' : 'calendar-view-tabs'}
      role="tablist"
      aria-label={uiText(CALENDAR_COPY.views)}
      aria-orientation={vertical ? 'vertical' : undefined}
    >
      {AVAILABLE_VIEWS.map((view) => (
        <button
          key={view.id}
          type="button"
          role="tab"
          aria-selected={active === view.id}
          className={active === view.id ? 'is-active' : ''}
          onClick={() => onChange(view.id)}
        >
          <img className="calendar-view-icon" src={CALENDAR_VIEW_ICONS[view.id]} alt="" aria-hidden="true" draggable={false} onError={(event) => { event.currentTarget.hidden = true; }} />
          {uiText(view.label)}
        </button>
      ))}
    </div>
  );
}
