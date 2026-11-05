import type {
  AdminAssessmentDetail,
  AdminAssessmentSummary,
  AdminCatalogItemDetail,
  AdminItemFormData,
  AdminItemSummary,
  AdminGenerateItemImageRequest,
  AdminGenerateItemImageResponse,
  AIEnrichRequest,
  AIGenerateRequest,
  AIGenerateResponse,
  FamilyOut,
  AdminProfileDetail,
  AdminActivityPage,
  AdminActivityType,
  AdminJourneyPage,
  AdminJourneyPeriod,
  AdminCatalogRefreshJob,
  AdminCatalogRefreshStatus,
} from "../types/admin.ts";
import type { AdminFlashcard } from "../types/flashcard.ts";
import { useAdminStore } from "../stores/adminStore.ts";
import { login, logout } from "./auth.ts";
import { coreRequest } from "./core.ts";

const MIGRATION_MESSAGE = "This administrator feature is temporarily unavailable while its Render API is being migrated.";

function notYetAvailable(): never {
  throw new Error(MIGRATION_MESSAGE);
}

export async function adminLogin(email: string, password: string): Promise<void> {
  await login(email, password);
}

export async function adminLogout(): Promise<void> {
  await logout();
  useAdminStore.getState().logout();
}

export async function adminFetchItems(): Promise<AdminItemSummary[]> {
  return coreRequest<AdminItemSummary[]>("/api/v1/admin/items");
}

export async function adminRefreshItems(): Promise<AdminCatalogRefreshJob> {
  return coreRequest<AdminCatalogRefreshJob>("/api/v1/admin/items/refresh", { method: "POST" });
}

export async function adminGetRefreshStatus(): Promise<AdminCatalogRefreshStatus> {
  return coreRequest<AdminCatalogRefreshStatus>("/api/v1/admin/items/refresh/status");
}

export async function adminAIGenerate(_data: AIGenerateRequest): Promise<AIGenerateResponse> {
  return notYetAvailable();
}

export async function adminAIEnrich(_data: AIEnrichRequest): Promise<AIGenerateResponse> {
  return notYetAvailable();
}

const CATALOG_FIELDS = [
  "category", "latitude", "longitude", "country_code", "icon_slug", "is_published",
  "recipe", "location_desc", "fun_facts", "audio_urls", "youtube_url", "trailer_url",
  "characters", "start_year", "end_year", "time_precision", "released_date",
  "rich_fields", "franchise_id", "quiz_required",
] as const;

function catalogFields(data: Partial<AdminItemFormData>): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  for (const field of CATALOG_FIELDS) {
    if (data[field] !== undefined) item[field] = data[field];
  }
  return item;
}

function catalogPayload(data: AdminItemFormData): Record<string, unknown> {
  const translations = (["en", "vi"] as const).flatMap((lang) => {
    const title = data[`title_${lang}`]?.trim();
    if (!title) return [];
    return [{
      lang,
      title,
      ...(data[`description_${lang}`] !== undefined ? { description: data[`description_${lang}`] } : {}),
      ...(data[`history_${lang}`] !== undefined ? { history: data[`history_${lang}`] } : {}),
    }];
  });
  if (translations.length === 0) throw new Error("At least one item title is required.");
  return { ...catalogFields(data), translations };
}

export async function adminCreateItem(data: AdminItemFormData): Promise<{ id: string; category: string; is_published: boolean }> {
  return coreRequest("/api/v1/admin/items", { method: "POST", body: JSON.stringify(catalogPayload(data)) });
}

