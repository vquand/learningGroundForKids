import { useLayoutEffect, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiMessage, uiText } from '../../i18n/uiText';
import { CALENDAR_TIME_ICONS, isStudyKey, studyEntry, studyLabel } from '../../lib/calendarCatalog';
import { CALENDAR_CHIP_GAP, CALENDAR_CHIP_HEIGHT, CALENDAR_DAY_HEADING_HEIGHT, CALENDAR_EVENING_ROW_HEIGHT, CALENDAR_WEATHER_STRIP_GAP, CALENDAR_WEATHER_STRIP_HEIGHT, buildWeatherAriaLabel, formatWeatherTemperature, isCalendarWeekend, visibleChipCount, weatherDisplayState, weatherForDateAndPeriod } from '../../lib/calendarHelpers';
import type { CalendarDay, CalendarList, CalendarWeatherPeriod, CalendarWeatherResponse, CalendarWeek, StudyArea, StudyItem } from '../../types/calendar';
import { isClubItem, orderStudyItems, studyClubSectionHeight } from '../../lib/calendarStudyPlan';
import { StudyLanguageBadge, studyLanguageLabel } from './StudyLanguageBadge';
import { CALENDAR_COPY, CALENDAR_WEEKDAY_KEYS } from './calendarCopy';

const AREAS: readonly { area: StudyArea; label: string; icon: string; rowClass: string }[] = [
  { area: 'study_morning', label: CALENDAR_COPY.morning, icon: CALENDAR_TIME_ICONS.sunrise, rowClass: 'calendar-row-label--morning' },
  { area: 'study_afternoon', label: CALENDAR_COPY.afternoon, icon: CALENDAR_TIME_ICONS.sunset, rowClass: 'calendar-row-label--afternoon' },
  { area: 'study_extra', label: CALENDAR_COPY.extra, icon: '/calendar/icons/weather/clear_night.webp', rowClass: 'calendar-row-label--extra' },
];

// Chip geometry is owned by calendarHelpers and mirrored into CSS custom properties on the grid.
const GRID_CHIP_VARS = {
  '--calendar-chip-height': `${CALENDAR_CHIP_HEIGHT}px`,
  '--calendar-chip-gap': `${CALENDAR_CHIP_GAP}px`,
  '--calendar-day-heading-height': `${CALENDAR_DAY_HEADING_HEIGHT}px`,
  '--calendar-weather-strip-height': `${CALENDAR_WEATHER_STRIP_HEIGHT}px`,
  '--calendar-weather-strip-gap': `${CALENDAR_WEATHER_STRIP_GAP}px`,
  '--calendar-evening-row-height': `${CALENDAR_EVENING_ROW_HEIGHT}px`,
} as CSSProperties;

interface Props {
  week: CalendarWeek;
  today: string;
  onEdit: (day: CalendarDay, area: StudyArea, cell: HTMLButtonElement) => void;
  cellRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  weather?: CalendarWeatherResponse;
  weatherLoading?: boolean;
  weatherError?: boolean;
  /** Parent view: cells are non-interactive groups (no button role, no tab stop). Chips and tint stay. */
  readOnly?: boolean;
}

function isCatalogStudyItem(item: unknown): item is StudyItem {
  return Boolean(item && typeof item === 'object' && 'subject' in item && isStudyKey(item.subject));
}

function listItems(list: CalendarList | undefined): StudyItem[] {
  return (list?.items ?? []).filter(isCatalogStudyItem);
}

function formatDate(date: string, language: ReturnType<typeof useUiLanguage>): string {
  const value = new Date(`${date}T12:00:00+07:00`);
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(value);
}

function dayLabel(day: CalendarDay, today: string, language: ReturnType<typeof useUiLanguage>): string {
  const date = formatDate(day.date, language);
  if (day.date === today) return `${date} · ${uiText(CALENDAR_COPY.today)}`;
  return date;
}

/** Tracks how many chips fit in the stack. The stack sits below the weather strip, so its height is the capacity. */
function useChipCapacity(items: StudyItem[]) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    setHeight(element.getBoundingClientRect().height);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[entries.length - 1]?.contentRect.height;
      if (measured !== undefined) setHeight(measured);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const visible = height === null ? items.length : visibleChipCount(height, items.length, CALENDAR_CHIP_HEIGHT, CALENDAR_CHIP_GAP);
  return { ref, visible, height };
}

