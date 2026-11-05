import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { setUiLanguage, type UiLanguage } from '../../lib/uiLanguage';
import { createUiLanguageChoice } from '../../lib/uiLanguageChoice';
import { loadUiLanguage } from '../../i18n/uiText';
import './languageSwitcher.css';

export function LanguageSwitcher() {
  const language = useUiLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const chooseLanguage = useRef(createUiLanguageChoice(loadUiLanguage, setUiLanguage)).current;
  const choose = async (next: UiLanguage) => {
    const result = await chooseLanguage(next);
    if (result !== 'stale') {
      setOpen(false);
      trigger.current?.focus();
    }
  };
  return <div className="ui-language" ref={root} onKeyDown={event => {
    if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" className="ui-language__trigger" aria-haspopup="dialog" aria-expanded={open}
      aria-label={language === 'vi' ? 'Đổi ngôn ngữ giao diện' : 'Change interface language'} onClick={() => setOpen(!open)}>
      <span className={`ui-language__ball ${language}`} aria-hidden="true" />
    </button>
    {open && <div className="ui-language__popup" role="dialog" aria-label={language === 'vi' ? 'Ngôn ngữ giao diện' : 'Interface language'}>
      {(['en', 'vi'] as const).map((value, index) => <button ref={index === 0 ? first : undefined} type="button" key={value}
        lang={value} aria-pressed={value === language} onClick={() => choose(value)}>
        <span className={`ui-language__ball ${value}`} aria-hidden="true" />
        <span>{value === 'vi' ? 'Tiếng Việt' : 'English'}</span>
      </button>)}
    </div>}
  </div>;
}
