import { uiMessage } from '../../i18n/uiText';

/** A recipe completion counter, separate from the achievement collection. */
export function KitchenCompletionMedal({ count, recipeId }: { count: number; recipeId: string }) {
  if (!Number.isSafeInteger(count) || count < 1) return null;
  return <span id={`kitchen-finished-${recipeId}`} className="cooking-completion-medal">
    <svg viewBox="0 0 48 56" fill="none" aria-hidden="true">
      <path d="m12 31-4 20 9-4 5 7 3-20m12-3 4 20-9-4-5 7-3-20" fill="#9BC7B4" stroke="#79533D" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="24" cy="23" r="20" fill="#F8D886" stroke="#79533D" strokeWidth="2" />
      <circle cx="24" cy="23" r="15.5" fill="#FFF5D9" stroke="#D7AB60" strokeWidth="1.5" />
      <path d="M16 24c-7-1-6-11 1-11 2-7 12-7 14 0 7 0 8 10 1 11v8H16z" fill="#FFFDFA" stroke="#79533D" strokeWidth="2" strokeLinejoin="round" />
      <path d="M17 27h14M21 20v4m6-4v4" stroke="#C9A47A" strokeWidth="1.5" strokeLinecap="round" />
      <path d="m9 10 1-3 1 3 3 1-3 1-1 3-1-3-3-1z" fill="#FFFDF5" />
    </svg>
    <span aria-hidden="true">× {count.toLocaleString()}</span>
    <span className="sr-only">{uiMessage(recipeId === 'cabbage-rolls' ? 'Finished {count} times (OK-ish + Perfect)' : 'Finished {count} times', { count })}</span>
  </span>;
}
