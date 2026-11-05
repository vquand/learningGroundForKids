import { useEffect, useRef, useState } from 'react';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { familyScopedQuery } from '../../lib/familyQueries';
import type { CalendarWindow, CalendarWeatherResponse } from '../../types/calendar';

export function CalendarShareButton({ data, profileId, familyId, weather }: { weather?: CalendarWeatherResponse; data: CalendarWindow | undefined; profileId: string | null; familyId: string | null }) {
  const language = useUiLanguage();
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => () => controller.current?.abort(), [profileId, familyId]);
  const share = async () => {
    if (!data || busy) return;
    const abort = new AbortController(); controller.current = abort; setBusy(true); setError(false);
    try {
      const blob = await familyScopedQuery(familyId, async () => {
        const { exportCalendarPdf } = await import('../../lib/calendarPdf');
        return exportCalendarPdf(data, language, abort.signal, weather);
      })();
      abort.signal.throwIfAborted();
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `calendar-${data.weeks[0]!.start}-two-weeks.pdf`;
      document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { if (!abort.signal.aborted) setError(true); } finally { if (controller.current === abort) { setBusy(false); controller.current = null; } }
  };
  return <div className="calendar-share"><button type="button" className="kid-nav-action" disabled={busy || data?.weeks.length !== 2} onClick={() => void share()}>{uiText(busy ? 'Preparing PDF…' : 'Share')}</button>
    {error && <p className="calendar-share-error" role="alert">{uiText('Could not export the calendar. Please try again.')}</p>}</div>;
}
