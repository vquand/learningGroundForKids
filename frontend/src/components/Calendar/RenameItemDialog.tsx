import { useEffect, useRef, useState } from 'react';
import { uiText } from '../../i18n/uiText';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { useModalA11y } from './useModalA11y';
import { useVisualViewportFit } from './useVisualViewportFit';

export function RenameItemDialog({ name, maxLength, onSave, onClose }: {
  name: string; maxLength: number; onSave: (name: string) => Promise<void>; onClose: () => void;
}) {
  useUiLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useModalA11y(ref);
  useVisualViewportFit(ref);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  return <div ref={ref} className="meal-dialog-backdrop" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); if (!busy) onClose(); } }}>
    <form className="meal-dialog calendar-name-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-title" onSubmit={event => {
      event.preventDefault(); setBusy(true); setError('');
      void onSave(value.trim()).catch(() => setError(uiText('Could not rename this item. Refresh the calendar and try again.'))).finally(() => setBusy(false));
    }}>
      <header className="meal-dialog-header"><h2 id="rename-title">{uiText('Rename item')}</h2></header>
      <div className="calendar-name-body">
        <label className="calendar-field"><span>{uiText('Name')}</span><input ref={input} className="calendar-name-input" value={value} maxLength={maxLength} required disabled={busy} onChange={event => setValue(event.target.value)} /></label>
        <p>{uiText('This occurrence and later repeats, if any. Earlier names and other schedules stay unchanged.')}</p>
        {error && <p role="alert">{error}</p>}
      </div>
      <footer className="meal-dialog-footer"><button type="button" className="kid-nav-action" disabled={busy} onClick={onClose}>{uiText('Cancel')}</button><button type="submit" className="calendar-save-button" disabled={busy || !value.trim()}>{uiText('Save')}</button></footer>
    </form>
  </div>;
}
