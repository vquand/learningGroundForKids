import { uiText } from '../../i18n/uiText';
import { CALENDAR_COPY } from './calendarCopy';

export type CalendarWeekOrientation = 'horizontal' | 'vertical';

interface Props {
  /** Server week rows. Only the first two (this week, next week) get a tab. */
  weeks: readonly { start: string }[];
  /** Index into `weeks` of the selected tab (0 = this week, 1 = next week). */
  active: number;
  onChange: (index: number) => void;
  /** Horizontal is the Parent Space row. Vertical is the kid calendar's top rail group. Same tab semantics either way. */
  orientation?: CalendarWeekOrientation;
}

export function CalendarWeekToggle({ weeks, active, onChange, orientation = 'horizontal' }: Props) {
  const vertical = orientation === 'vertical';
  return (
    <div
      className={vertical ? 'calendar-week-toggle is-vertical' : 'calendar-week-toggle'}
      role="tablist"
      aria-label={uiText(CALENDAR_COPY.weeks)}
      aria-orientation={vertical ? 'vertical' : undefined}
    >
      {weeks.slice(0, 2).map((item, index) => (
        <button
          key={item.start}
          type="button"
          role="tab"
          aria-selected={active === index}
          className={active === index ? 'is-active' : ''}
          onClick={() => onChange(index)}
        >
          {uiText(index === 0 ? CALENDAR_COPY.thisWeek : CALENDAR_COPY.nextWeek)}
        </button>
      ))}
    </div>
  );
}
