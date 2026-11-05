import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';

/** Re-fetches the current view without navigating or running content update jobs. */
export function AdminRefreshButton({ refreshing, disabled = false, onRefresh }: {
  refreshing: boolean; disabled?: boolean; onRefresh: () => void;
}) {
  useUiLanguage();
  return <button type="button" onClick={onRefresh} disabled={refreshing || disabled}
    aria-busy={refreshing} aria-live="polite"
    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-wait disabled:opacity-60">
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17" />
    </svg>
    {uiText(refreshing ? 'Refreshing…' : 'Refresh')}
  </button>;
}
