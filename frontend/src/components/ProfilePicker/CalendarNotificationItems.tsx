import { useMemo, useState } from 'react';
import type { CalendarNotificationItem } from '../../api/calendarNotifications';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { calendarNotificationCopy } from '../../hooks/useCalendarNotifications';
import { uiMessage, uiText } from '../../i18n/uiText';
import {
  CALENDAR_NOTIFICATION_PREVIEW,
  calendarNotificationArt,
  calendarNotificationDayLabel,
  calendarNotificationTitle,
  previewItems,
  sortCalendarNotifications,
} from '../../lib/calendarNotificationFeed';
import './calendarNotifications.css';

/** The "Coming up" group inside the Notifications panel. Its preview and "Show all" are its own. */
export function CalendarNotificationItems({ items }: { items: readonly CalendarNotificationItem[] }) {
  const language = useUiLanguage();
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => sortCalendarNotifications(items), [items]);
  if (!sorted.length) return null;

  const copy = calendarNotificationCopy(language);
  const visible = previewItems(sorted, expanded, CALENDAR_NOTIFICATION_PREVIEW);
  return (
    <div className="calendar-notifications">
      <h3 className="calendar-notifications-heading">{uiText('Coming up')}</h3>
      <ul className="calendar-notifications-feed">
        {visible.map((item) => (
          <li key={item.occurrence_id} className="calendar-notification-row">
            <img className="calendar-notification-icon" src={calendarNotificationArt(item)} alt="" width={28} height={28} />
            <span className="calendar-notification-title" title={calendarNotificationTitle(item, copy)}>
              {calendarNotificationTitle(item, copy)}
            </span>
            {item.kind === 'kid' && item.profile_name ? (
              <span className="calendar-notification-kid">{item.profile_name}</span>
            ) : null}
            <span className="calendar-notification-day">{calendarNotificationDayLabel(item.days_until, copy)}</span>
          </li>
        ))}
      </ul>
      {sorted.length > CALENDAR_NOTIFICATION_PREVIEW && (
        <button
          type="button"
          className="calendar-notifications-more"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? uiText('Show less') : uiMessage('Show all ({count})', { count: sorted.length })}
        </button>
      )}
    </div>
  );
}