function StudyChip({ item, language }: { item: StudyItem; language: ReturnType<typeof useUiLanguage> }) {
  const entry = studyEntry(item.subject);
  const label = item.name ?? studyLabel(item.subject, language);
  return (
    <span className={`calendar-study-chip${item.name ? ' is-custom-item' : ''}`} title={label}>
      <img src={entry.art} alt="" width="24" height="24" />
      <span>{label}</span>
      <StudyLanguageBadge language={item.teaching_language} />
    </span>
  );
}

function periodCopy(period: 'morning' | 'afternoon' | 'evening') {
  return period === 'morning' ? CALENDAR_COPY.morning : period === 'afternoon' ? CALENDAR_COPY.afternoon : CALENDAR_COPY.evening;
}

/** Full-width weather strip above the chip stack. Its meaning is carried by the cell's accessible name. */
function WeatherStrip({ period, periodKey, language }: { period: CalendarWeatherPeriod; periodKey: 'morning' | 'afternoon' | 'evening'; language: ReturnType<typeof useUiLanguage> }) {
  const periodLabel = uiText(periodCopy(periodKey), language);
  const ariaLabel = buildWeatherAriaLabel(uiText(CALENDAR_COPY.weatherAria, language), periodLabel, period, language);
  return (
    <span className="calendar-weather-strip" title={ariaLabel} aria-hidden="true">
      <img src={`/calendar/icons/weather/${period.icon}.webp`} alt="" width="24" height="24" draggable={false} />
      <span>{formatWeatherTemperature(period.temp_c)}</span>
    </span>
  );
}

