import { useId } from 'react';
import { uiText } from '../../i18n/uiText';
import type { StudyLanguage } from '../../types/calendar';

export const studyLanguageLabel = (language: StudyLanguage) => uiText(language === 'en' ? 'English' : 'Vietnamese');

/** A flag medallion for the subject's teaching language, independent of the interface language. */
export function StudyLanguageBadge({ language }: { language?: StudyLanguage }) {
  const clip = useId();
  if (!language) return null;
  const label = studyLanguageLabel(language);
  return <svg className="calendar-language-medal" viewBox="0 0 28 32" role="img" aria-label={label}>
    <title>{label}</title>
    <defs><clipPath id={clip}><circle cx="14" cy="13" r="10" /></clipPath></defs>
    <path d="M7 21l-2 10 9-4 9 4-2-10" fill="#d9ae57" stroke="#9d793d" />
    <circle cx="14" cy="13" r="12" fill="#f4d897" stroke="#9d793d" />
    <g clipPath={`url(#${clip})`}>
      {language === 'vi' ? <><path d="M3 2h22v22H3z" fill="#d93434" /><path d="M14 5l2.3 5 5.5.6-4.1 3.7 1.2 5.4-4.9-2.8-4.9 2.8 1.2-5.4-4.1-3.7 5.5-.6z" fill="#ffdf54" /></> : <>
        <path d="M3 2h22v22H3z" fill="#214676" />
        <path d="M3 2l22 22M25 2L3 24" stroke="#fffaf0" strokeWidth="5" />
        <path d="M3 2l22 22M25 2L3 24" stroke="#c93b3e" strokeWidth="2" />
        <path d="M14 2v22M3 13h22" stroke="#fffaf0" strokeWidth="7" />
        <path d="M14 2v22M3 13h22" stroke="#c93b3e" strokeWidth="4" />
      </>}
    </g>
  </svg>;
}
