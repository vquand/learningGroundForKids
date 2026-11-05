import type { CalendarWindow } from '../types/calendar';
import type { MealListWrite, MealsArea, MedicineRepeatDraft, MedicineTemplateRevision } from '../types/calendarMeals';

export const MEDICINE_WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export function toggleMedicineWeekday(selected: readonly number[], weekday: number): number[] {
  return selected.includes(weekday) ? selected.filter(value => value !== weekday) : [...selected, weekday].sort((a, b) => a - b);
}

export function captureMedicineTemplateRevisions(data: CalendarWindow, area: MealsArea): MedicineTemplateRevision[] {
  return Array.from({ length: 7 }, (_, index) => {
    const weekday = index + 1;
    const template = data.templates[String(weekday) as keyof CalendarWindow['templates']]?.[area] ?? { revision: 0 };
    return { weekday, expected_revision: template.revision };
  });
}

/** New repeating entries travel separately from the ordinary draft, so the server adds them exactly once per target. */
export function withMedicineRepeats(input: MealListWrite, repeats: readonly MedicineRepeatDraft[], revisions: readonly MedicineTemplateRevision[]): MealListWrite {
  if (!repeats.length) return input;
  const ids = new Set(repeats.map(repeat => repeat.item.series_id));
  const weekdays = new Set(repeats.flatMap(repeat => repeat.weekdays));
  return { ...input,
    items: input.items.filter(item => !item.series_id || !ids.has(item.series_id)),
    medicine_repeats: [...repeats],
    expected_medicine_revisions: revisions.filter(row => weekdays.has(row.weekday)),
  };
}
