import { CalendarScrollPanel } from './CalendarScrollPanel';
import { useState } from 'react';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { EVENT_ICON_TABS } from '../../lib/calendarEventCatalog';
import { CALENDAR_EVENTS_COPY } from './calendarEventsCopy';

interface Props {
  value: string;
  onChange: (key: string) => void;
}

/** Group tabs over scrollable icon choices; changing groups preserves selection. */
export function EventIconPicker({ value, onChange }: Props) {
  const language = useUiLanguage();
  const [tabIndex, setTabIndex] = useState(() => Math.max(0, EVENT_ICON_TABS.findIndex(tab => tab.entries.some(entry => entry.key === value))));
  const tab = EVENT_ICON_TABS[tabIndex] ?? EVENT_ICON_TABS[0]!;


  const selectTab = (index: number) => {
    setTabIndex(index);
  };

  return (
    <section className="events-icon-picker" aria-label={uiText(CALENDAR_EVENTS_COPY.icon)}>
      <div className="calendar-group-tabs events-icon-tabs" role="tablist" aria-label={uiText(CALENDAR_EVENTS_COPY.iconGroups)}>
        {EVENT_ICON_TABS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={index === tabIndex}
            className={index === tabIndex ? 'is-active' : undefined}
            onClick={() => selectTab(index)}
          >
            {uiText(item.label)}
          </button>
        ))}
      </div>
      <CalendarScrollPanel label={uiText(CALENDAR_EVENTS_COPY.iconChoices)} resetKey={String(tabIndex)} revealKey={tab.entries.some(entry => entry.key === value) ? `${tabIndex}:${value}` : null}><div className="events-icon-grid">
        {tab.entries.map((entry) => {
          const selected = entry.key === value;
          const label = language === 'vi' ? entry.vi : entry.en;
          return (
            <button
              key={entry.key}
              data-scroll-key={`${tabIndex}:${entry.key}`}
              type="button"
              className={`calendar-palette-choice events-icon-choice${selected ? ' is-selected' : ''}`}
              aria-pressed={selected}
              title={label}
              onClick={() => onChange(entry.key)}
            >
              <img src={entry.art} alt="" width="36" height="36" draggable={false} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      </CalendarScrollPanel>
    </section>
  );
}
