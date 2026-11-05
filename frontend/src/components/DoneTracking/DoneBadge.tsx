import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
interface DoneBadgeProps {
  isDone: boolean;
}

export function DoneBadge({ isDone }: DoneBadgeProps) {
  useUiLanguage();
  if (!isDone) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1 bg-green-100 text-green-700 rounded-full px-3 py-1 text-sm font-semibold done-badge-pop-in" aria-label={uiText("Completed")}>
      {uiText("✓ Done")}</div>
  );
}

export default DoneBadge;