function StudyCell({ day, area, today, onEdit, cellRefs, weather, weatherDisplay, readOnly = false, clubHeight = null }: { day: CalendarDay; area: StudyArea; today: string; onEdit: Props['onEdit']; cellRefs: Props['cellRefs']; weather?: CalendarWeatherResponse; weatherDisplay: ReturnType<typeof weatherDisplayState>; readOnly?: boolean; clubHeight?: number | null }) {
  const list = day.lists[area];
  const items = orderStudyItems(listItems(list), area);
  const key = `${day.date}:${area}`;
  const language = useUiLanguage();
  const editable = !readOnly;
  const { ref: stackRef, visible, height } = useChipCapacity(items);
  const grouped = area !== 'study_extra';
  const clubs = grouped ? items.filter(isClubItem) : [];
  const regular = grouped ? items.filter(item => !isClubItem(item)) : items;
  const reservedClubHeight = clubs.length ? clubHeight : 0;
  const regularCapacity = reservedClubHeight !== null && height !== null ? visibleChipCount(Math.max(0, height - reservedClubHeight - (reservedClubHeight ? CALENDAR_CHIP_GAP : 0)), regular.length, CALENDAR_CHIP_HEIGHT, CALENDAR_CHIP_GAP) : regular.length;
  const clubCapacity = clubHeight === null ? clubs.length : visibleChipCount(Math.max(0, clubHeight - 8), clubs.length, CALENDAR_CHIP_HEIGHT, CALENDAR_CHIP_GAP);
  const shown = regular.slice(0, grouped ? regularCapacity : visible);
  const shownClubs = clubs.slice(0, clubCapacity);
  const remaining = regular.length - shown.length;
  const remainingClubs = clubs.length - shownClubs.length;
  const periodKey = area === 'study_extra' ? 'evening' : area === 'study_morning' ? 'morning' : 'afternoon';
  const weatherPeriod = weatherDisplay === 'ok' && area !== 'study_extra' ? weatherForDateAndPeriod(weather, day.date, periodKey) : undefined;
  const label = uiMessage(CALENDAR_COPY.editList, {
    row: uiText(area === 'study_extra' ? CALENDAR_COPY.extra : area === 'study_morning' ? CALENDAR_COPY.morning : CALENDAR_COPY.afternoon),
    date: dayLabel(day, today, language),
  });
  // The chips may be clipped, so the accessible name always lists the full plan.
  const summary = items.length
    ? uiMessage(CALENDAR_COPY.plannedSubjects, { subjects: items.map((item) => `${item.name ?? studyLabel(item.subject, language)}${item.teaching_language ? ` (${studyLanguageLabel(item.teaching_language)})` : ''}`).join(', ') })
    : uiText(CALENDAR_COPY.noItems);
  const weatherDescription = weatherPeriod ? buildWeatherAriaLabel(uiText(CALENDAR_COPY.weatherAria, language), uiText(periodCopy(periodKey), language), weatherPeriod, language) : '';
  const readOnlyLabel = [uiText(area === 'study_extra' ? CALENDAR_COPY.extra : area === 'study_morning' ? CALENDAR_COPY.morning : CALENDAR_COPY.afternoon), dayLabel(day, today, language)].join(' · ');
  const description = [readOnly ? readOnlyLabel : label, summary, weatherDescription].filter(Boolean).join('. ');
  const classes = [
    'calendar-study-cell',
    isCalendarWeekend(day.weekday) ? 'is-weekend' : '',
    day.date === today ? 'is-today' : '',
    day.is_past ? 'is-past' : '',
    items.length === 0 ? 'is-empty' : '',
    readOnly ? 'is-readonly' : '',
  ].filter(Boolean).join(' ');
  const body = (
    <>
      {weatherPeriod && <WeatherStrip period={weatherPeriod} periodKey={periodKey} language={language} />}
      <span ref={stackRef} className={`calendar-study-stack${items.length === 0 ? ' is-empty' : ''}`} aria-hidden="true">
        {items.length === 0 && (
          <span className="calendar-empty-cell">
            <svg className="calendar-empty-book" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <path d="M24 12c-4-3-10-4-17-3v26c7-1 13 0 17 3 4-3 10-4 17-3V9c-7-1-13 0-17 3z" fill="#e9e4da" stroke="#8a949a" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M24 12v26" stroke="#8a949a" strokeWidth="2.5" />
              <path d="M12 18c3-.3 6 0 9 1.2M12 24c3-.3 6 0 9 1.2M36 18c-3-.3-6 0-9 1.2M36 24c-3-.3-6 0-9 1.2" stroke="#b3bbbf" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
            <span className="calendar-empty-label">{uiText(CALENDAR_COPY.noItems)}</span>
          </span>
        )}
        {shown.map((item, index) => <StudyChip key={`subject-${index}`} item={item} language={language} />)}
        {remaining > 0 && <span className="calendar-more-chip">+{remaining}</span>}
        {grouped && clubs.length > 0 && <span className={`calendar-club-section${clubs.length ? ' has-divider' : ''}`} style={clubHeight === null ? undefined : { height: clubHeight }}>
          {shownClubs.map((item, index) => <StudyChip key={`club-${index}`} item={item} language={language} />)}
          {remainingClubs > 0 && <span className="calendar-more-chip">+{remainingClubs}</span>}
        </span>}
      </span>
    </>
  );

  if (readOnly) return <div className={classes} role="group" aria-label={description}>{body}</div>;
  return (
    <button
      ref={(element) => { cellRefs.current[key] = element; }}
      type="button"
      className={classes}
      disabled={!editable}
      aria-label={editable ? description : `${description} · ${uiText(CALENDAR_COPY.pastDay)}`}
      onClick={(event) => onEdit(day, area, event.currentTarget)}
    >
      {body}
    </button>
  );
}

function EveningWeatherCell({ day, today, weather, weatherDisplay, language }: { day: CalendarDay; today: string; weather?: CalendarWeatherResponse; weatherDisplay: ReturnType<typeof weatherDisplayState>; language: ReturnType<typeof useUiLanguage> }) {
  const period = weatherDisplay === 'ok' ? weatherForDateAndPeriod(weather, day.date, 'evening') : undefined;
  const ariaLabel = period ? buildWeatherAriaLabel(uiText(CALENDAR_COPY.weatherAria, language), uiText(CALENDAR_COPY.evening, language), period, language) : undefined;
  return (
    <div className={`calendar-evening-cell${isCalendarWeekend(day.weekday) ? ' is-weekend' : ''}${day.date === today ? ' is-today' : ''}${day.is_past ? ' is-past' : ''}`} title={ariaLabel} aria-hidden={period ? undefined : 'true'}>
      {period && <><img src={`/calendar/icons/weather/${period.icon}.webp`} alt="" width="24" height="24" draggable={false} /><span>{formatWeatherTemperature(period.temp_c)}</span></>}
    </div>
  );
}