export async function adminUpdateItem(itemId: string, data: Partial<AdminItemFormData>): Promise<{ id: string; category: string; is_published: boolean }> {
  const item: Record<string, unknown> = { id: itemId, ...catalogFields(data) };
  const translationFields = ["title_en", "description_en", "history_en", "title_vi", "description_vi", "history_vi"] as const;
  if (translationFields.some((field) => field in data)) {
    const current = await adminGetItem(itemId);
    type EditableTranslation = { lang: string; title: string; description?: string | null; history?: string | null };
    const translations = new Map<string, EditableTranslation>(current.translations.map(({ lang, title, description, history }) => [
      lang,
      { lang, title,
        ...(description != null ? { description } : {}),
        ...(history != null ? { history } : {}),
      },
    ]));
    for (const lang of ["en", "vi"] as const) {
      const titleKey = `title_${lang}` as const;
      const descriptionKey = `description_${lang}` as const;
      const historyKey = `history_${lang}` as const;
      if (!(titleKey in data) && !(descriptionKey in data) && !(historyKey in data)) continue;
      const previous = translations.get(lang);
      const title = titleKey in data ? data[titleKey]?.trim() : previous?.title;
      if (!title) {
        translations.delete(lang);
        continue;
      }
      translations.set(lang, {
        lang,
        title,
        ...(descriptionKey in data ? { description: data[descriptionKey] ?? null } : previous?.description !== undefined ? { description: previous.description } : {}),
        ...(historyKey in data ? { history: data[historyKey] ?? null } : previous?.history !== undefined ? { history: previous.history } : {}),
      });
    }
    if (translations.size === 0) throw new Error("At least one item title is required.");
    item.translations = [...translations.values()];
  }
  return coreRequest(`/api/v1/admin/items/${encodeURIComponent(itemId)}`, {
    method: "PUT", body: JSON.stringify({ item }),
  });
}

export async function adminGetItem(itemId: string): Promise<AdminCatalogItemDetail> {
  return coreRequest<AdminCatalogItemDetail>(`/api/v1/admin/items/${encodeURIComponent(itemId)}`);
}

export async function adminGenerateItemImage(_itemId: string, _data: AdminGenerateItemImageRequest = {}): Promise<AdminGenerateItemImageResponse> {
  return notYetAvailable();
}

export async function adminFetchFamilies(): Promise<FamilyOut[]> {
  return coreRequest<FamilyOut[]>("/api/v1/admin/families");
}

export async function adminFetchFamilyReports(familyId: string, signal?: AbortSignal): Promise<import('./parentReports').ParentReport> {
  const report = await coreRequest<import('./parentReports').ParentReport>(`/api/v1/admin/families/${encodeURIComponent(familyId)}/reports`, signal ? { signal } : {});
  const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  const totalKeys = ['children', 'exploring_completed', 'quiz_attempts', 'quiz_passes', 'earned_badges', 'study_sessions', 'drink_completions'] as const;
  const childKeys = ['exploring_completed', 'exploring_badges', 'quiz_attempts', 'quiz_passes', 'earned_badges'] as const;
  if (!report || !Array.isArray(report.children) || !report.totals || typeof report.generated_at !== 'string'
    || !Number.isFinite(Date.parse(report.generated_at)) || totalKeys.some(key => !count(report.totals[key]))
    || report.children.some(child => !child || typeof child.id !== 'string' || typeof child.name !== 'string'
      || childKeys.some(key => !count(child[key])) || !Array.isArray(child.games) || !Array.isArray(child.latest_items)
      || child.games.some(game => !game || typeof game.name !== 'string'
        || !['lifetime', 'current-expedition', 'current-town', 'recorded-study', 'unavailable'].includes(game.scope)
        || !Array.isArray(game.metrics) || !Array.isArray(game.achievements)
        || game.metrics.some(metric => !metric || typeof metric.label !== 'string' || !(metric.value === null || count(metric.value)))
        || game.achievements.some(badge => !badge || typeof badge.name !== 'string')))) {
    throw new Error('Learning report response is invalid. Try again.');
  }
  return report;
}

