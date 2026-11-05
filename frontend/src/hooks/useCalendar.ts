import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCalendar } from '../api/calendar';
import { nextVietnamMidnightDelay } from '../lib/calendarHelpers';
import { familyQueryKey, familyScopedQuery } from '../lib/familyQueries';
import { useFamilyStore } from '../stores/familyStore';

export function calendarQueryKey(familyId: string | null, profileId: string | null) {
  return familyQueryKey('calendar', familyId, profileId);
}

export function useCalendar(profileId: string | null) {
  const familyId = useFamilyStore((state) => state.familyId);
  const queryKey = calendarQueryKey(familyId, profileId);
  const query = useQuery({
    queryKey,
    queryFn: profileId ? familyScopedQuery(familyId, () => fetchCalendar(profileId)) : undefined,
    enabled: Boolean(familyId && profileId),
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const today = query.data?.today;
  useEffect(() => {
    if (!today || !familyId || !profileId || typeof window === 'undefined') return;
    const timer = window.setTimeout(() => { void query.refetch(); }, nextVietnamMidnightDelay(today));
    return () => window.clearTimeout(timer);
  }, [familyId, profileId, query.refetch, today]);

  return query;
}
