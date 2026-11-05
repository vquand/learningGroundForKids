import { useCallback } from 'react';
import { getParentAccessGeneration } from '../lib/parentQueryCache';
import { useSessionRequests } from './useSessionRequests';

/** Discard callbacks immediately on lock/expiry, before React unmounts the view. */
export function useParentRequests() {
  const generation = getParentAccessGeneration();
  const isCurrent = useCallback(() => generation === getParentAccessGeneration(), [generation]);
  return useSessionRequests(undefined, isCurrent);
}
