import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCalendarPeopleSettings, saveCalendarPeopleSettings } from '../../api/calendarPeople';
import { ApiError } from '../../api/core';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { PARTICIPANT_ROLE_LABELS } from '../../lib/calendarPeople';
import { useFamilyStore } from '../../stores/familyStore';
import { RELATIVE_ROLES, type RelativeRole } from '../../types/calendarPeople';
import { CalendarIconButton } from './CalendarControls';
import { CalendarScrollPanel } from './CalendarScrollPanel';
import { useModalA11y } from './useModalA11y';
import { useVisualViewportFit } from './useVisualViewportFit';

export function CalendarPeopleSettingsDialog({ onClose }: { onClose: () => void }) {
  useUiLanguage();
  const familyId = useFamilyStore(s => s.familyId);
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: familyQueryKey('parent-calendar-settings', familyId), queryFn: familyScopedQuery(familyId, fetchCalendarPeopleSettings), retry: false, staleTime: 0 });
  const [draft, setDraft] = useState<{ disabled: RelativeRole[]; revision: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalA11y(ref); useVisualViewportFit(ref);
  useEffect(() => { closeRef.current?.focus(); }, []);
  const disabled = draft?.disabled ?? settings.data?.disabled_roles ?? [];
  const save = async () => {
    const revision = draft?.revision ?? settings.data?.revision;
    if (revision === undefined) return;
    setBusy(true); setError('');
    try {
      await familyScopedQuery(familyId, () => saveCalendarPeopleSettings(disabled, revision))();
      await queryClient.invalidateQueries({ queryKey: familyQueryKey('calendar-participants', familyId) });
      await queryClient.invalidateQueries({ queryKey: familyQueryKey('parent-calendar-settings', familyId) });
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        const fresh = await settings.refetch();
        if (fresh.data) setDraft({ disabled, revision: fresh.data.revision });
        setError(uiText('These settings changed on another device. Review your choices and save again.'));
      } else setError(uiText('Could not save these choices. Please try again.'));
    } finally { setBusy(false); }
  };
  return createPortal(<div className="meal-dialog-backdrop"><section ref={ref} className="meal-dialog events-people-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-people-settings-title"
    onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); } }}>
    <header className="meal-dialog-header"><h2 id="calendar-people-settings-title">{uiText('Family members in events')}</h2><CalendarIconButton ref={closeRef} icon="close" disabled={busy} aria-label={uiText('Close')} onClick={onClose} /></header>
    <CalendarScrollPanel label={uiText('Family members in events')}><div className="events-people-content">
      <p>{uiText('Choose which family-member buttons children can use in events. These choices apply to all children in your family. Saved events keep their people.')}</p>
      {settings.isPending && <p role="status">{uiText('Loading…')}</p>}
      {settings.isError && <div role="alert"><p>{uiText('Could not load these choices. Please try again.')}</p><button className="kid-nav-action" type="button" onClick={() => void settings.refetch()}>{uiText('Retry')}</button></div>}
      {settings.data && <div className="events-people-grid">{RELATIVE_ROLES.map(key => <button key={key} type="button" className="calendar-palette-choice" disabled={busy} aria-pressed={!disabled.includes(key)}
        onClick={() => setDraft({ revision: draft?.revision ?? settings.data!.revision, disabled: disabled.includes(key) ? disabled.filter(k => k !== key) : [...disabled, key] })}>{uiText(PARTICIPANT_ROLE_LABELS[key])}</button>)}</div>}
      <p className="events-note">{uiText('Selected buttons are available to children. You can change these choices at any time.')}</p>
      {error && <p className="events-error" role="alert">{error}</p>}
    </div></CalendarScrollPanel>
    <footer className="meal-dialog-footer"><button type="button" className="kid-nav-action" disabled={busy} onClick={onClose}>{uiText('Cancel')}</button><button type="button" className="calendar-save-button" disabled={busy || !settings.data} onClick={() => void save()}>{uiText(busy ? 'Saving…' : 'Save')}</button></footer>
  </section></div>, document.body);
}
