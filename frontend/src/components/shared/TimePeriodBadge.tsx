import { formatYear, type TimePrecision } from '../../utils/formatYear';

interface TimePeriodBadgeProps {
  startYear: number;
  endYear?: number;
  timePrecision?: TimePrecision | string | null;
}

export function TimePeriodBadge({ startYear, endYear, timePrecision }: TimePeriodBadgeProps) {
  const label = formatYear(startYear, timePrecision);
  // If has different end year, show range
  const rangeLabel = endYear != null && endYear !== startYear
    ? `${label} - ${formatYear(endYear, timePrecision)}`
    : label;

  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-bold">
      {rangeLabel}
    </span>
  );
}
