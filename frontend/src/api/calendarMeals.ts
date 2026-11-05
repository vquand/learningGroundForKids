import { ApiError, coreRequest } from './core.ts';
import { CalendarApiError, type CalendarErrorDetails } from './calendar.ts';
import type { CalendarList } from '../types/calendar';
import type { MealLibraryEntry, MealLibraryWriteBody, MealListWrite, MealsArea } from '../types/calendarMeals';

// Meal and medicine list writes reuse the study list endpoints (same revision rules), with meal item shapes.
// Kept separate from api/calendar.ts because those helpers are typed for study areas only.

function profileCalendarPath(profileId: string): string {
  return `/api/v1/profiles/${encodeURIComponent(profileId)}/calendar`;
}

function calendarMealRequest<T>(request: () => Promise<T>): Promise<T> {
  return request().catch((error: unknown) => {
    if (error instanceof ApiError) {
      const details = error.details && typeof error.details === 'object' ? error.details as CalendarErrorDetails : undefined;
      throw new CalendarApiError(error.message, error.status, error.code, details);
    }
    throw error;
  });
}

export function saveMealPlanList(profileId: string, input: MealListWrite): Promise<CalendarList> {
  return calendarMealRequest(() => coreRequest<CalendarList>(`${profileCalendarPath(profileId)}/lists`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }));
}

export function deleteMealPlanOverride(profileId: string, date: string, area: MealsArea, expectedRevision: number): Promise<void> {
  const params = new URLSearchParams({ date, area, expected_revision: String(expectedRevision) });
  return calendarMealRequest(() => coreRequest<void>(`${profileCalendarPath(profileId)}/lists?${params.toString()}`, { method: 'DELETE' }));
}

export function addMealLibraryEntry(profileId: string, body: MealLibraryWriteBody): Promise<MealLibraryEntry> {
  return calendarMealRequest(() => coreRequest<MealLibraryEntry>(`${profileCalendarPath(profileId)}/meals`, {
    method: 'POST',
    body: JSON.stringify(body),
  }));
}

export function removeMealLibraryEntry(profileId: string, mealId: string): Promise<void> {
  return calendarMealRequest(() => coreRequest<void>(`${profileCalendarPath(profileId)}/meals/${encodeURIComponent(mealId)}`, { method: 'DELETE' }));
}
export function updateMealLibraryEntry(profileId: string, entry: MealLibraryEntry, body: MealLibraryWriteBody): Promise<MealLibraryEntry> {
  return calendarMealRequest(() => coreRequest<MealLibraryEntry>(`${profileCalendarPath(profileId)}/meals/${encodeURIComponent(entry.id)}`, {
    method: 'PUT', body: JSON.stringify({ ...body, expected_food: entry.food_key, expected_name: entry.custom_name }),
  }));
}
