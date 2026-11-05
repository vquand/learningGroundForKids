import type { AdminItemFormData } from "../types/admin";
import type {
  ParentLessonCatalog,
  ParentLessonCreateInput,
  ParentLessonDetail,
  ParentLessonUpdateInput,
  ParentShareTargetFamily,
} from "../types/parent";

export function getParentRequestHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
  };
}

async function parseResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    let detail = `${fallbackMessage}: ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string; error?: { message?: string } };
      if (payload.detail) detail = payload.detail;
      else if (payload.error?.message) detail = payload.error.message;
    } catch {
      // Ignore JSON parse failures and use fallback.
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchParentLessonCatalog(): Promise<ParentLessonCatalog> {
  const response = await fetch("/api/v1/parent/lessons", {
    credentials: "same-origin",
    headers: getParentRequestHeaders(),
  });
  return parseResponse<ParentLessonCatalog>(response, "Failed to fetch parent lessons");
}

export async function disableSystemLessons(itemIds: string[], disabled: boolean): Promise<void> {
  const response = await fetch("/api/v1/parent/lessons/system/disable", {
    method: "POST",
    credentials: "same-origin",
    headers: getParentRequestHeaders(),
    body: JSON.stringify({ item_ids: itemIds, disabled }),
  });
  await parseResponse(response, "Failed to update system lessons");
}

export async function fetchParentShareTargets(): Promise<ParentShareTargetFamily[]> {
  const response = await fetch("/api/v1/parent/share-targets", {
    credentials: "same-origin",
    headers: getParentRequestHeaders(),
  });
  return parseResponse<ParentShareTargetFamily[]>(response, "Failed to fetch share targets");
}

export async function createParentLesson(data: ParentLessonCreateInput): Promise<{ id: string }> {
  const { target_scope, target_profile_id, ...form } = data;
  const response = await fetch("/api/v1/parent/lessons", {
    method: "POST",
    credentials: "same-origin",
    headers: getParentRequestHeaders(),
    body: JSON.stringify({
      item: { ...catalogFields(form), translations: formTranslations(form) },
      target_scope,
      ...(target_scope === "profile" ? { target_profile_id } : {}),
    }),
  });
  return parseResponse<{ id: string }>(response, "Failed to create lesson");
}

export async function fetchParentLesson(itemId: string): Promise<ParentLessonDetail> {
  const response = await fetch(`/api/v1/parent/lessons/${encodeURIComponent(itemId)}`, {
    credentials: "same-origin",
    headers: getParentRequestHeaders(),
  });
  return parseResponse<ParentLessonDetail>(response, "Failed to fetch lesson");
}

export async function updateParentLesson(
  itemId: string,
  data: ParentLessonUpdateInput,
): Promise<{ id: string }> {
  const current = await fetchParentLesson(itemId);
  const translations = mergeTranslations(current.translations, data);
  const response = await fetch(`/api/v1/parent/lessons/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: getParentRequestHeaders(),
    body: JSON.stringify({ item: { id: itemId, ...catalogFields(data), translations } }),
  });
  return parseResponse<{ id: string }>(response, "Failed to update lesson");
}

export async function shareParentLesson(
  itemId: string,
  targetScope: "family" | "profile",
  targetFamilyId: string,
  targetProfileId?: string,
): Promise<void> {
  const response = await fetch(`/api/v1/parent/lessons/${encodeURIComponent(itemId)}/share`, {
    method: "POST",
    credentials: "same-origin",
    headers: getParentRequestHeaders(),
    body: JSON.stringify({
      target_scope: targetScope,
      target_family_id: targetFamilyId,
      ...(targetScope === "profile" ? { target_profile_id: targetProfileId } : {}),
    }),
  });
  await parseResponse(response, "Failed to share lesson");
}

const CATALOG_FIELD_NAMES = [
  "category", "latitude", "longitude", "country_code", "icon_slug", "is_published",
  "recipe", "location_desc", "fun_facts", "audio_urls", "youtube_url", "trailer_url",
  "characters", "start_year", "end_year", "time_precision", "released_date",
  "rich_fields", "franchise_id", "quiz_required",
] as const;

function catalogFields(data: Partial<AdminItemFormData>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const key of CATALOG_FIELD_NAMES) {
    if (data[key] !== undefined) fields[key] = data[key];
  }
  return fields;
}

type EditableTranslation = ParentLessonDetail["translations"][number];

function formTranslations(data: Partial<AdminItemFormData>): EditableTranslation[] {
  const translations: EditableTranslation[] = [];
  for (const lang of ["en", "vi"] as const) {
    const title = data[`title_${lang}`]?.trim();
    if (!title) continue;
    const translation: EditableTranslation = { lang, title };
    const description = data[`description_${lang}`];
    const history = data[`history_${lang}`];
    if (description !== undefined) translation.description = description;
    if (history !== undefined) translation.history = history;
    translations.push(translation);
  }
  if (translations.length === 0) throw new Error("At least one lesson title is required");
  return translations;
}

function mergeTranslations(
  existing: EditableTranslation[],
  data: ParentLessonUpdateInput,
): EditableTranslation[] {
  const byLanguage = new Map<string, EditableTranslation>(existing.map(({ lang, title, description, history }) => [
    lang,
    { lang, title, ...(description !== undefined && description !== null ? { description } : {}),
      ...(history !== undefined && history !== null ? { history } : {}) },
  ]));
  for (const lang of ["en", "vi"] as const) {
    const titleKey = `title_${lang}` as const;
    const descriptionKey = `description_${lang}` as const;
    const historyKey = `history_${lang}` as const;
    if (!(titleKey in data) && !(descriptionKey in data) && !(historyKey in data)) continue;
    const previous = byLanguage.get(lang);
    const title = titleKey in data ? data[titleKey]?.trim() : previous?.title;
    if (!title) {
      byLanguage.delete(lang);
      continue;
    }
    byLanguage.set(lang, {
      lang,
      title,
      ...(descriptionKey in data ? (data[descriptionKey] !== undefined ? { description: data[descriptionKey] } : {})
        : previous?.description !== undefined ? { description: previous.description } : {}),
      ...(historyKey in data ? (data[historyKey] !== undefined ? { history: data[historyKey] } : {})
        : previous?.history !== undefined ? { history: previous.history } : {}),
    });
  }
  if (byLanguage.size === 0) throw new Error("At least one lesson title is required");
  return [...byLanguage.values()];
}
