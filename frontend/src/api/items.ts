// frontend/src/api/items.ts
import { coreRequest } from "./core.ts";
import type { ItemDetail, ItemSummary } from "../types/item";

export async function fetchItems(profileId?: string | null): Promise<ItemSummary[]> {
  // The map needs the complete bounded local catalog. The Worker enforces the
  // same hard ceiling so this remains a bounded list request.
  const profileQuery = profileId ? `&profile_id=${encodeURIComponent(profileId)}` : "";
  return coreRequest<ItemSummary[]>(`/api/v1/items?limit=5000${profileQuery}`);
}

export async function fetchItem(id: string, lang = "en", profileId?: string | null): Promise<ItemDetail> {
  const profileQuery = profileId ? `&profile_id=${encodeURIComponent(profileId)}` : "";
  return coreRequest<ItemDetail>(`/api/v1/items/${encodeURIComponent(id)}?lang=${encodeURIComponent(lang)}${profileQuery}`);
}
