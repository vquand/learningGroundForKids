import { useQuery } from '@tanstack/react-query';
import { fetchCalendarWeather } from '../api/calendar';
import { familyQueryKey, familyScopedQuery } from '../lib/familyQueries';
import { useFamilyStore } from '../stores/familyStore';

export function calendarWeatherQueryKey(familyId: string | null, profileId: string | null) {
  return familyQueryKey('calendar-weather', familyId, profileId);
}

export function useCalendarWeather(profileId: string | null) {
  const familyId = useFamilyStore((state) => state.familyId);
  return useQuery({
    queryKey: calendarWeatherQueryKey(familyId, profileId),
    queryFn: profileId ? familyScopedQuery(familyId, () => fetchCalendarWeather(profileId)) : undefined,
    enabled: Boolean(familyId && profileId),
    staleTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
