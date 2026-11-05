import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiMessage } from '../i18n/uiText';

/** The count is the selected child's server-confirmed total_done. */
export function LearntItemsCount({ count }: { count: number }) {
  useUiLanguage();
  return <span aria-live="polite" className="inline-block rounded-full border border-sky-200 bg-white/95 px-3 py-2 text-sm font-bold text-sky-800">
    {uiMessage(count === 1 ? '{count} learnt item' : '{count} learnt items', { count })}
  </span>;
}
