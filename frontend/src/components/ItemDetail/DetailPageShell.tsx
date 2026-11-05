import { useUiLanguage } from '../../hooks/useUiLanguage';
import { KidBackButton } from '../KidBackButton';
import { uiText } from '../../i18n/uiText';
import type { ReactNode } from 'react';
import type { ItemDetail } from '../../types/item';
import PhotoGallery from './PhotoGallery';
import { TimePeriodBadge } from '../shared/TimePeriodBadge';
import './detailNavigation.css';

interface DetailPageShellProps {
  item: ItemDetail;
  children: ReactNode;
  langToggle?: ReactNode;
  doneBadge?: ReactNode;
}

const CATEGORY_COLORS: Record<string, string> = {
  food: 'amber',
  monument: 'blue',
  landmark: 'green',
  music: 'purple',
  movie: 'pink',
};

export function DetailPageShell({ item, children, langToggle, doneBadge }: DetailPageShellProps) {
  useUiLanguage();
  const color = CATEGORY_COLORS[item.category] ?? 'gray';

  // Build Tailwind classes using complete strings (not dynamic concatenation)
  const badgeClass = getBadgeClass(color);

  return (
    <div>
      <header className="item-detail-backbar kid-nav"><KidBackButton label="Back" onClick={() => window.history.back()}/></header>
      <div className="max-w-2xl mx-auto px-4 pb-8 detail-page-enter">

      <PhotoGallery item={item} media={item.media} />

      <div className={`item-detail-titlebar mt-4 mb-2 px-4 py-3 -mx-4 rounded-2xl ${getGradientClass(color)}`}>
        <div className="item-detail-heading">
          <h1 className="font-bold min-h-[2.5rem] text-gray-800">
            {doneBadge}<span>{item.translation?.title ?? uiText("Untitled")}</span>
          </h1>
          {langToggle}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className={badgeClass}>
          {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
        </span>
        {item.start_year != null && (
          <TimePeriodBadge
            startYear={item.start_year}
            endYear={item.end_year}
            timePrecision={item.time_precision}
          />
        )}
      </div>

      {children}
      </div>
    </div>
  );
}

function getGradientClass(color: string): string {
  const map: Record<string, string> = {
    amber: 'bg-gradient-to-r from-amber-50 to-amber-100/50',
    blue: 'bg-gradient-to-r from-blue-50 to-blue-100/50',
    green: 'bg-gradient-to-r from-green-50 to-green-100/50',
    purple: 'bg-gradient-to-r from-purple-50 to-purple-100/50',
    pink: 'bg-gradient-to-r from-pink-50 to-pink-100/50',
    gray: 'bg-gradient-to-r from-gray-50 to-gray-100/50',
  };
  return map[color] ?? (map.gray as string);
}

function getBadgeClass(color: string): string {
  const map: Record<string, string> = {
    amber: 'bg-amber-100 text-amber-700 rounded-full px-3 py-1 text-sm font-semibold inline-block',
    blue: 'bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-sm font-semibold inline-block',
    green: 'bg-green-100 text-green-700 rounded-full px-3 py-1 text-sm font-semibold inline-block',
    purple: 'bg-purple-100 text-purple-700 rounded-full px-3 py-1 text-sm font-semibold inline-block',
    pink: 'bg-pink-100 text-pink-700 rounded-full px-3 py-1 text-sm font-semibold inline-block',
    gray: 'bg-gray-100 text-gray-700 rounded-full px-3 py-1 text-sm font-semibold inline-block',
  };
  return map[color] ?? (map.gray as string);
}

export default DetailPageShell;