export async function adminCreateFamily(input: { name: string; email: string; password: string }, signal?: AbortSignal): Promise<{ id: string; display_name: string; email: string }> {
  return coreRequest("/api/v1/admin/families", { method: "POST", signal,
    body: JSON.stringify({ name: input.name.trim(), email: input.email.trim(), password: input.password }) });
}

export async function adminSetFamilyPassword(familyId: string, password: string, reason: string, signal?: AbortSignal): Promise<void> {
  return coreRequest<void>(`/api/v1/admin/families/${encodeURIComponent(familyId)}/password`, {
    method: "PUT", signal, body: JSON.stringify({ new_password: password, reason: reason.trim() }),
  });
}

function profileInspectionPath(familyId: string, profileId: string): string {
  return `/api/v1/admin/families/${encodeURIComponent(familyId)}/profiles/${encodeURIComponent(profileId)}`;
}

export function adminFetchProfile(familyId: string, profileId: string, signal?: AbortSignal): Promise<AdminProfileDetail> {
  return coreRequest(profileInspectionPath(familyId, profileId), signal ? { signal } : {});
}

export function adminFetchProfileActivities(familyId: string, profileId: string,
  query: { page: number; page_size: number; type: AdminActivityType }, signal?: AbortSignal): Promise<AdminActivityPage> {
  const params = new URLSearchParams({ page: String(query.page), page_size: String(query.page_size), type: query.type });
  return coreRequest(`${profileInspectionPath(familyId, profileId)}/activities?${params}`, signal ? { signal } : {});
}

export function adminFetchProfileJourney(familyId: string, profileId: string,
  query: { period: AdminJourneyPeriod; page: number; page_size: number }, signal?: AbortSignal): Promise<AdminJourneyPage> {
  const params = new URLSearchParams({ period: query.period, page: String(query.page), page_size: String(query.page_size) });
  return coreRequest(`${profileInspectionPath(familyId, profileId)}/journey?${params}`, signal ? { signal } : {});
}

export async function adminFetchTests(): Promise<AdminAssessmentSummary[]> {
  return coreRequest<AdminAssessmentSummary[]>("/api/v1/admin/tests");
}

export async function adminFetchTestDetail(itemId: string): Promise<AdminAssessmentDetail> {
  return coreRequest<AdminAssessmentDetail>(`/api/v1/admin/tests/${encodeURIComponent(itemId)}`);
}

export async function adminDeleteItem(itemId: string): Promise<void> {
  return coreRequest<void>(`/api/v1/admin/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
}

export async function adminFetchFlashcards(_itemId: string): Promise<AdminFlashcard[]> {
  return coreRequest<AdminFlashcard[]>(`/api/v1/admin/items/${encodeURIComponent(_itemId)}/flashcards`);
}

export async function adminCreateFlashcard(_itemId: string, _data: Partial<AdminFlashcard>): Promise<AdminFlashcard> {
  return coreRequest<AdminFlashcard>(`/api/v1/admin/items/${encodeURIComponent(_itemId)}/flashcards`, {
    method: "POST", body: JSON.stringify(_data),
  });
}

export async function adminUpdateFlashcard(_flashcardId: string, _data: Partial<AdminFlashcard>): Promise<AdminFlashcard> {
  return coreRequest<AdminFlashcard>(`/api/v1/admin/flashcards/${encodeURIComponent(_flashcardId)}`, {
    method: "PUT", body: JSON.stringify(_data),
  });
}

export async function adminDeleteFlashcard(_flashcardId: string): Promise<void> {
  return coreRequest<void>(`/api/v1/admin/flashcards/${encodeURIComponent(_flashcardId)}`, { method: "DELETE" });
}

export async function adminGenerateFlashcards(_itemId: string): Promise<{ created_count: number; cards: AdminFlashcard[] }> {
  return coreRequest<{ created_count: number; cards: AdminFlashcard[] }>(`/api/v1/admin/items/${encodeURIComponent(_itemId)}/flashcards/generate`, { method: "POST" });
}