function StudyRow({ row, weekdays, ...props }: { row: typeof AREAS[number]; weekdays: CalendarDay[] } & Omit<Parameters<typeof StudyCell>[0], 'day' | 'area'>) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [clubHeight, setClubHeight] = useState<number | null>(null);
  const maxClubs = row.area === 'study_extra' ? 0 : Math.max(0, ...weekdays.map(day => listItems(day.lists[row.area]).filter(isClubItem).length));
  useLayoutEffect(() => {
    const stacks = rowRef.current?.querySelectorAll<HTMLElement>('.calendar-study-stack');
    if (!stacks?.length) return;
    const measure = () => {
      const minHeight = Math.min(...Array.from(stacks, stack => stack.clientHeight));
      // Leave room for at least one subject/overflow chip above a shared club section.
      setClubHeight(studyClubSectionHeight(minHeight, maxClubs));
    };
    measure();
    const observer = new ResizeObserver(measure);
    stacks.forEach(stack => observer.observe(stack));
    return () => observer.disconnect();
  }, [maxClubs]);
  return <div ref={rowRef} className="calendar-study-row" role="row">
    <div className={`calendar-row-label ${row.rowClass}`} title={row.area === 'study_extra' ? uiText(CALENDAR_COPY.extraDescription) : undefined}>
      <img className="calendar-row-icon" src={row.icon} alt="" aria-hidden="true" width="40" height="40" draggable={false} /><span>{uiText(row.label)}</span>
    </div>
    {weekdays.map(day => <StudyCell key={`${day.date}:${row.area}`} day={day} area={row.area} clubHeight={clubHeight} {...props} />)}
  </div>;
}

export function StudyGrid({ week, today, onEdit, cellRefs, weather, weatherLoading = false, weatherError = false, readOnly = false }: Props) {
  const language = useUiLanguage();
  const weekdays = week.days.slice(0, 7);
  const weatherDisplay = weatherDisplayState(weather, weatherLoading, weatherError);
  const hasEvening = weatherDisplay !== 'hidden';
  return (
    <section className="calendar-grid-wrap" aria-label={uiText(CALENDAR_COPY.study)} style={GRID_CHIP_VARS}>
      <div className={`calendar-study-grid${hasEvening ? ' has-evening' : ''}`}>
        <div className="calendar-grid-corner" aria-hidden="true" />
        {weekdays.map((day) => (
          <div key={day.date} className={`calendar-day-heading${isCalendarWeekend(day.weekday) ? ' is-weekend' : ''}${day.date === today ? ' is-today' : ''}${day.is_past ? ' is-past' : ''}`}>
            <strong>{uiText(CALENDAR_WEEKDAY_KEYS[day.weekday - 1] ?? CALENDAR_WEEKDAY_KEYS[0])}</strong>
            <span>{dayLabel(day, today, language)}</span>
          </div>
        ))}
        {AREAS.map(row => <StudyRow key={row.area} row={row} weekdays={weekdays} today={today} onEdit={onEdit} cellRefs={cellRefs} weather={weather} weatherDisplay={weatherDisplay} readOnly={readOnly} />)}
        {hasEvening && <div className="calendar-study-row calendar-evening-row" role="row">
          <div className="calendar-row-label calendar-row-label--evening"><span>{uiText(CALENDAR_COPY.evening)}</span></div>
          {weatherDisplay === 'no_location'
            ? <div className="calendar-evening-message" role="status">{uiText(CALENDAR_COPY.weatherNoLocation)}</div>
            : weekdays.map((day) => <EveningWeatherCell key={day.date} day={day} today={today} weather={weather} weatherDisplay={weatherDisplay} language={language} />)}
        </div>}
      </div>
    </section>
  );
}
