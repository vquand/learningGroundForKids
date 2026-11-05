export type TimePrecision = 'mya' | 'kya' | 'century' | 'decade' | 'year' | 'exact';

/**
 * Format a year value for display based on precision.
 * Examples:
 *   formatYear(-65000000, 'mya') => "~65 million years ago"
 *   formatYear(-10000, 'kya') => "~10,000 years ago"
 *   formatYear(1200, 'century') => "~12th century"
 *   formatYear(1960, 'decade') => "1960s"
 *   formatYear(2026, 'year') => "2026"
 *   formatYear(2026, 'exact') => "2026"
 *   formatYear(-500, undefined) => "500 BCE"  (fallback when no precision)
 */
export function formatYear(year: number, precision?: TimePrecision | string | null): string {
  if (precision === 'mya') {
    const millions = Math.abs(Math.round(year / 1000000));
    return `~${millions} million years ago`;
  }
  if (precision === 'kya') {
    const thousands = Math.abs(year).toLocaleString();
    return `~${thousands} years ago`;
  }
  if (precision === 'century') {
    const century = Math.ceil(Math.abs(year) / 100);
    const suffix = century === 1 ? 'st' : century === 2 ? 'nd' : century === 3 ? 'rd' : 'th';
    return `~${century}${suffix} century`;
  }
  if (precision === 'decade') {
    const decade = Math.floor(Math.abs(year) / 10) * 10;
    return `${decade}s`;
  }
  if (precision === 'year' || precision === 'exact') {
    return `${year}`;
  }
  // Fallback: raw year with BCE/CE
  if (year < 0) return `${Math.abs(year).toLocaleString()} BCE`;
  return `${year}`;
}

/**
 * Short format for scrubber labels (more compact).
 */
export function formatYearShort(year: number): string {
  if (Math.abs(year) >= 1000000) {
    return `${Math.round(year / 1000000)}M`;
  }
  if (Math.abs(year) >= 1000) {
    return `${Math.round(year / 1000)}K`;
  }
  return `${year}`;
}
