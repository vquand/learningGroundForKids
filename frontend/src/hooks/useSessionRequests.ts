import { useEffect, useMemo, useRef } from 'react';
import { createRequestLifecycle } from '../lib/requestLifecycle';
import { isCurrentFamilySession } from '../lib/familyQueries';
import { useFamilyStore } from '../stores/familyStore';
import { useProfileStore } from '../stores/profileStore';

export function useSessionRequests(profileId?: string | null, isAllowed?: () => boolean) {
  const familyId = useFamilyStore(state => state.familyId);
  const sessionGeneration = useFamilyStore(state => state.sessionGeneration);
  const mounted = useRef(false);
  const requests = useMemo(() => createRequestLifecycle(() => mounted.current
    && (isAllowed?.() ?? true)
    && isCurrentFamilySession({ familyId, sessionGeneration })
    && (profileId === undefined || useProfileStore.getState().activeProfileId === profileId)),
  [familyId, sessionGeneration, profileId, isAllowed]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; requests.invalidate(); };
  }, [requests]);
  return requests;
}
