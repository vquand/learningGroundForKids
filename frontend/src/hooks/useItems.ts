import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchItem, fetchItems } from "../api/items";
import { familyScopedQuery } from "../lib/familyQueries";
import { useFamilyStore } from "../stores/familyStore";
import { useProfileStore } from "../stores/profileStore";
import type { ItemSummary } from "../types/item";

export function useItems(itemsOverride?: readonly ItemSummary[]) {
  const familyId = useFamilyStore((state) => state.familyId);
  const profileId = useProfileStore((state) => state.activeProfileId);
  return useQuery({
    queryKey: itemsOverride ? ["items", "local-uat"] : ["items", familyId, profileId],
    queryFn: itemsOverride
      ? () => Promise.resolve([...itemsOverride])
      : familyScopedQuery(familyId, () => fetchItems(profileId)),
    enabled: Boolean(itemsOverride || familyId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useItem(id: string, lang?: string) {
  const familyId = useFamilyStore((state) => state.familyId);
  const profileId = useProfileStore((state) => state.activeProfileId);
  return useQuery(itemQueryOptions(id, lang, familyId, profileId));
}

export function itemQueryOptions(
  id: string,
  lang: string | undefined,
  familyId: string | null,
  profileId: string | null,
) {
  return {
    queryKey: ["item", familyId, profileId, id, lang],
    queryFn: familyScopedQuery(familyId, () => fetchItem(id, lang, profileId)),
    enabled: Boolean(familyId && id),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  };
}
