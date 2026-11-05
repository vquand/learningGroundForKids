import { useQuery } from "@tanstack/react-query";
import { fetchProgress } from "../api/profiles";
import { familyQueryKey, familyScopedQuery } from "../lib/familyQueries";
import { useFamilyStore } from "../stores/familyStore";
import type { ProgressResponse } from "../types/progress";

const EMPTY: ProgressResponse = { done_item_ids: [], wip_item_ids: [] };

export function useProgressData(profileId: string | null, progressOverride?: ProgressResponse) {
  const familyId = useFamilyStore((state) => state.familyId);
  const { data } = useQuery({
    queryKey: progressOverride
      ? ["progress", "local-uat", profileId]
      : familyQueryKey("progress", familyId, profileId),
    queryFn: progressOverride
      ? () => Promise.resolve(progressOverride)
      : familyScopedQuery(familyId, () => fetchProgress(profileId!)),
    enabled: Boolean(progressOverride || (familyId && profileId)),
    initialData: progressOverride,
    staleTime: 30_000,
  });
  return { progress: data ?? EMPTY, ready: data !== undefined };
}

export function useProgress(profileId: string | null, progressOverride?: ProgressResponse) {
  return useProgressData(profileId, progressOverride).progress;
}
