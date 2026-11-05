import { studyEntry } from './calendarCatalog.ts';
import { CALENDAR_CHIP_GAP, CALENDAR_CHIP_HEIGHT } from './calendarHelpers.ts';
import type { StudyArea, StudyItem, StudyLanguage } from '../types/calendar';
import { calendarSearchText } from './calendarFoodGroups.ts';

export function filterStudyChoices<T extends { en: string; vi: string; name?: string }>(entries: readonly T[], query: string): T[] {
  const search = calendarSearchText(query);
  return entries.filter(entry => calendarSearchText(`${entry.en} ${entry.vi} ${entry.name ?? ''}`).includes(search));
}

export function setStudyLanguage(item: StudyItem, language: StudyLanguage | ''): StudyItem {
  const { teaching_language: _previous, ...rest } = item;
  return language ? { ...rest, teaching_language: language } : rest;
}

export const isClubItem = (item: StudyItem) => studyEntry(item.subject).group === 'club';

/** Keep each group's order; this display grouping never rewrites the stored plan. */
export function orderStudyItems(items: readonly StudyItem[], area: StudyArea): StudyItem[] {
  if (area === 'study_extra') return [...items];
  return [...items.filter(item => !isClubItem(item)), ...items.filter(isClubItem)];
}

/** All day cards in a row share this pixel height, measured against the shortest stack. */
export function studyClubSectionHeight(stackHeight: number, maxClubs: number): number {
  return maxClubs ? Math.min(maxClubs * (CALENDAR_CHIP_HEIGHT + CALENDAR_CHIP_GAP) - CALENDAR_CHIP_GAP + 8, Math.max(0, stackHeight - CALENDAR_CHIP_HEIGHT - CALENDAR_CHIP_GAP)) : 0;
}
