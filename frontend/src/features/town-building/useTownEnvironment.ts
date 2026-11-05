import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTownEnvironment } from '../../api/town';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';

function subscribe(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => {
    document.removeEventListener('visibilitychange', onChange);
  };
}
export function useActiveTownPage() {
  return useSyncExternalStore(subscribe, () => document.visibilityState === 'visible', () => false);
}

/** Only active map viewers ask the server for weather; all maps reuse the same query/cache. */
export function useTownEnvironment(profileId: string, family: string | null) {
  const active = useActiveTownPage();
  return useQuery({ queryKey: familyQueryKey('town-environment', family, profileId),
    queryFn: familyScopedQuery(family, () => fetchTownEnvironment(profileId)), enabled: active,
    refetchInterval: 60_000, refetchIntervalInBackground: false, staleTime: 60_000, retry: false });
}
