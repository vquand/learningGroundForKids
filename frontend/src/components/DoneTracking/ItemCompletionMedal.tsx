import { uiText } from '../../i18n/uiText';

export function ItemCompletionMedal({ isDone }: { isDone: boolean }) {
  if (!isDone) return null;
  return <span className="item-completion-medal" role="img" aria-label={uiText('Completed')}>
    <svg viewBox="0 0 40 48" fill="none" aria-hidden="true">
      <path d="m10 27-3 18 9-4 5 5 3-18m6-1 3 18-9-4-5 5-3-18" fill="#DEAD91" stroke="#79543D" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="20" cy="19" r="17" fill="#F2D183" stroke="#79543D" strokeWidth="1.5"/>
      <circle cx="20" cy="19" r="12.5" fill="#E6EFD5" stroke="#BC9B59"/>
      <path d="m13 19 5 5 9-10" stroke="#587148" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>;
}
