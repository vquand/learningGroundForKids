import type { ChatGPTUser } from "./identity.ts";
import { ensureSchema, requireDatabase, type D1Database, type WorkerEnv } from "./db.ts";

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

const MAX_PROFILE_COUNT = 5;
// Keep the complete seeded catalog available to the map while still bounding
// untrusted list requests. The local UAT seed currently contains 2,614 items;
// the ceiling leaves room for incremental additions without an unbounded query.
const MAX_ITEM_LIMIT = 5000;
const CATEGORIES = new Set([
  "food",
  "monument",
  "landmark",
  "music",
  "movie",
  "phenomenon",
  "animal",
]);

interface ProfileRow {
  id: string;
  name: string;
  emoji: string;
  color: string;
  public_id: string;
  native_country_code: string | null;
  native_city: string | null;
  avatar_type: string | null;
  avatar_url: string | null;
  created_at: string;
  total_done: number | null;
  badge_count: number | null;
}

interface ItemRow {
  id: string;
  category: string;
  latitude: number;
  longitude: number;
  country_code: string | null;
  icon_slug: string | null;
  start_year: number | null;
  end_year: number | null;
  quiz_required: number;
  has_quiz: number;
}

interface ItemDetailRow extends ItemRow {
  recipe: string | null;
  location_desc: string | null;
  fun_facts: string | null;
  audio_urls: string | null;
  youtube_url: string | null;
  trailer_url: string | null;
  characters: string | null;
  time_precision: string | null;
  released_date: string | null;
  rich_fields: string | null;
  franchise_id: string | null;
}

interface TranslationRow {
  lang: string;
  title: string;
  description: string | null;
  history: string | null;
}

interface MediaRow {
  id: string;
  media_type: string;
  label: string | null;
  filename: string;
  lang: string | null;
  sort_order: number;
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: JSON_HEADERS });
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

function methodNotAllowed(allow: string): Response {
  return new Response(
    JSON.stringify({ error: { code: "METHOD_NOT_ALLOWED", message: "method not allowed" } }),
    { status: 405, headers: { ...JSON_HEADERS, allow } },
  );
}

function storedJson(value: string | null, fallback: unknown): unknown {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mediaUrl(filename: string): string {
  // Public Wikimedia/other image URLs are stored as catalog metadata while
  // uploaded assets continue to use the authenticated R2 media route.
  return /^https:\/\//i.test(filename) ? filename : `/media/${filename}`;
}

function stringField(body: Record<string, unknown>, key: string, maxLength: number): string | null {
  const value = body[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

async function ensureFamily(db: D1Database, user: ChatGPTUser): Promise<void> {
  await db
    .prepare(
      `INSERT INTO families (id, email, display_name)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         display_name = excluded.display_name,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(user.id, user.email, user.name)
    .run();
}

function profileFromRow(row: ProfileRow): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    color: row.color,
    public_id: row.public_id,
    native_country_code: row.native_country_code ?? undefined,
    native_city: row.native_city ?? undefined,
    avatar_type: row.avatar_type ?? undefined,
    avatar_url: row.avatar_url ?? undefined,
    created_at: row.created_at,
    total_done: Number(row.total_done ?? 0),
    badge_count: Number(row.badge_count ?? 0),
  };
}

async function getProfile(db: D1Database, familyId: string, profileId: string): Promise<ProfileRow | null> {
  return db
    .prepare(
      `SELECT p.id, p.name, p.emoji, p.color, p.public_id,
              p.native_country_code, p.native_city, p.avatar_type, p.avatar_url,
              p.created_at,
              COUNT(DISTINCT pp.id) AS total_done,
              0 AS badge_count
       FROM profiles p
       LEFT JOIN profile_progress pp ON pp.profile_id = p.id
       WHERE p.id = ? AND p.family_id = ?
       GROUP BY p.id`,
    )
    .bind(profileId, familyId)
    .first<ProfileRow>();
}

async function listProfiles(db: D1Database, user: ChatGPTUser): Promise<Response> {
  const rows = await db
    .prepare(
      `SELECT p.id, p.name, p.emoji, p.color, p.public_id,
              p.native_country_code, p.native_city, p.avatar_type, p.avatar_url,
              p.created_at,
              COUNT(DISTINCT pp.id) AS total_done,
              0 AS badge_count
       FROM profiles p
       LEFT JOIN profile_progress pp ON pp.profile_id = p.id
       WHERE p.family_id = ?
       GROUP BY p.id
       ORDER BY p.created_at ASC
       LIMIT ?`,
    )
    .bind(user.id, MAX_PROFILE_COUNT)
    .all<ProfileRow>();
  return jsonResponse((rows.results ?? []).map(profileFromRow));
}

async function createProfile(db: D1Database, user: ChatGPTUser, request: Request): Promise<Response> {
  const body = await readBody(request);
  if (!body) return errorResponse(400, "INVALID_JSON", "Request body must be a JSON object.");

  const name = stringField(body, "name", 80);
  const emoji = stringField(body, "emoji", 16);
  const color = stringField(body, "color", 32);
  if (!name || !emoji || !color) {
    return errorResponse(400, "INVALID_PROFILE", "name, emoji, and color are required.");
  }

  const countRow = await db
    .prepare("SELECT COUNT(*) AS count FROM profiles WHERE family_id = ?")
    .bind(user.id)
    .first<{ count: number }>();
  if (Number(countRow?.count ?? 0) >= MAX_PROFILE_COUNT) {
    return errorResponse(409, "PROFILE_LIMIT_REACHED", "Maximum 5 profiles allowed.");
  }

  const id = crypto.randomUUID();
  const publicId = id.replaceAll("-", "").slice(0, 10).toUpperCase();
  const avatarType = typeof body.avatar_type === "string" ? body.avatar_type.slice(0, 16) : null;
  const avatarUrl = typeof body.avatar_url === "string" ? body.avatar_url.slice(0, 500) : null;
  const country = typeof body.native_country_code === "string" ? body.native_country_code.trim().slice(0, 2).toUpperCase() : null;
  const city = typeof body.native_city === "string" ? body.native_city.trim().slice(0, 120) || null : null;

  await db
    .prepare(
      `INSERT INTO profiles
       (id, family_id, name, emoji, color, public_id, native_country_code, native_city, avatar_type, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, user.id, name, emoji, color, publicId, country, city, avatarType, avatarUrl)
    .run();

  const profile = await getProfile(db, user.id, id);
  return profile ? jsonResponse(profileFromRow(profile), 201) : errorResponse(500, "PROFILE_CREATE_FAILED", "Profile could not be created.");
}

async function updateProfile(db: D1Database, user: ChatGPTUser, profileId: string, request: Request): Promise<Response> {
  const body = await readBody(request);
  if (!body) return errorResponse(400, "INVALID_JSON", "Request body must be a JSON object.");

  const assignments: string[] = [];
  const values: unknown[] = [];
  const fields: Array<[string, number]> = [
    ["name", 80],
    ["emoji", 16],
    ["color", 32],
    ["native_country_code", 2],
    ["native_city", 120],
  ];
  for (const [field, maxLength] of fields) {
    if (!(field in body)) continue;
    const value = body[field];
    if ((field === "name" || field === "emoji" || field === "color") && value === null) {
      return errorResponse(400, "INVALID_PROFILE", `${field} cannot be null.`);
    }
    if (value !== null && typeof value !== "string") {
      return errorResponse(400, "INVALID_PROFILE", `${field} must be a string or null.`);
    }
    const trimmed = typeof value === "string" ? value.trim() : null;
    if (trimmed !== null && trimmed.length > maxLength) {
      return errorResponse(400, "INVALID_PROFILE", `${field} is too long.`);
    }
    if ((field === "name" || field === "emoji" || field === "color") && !trimmed) {
      return errorResponse(400, "INVALID_PROFILE", `${field} cannot be empty.`);
    }
    const normalized = trimmed || null;
    assignments.push(`${field} = ?`);
    values.push(field === "native_country_code" && normalized ? normalized.toUpperCase() : normalized);
  }
  if (assignments.length === 0) return errorResponse(400, "NO_CHANGES", "No profile fields were provided.");

  values.push(profileId, user.id);
  const result = await db
    .prepare(`UPDATE profiles SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND family_id = ?`)
    .bind(...values)
    .run();
  if (!result) return errorResponse(500, "PROFILE_UPDATE_FAILED", "Profile could not be updated.");

  const profile = await getProfile(db, user.id, profileId);
  return profile ? jsonResponse(profileFromRow(profile)) : errorResponse(404, "PROFILE_NOT_FOUND", "Profile not found.");
}

async function deleteProfile(db: D1Database, user: ChatGPTUser, profileId: string): Promise<Response> {
  await db.prepare("DELETE FROM profiles WHERE id = ? AND family_id = ?").bind(profileId, user.id).run();
  return new Response(null, { status: 204, headers: JSON_HEADERS });
}

function itemSummary(row: ItemRow): Record<string, unknown> {
  return {
    id: row.id,
    category: row.category,
    latitude: row.latitude,
    longitude: row.longitude,
    country_code: row.country_code ?? undefined,
    title: "Untitled",
    icon_slug: row.icon_slug ?? "",
    start_year: row.start_year ?? undefined,
    end_year: row.end_year ?? undefined,
    has_quiz: Number(row.has_quiz) > 0,
    quiz_required: Boolean(row.quiz_required),
  };
}

async function hydrateTitles(db: D1Database, rows: ItemRow[]): Promise<Record<string, unknown>[]> {
  if (rows.length === 0) return [];
  const output = rows.map(itemSummary);
  const ids = rows.map((row) => row.id);
  const byItem = new Map<string, { lang: string; title: string }[]>();
  // D1/SQLite imposes a bound-variable limit. Keep the catalog query bounded
  // while avoiding one title query per item.
  for (let offset = 0; offset < ids.length; offset += 50) {
    const chunk = ids.slice(offset, offset + 50);
    const placeholders = chunk.map(() => "?").join(", ");
    const translations = await db
      .prepare(`SELECT item_id, lang, title FROM item_translations WHERE item_id IN (${placeholders}) ORDER BY lang`)
      .bind(...chunk)
      .all<{ item_id: string; lang: string; title: string }>();
    for (const translation of translations.results ?? []) {
      const current = byItem.get(translation.item_id) ?? [];
      current.push(translation);
      byItem.set(translation.item_id, current);
    }
  }
  for (const item of output) {
    const options = byItem.get(String(item.id)) ?? [];
    const translation = options.find((value) => value.lang === "en") ?? options[0];
    if (translation) item.title = translation.title;
  }
  return output;
}

async function listItems(db: D1Database, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const category = url.searchParams.get("category")?.trim().toLowerCase() ?? "";
  if (category && !CATEGORIES.has(category)) return errorResponse(400, "INVALID_CATEGORY", "Unknown item category.");
  // The legacy content contract returned the complete published catalog. Keep
  // that behavior for existing map/detail consumers while retaining a hard
  // upper bound for safety; callers can still request a smaller page.
  const rawLimit = Number(url.searchParams.get("limit") ?? MAX_ITEM_LIMIT);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), MAX_ITEM_LIMIT) : MAX_ITEM_LIMIT;
  const statement = category
    ? `SELECT i.id, i.category, i.latitude, i.longitude, i.country_code, i.icon_slug,
              i.start_year, i.end_year, i.quiz_required,
              EXISTS (SELECT 1 FROM quiz_questions q WHERE q.item_id = i.id AND q.is_active = 1) AS has_quiz
       FROM items i WHERE i.is_published = 1 AND i.category = ?
       ORDER BY i.created_at ASC LIMIT ?`
    : `SELECT i.id, i.category, i.latitude, i.longitude, i.country_code, i.icon_slug,
              i.start_year, i.end_year, i.quiz_required,
              EXISTS (SELECT 1 FROM quiz_questions q WHERE q.item_id = i.id AND q.is_active = 1) AS has_quiz
       FROM items i WHERE i.is_published = 1
       ORDER BY i.created_at ASC LIMIT ?`;
  const rows = category
    ? await db.prepare(statement).bind(category, limit).all<ItemRow>()
    : await db.prepare(statement).bind(limit).all<ItemRow>();
  return jsonResponse(await hydrateTitles(db, rows.results ?? []));
}

async function getItem(db: D1Database, request: Request, itemId: string): Promise<Response> {
  const url = new URL(request.url);
  const lang = (url.searchParams.get("lang")?.trim().toLowerCase() || "en").slice(0, 8);
  const row = await db
    .prepare(
      `SELECT i.*, EXISTS (SELECT 1 FROM quiz_questions q WHERE q.item_id = i.id AND q.is_active = 1) AS has_quiz
       FROM items i WHERE i.id = ? AND i.is_published = 1`,
    )
    .bind(itemId)
    .first<ItemDetailRow>();
  if (!row) return errorResponse(404, "ITEM_NOT_FOUND", "Item not found.");

  const translations = await db
    .prepare("SELECT lang, title, description, history FROM item_translations WHERE item_id = ? ORDER BY lang")
    .bind(itemId)
    .all<TranslationRow>();
  const translationRows = translations.results ?? [];
  const translation = translationRows.find((value) => value.lang === lang)
    ?? translationRows.find((value) => value.lang === "en")
    ?? translationRows[0]
    ?? null;

  const media = await db
    .prepare("SELECT id, media_type, label, filename, lang, sort_order FROM item_media WHERE item_id = ? ORDER BY sort_order ASC")
    .bind(itemId)
    .all<MediaRow>();
  const siblings = row.franchise_id
    ? await db
        .prepare(
          `SELECT i.id, COALESCE(
             (SELECT title FROM item_translations t WHERE t.item_id = i.id AND t.lang = 'en' LIMIT 1),
             (SELECT title FROM item_translations t WHERE t.item_id = i.id ORDER BY t.lang LIMIT 1),
             'Untitled'
           ) AS title
           FROM items i WHERE i.franchise_id = ? AND i.id <> ? AND i.is_published = 1`,
        )
        .bind(row.franchise_id, itemId)
        .all<{ id: string; title: string }>()
    : { results: [] as { id: string; title: string }[] };

  return jsonResponse({
    id: row.id,
    category: row.category,
    latitude: row.latitude,
    longitude: row.longitude,
    country_code: row.country_code ?? undefined,
    translation: translation
      ? { lang: translation.lang, title: translation.title, description: translation.description ?? undefined, history: translation.history ?? undefined }
      : undefined,
    media: (media.results ?? []).map((value) => ({
      id: value.id,
      media_type: value.media_type,
      label: value.label ?? undefined,
      filename: value.filename,
      url: mediaUrl(value.filename),
    })),
    available_languages: [...new Set(translationRows.map((value) => value.lang))].sort(),
    recipe: row.recipe ?? undefined,
    location_desc: row.location_desc ?? undefined,
    fun_facts: storedJson(row.fun_facts, undefined),
    audio_urls: storedJson(row.audio_urls, undefined),
    youtube_url: row.youtube_url ?? undefined,
    trailer_url: row.trailer_url ?? undefined,
    characters: storedJson(row.characters, undefined),
    start_year: row.start_year ?? undefined,
    end_year: row.end_year ?? undefined,
    time_precision: row.time_precision ?? undefined,
    released_date: row.released_date ?? undefined,
    rich_fields: storedJson(row.rich_fields, undefined),
    franchise_id: row.franchise_id ?? undefined,
    franchise_siblings: siblings.results?.length ? siblings.results : undefined,
    quiz_required: Boolean(row.quiz_required),
  });
}

async function requireProfile(db: D1Database, user: ChatGPTUser, profileId: string): Promise<ProfileRow | null> {
  return getProfile(db, user.id, profileId);
}

async function getProgress(db: D1Database, user: ChatGPTUser, profileId: string): Promise<Response> {
  if (!(await requireProfile(db, user, profileId))) return errorResponse(404, "PROFILE_NOT_FOUND", "Profile not found.");
  const rows = await db
    .prepare("SELECT item_id FROM profile_progress WHERE profile_id = ? ORDER BY done_at DESC")
    .bind(profileId)
    .all<{ item_id: string }>();
  return jsonResponse({ done_item_ids: (rows.results ?? []).map((row) => row.item_id), wip_item_ids: [] });
}

async function getProgressStatus(db: D1Database, user: ChatGPTUser, profileId: string, itemId: string): Promise<Response> {
  if (!(await requireProfile(db, user, profileId))) return errorResponse(404, "PROFILE_NOT_FOUND", "Profile not found.");
  const row = await db
    .prepare("SELECT 1 AS done FROM profile_progress WHERE profile_id = ? AND item_id = ? LIMIT 1")
    .bind(profileId, itemId)
    .first<{ done: number }>();
  return jsonResponse({ done: Boolean(row) });
}

async function markProgress(db: D1Database, user: ChatGPTUser, profileId: string, itemId: string): Promise<Response> {
  if (!(await requireProfile(db, user, profileId))) return errorResponse(404, "PROFILE_NOT_FOUND", "Profile not found.");
  const item = await db.prepare("SELECT category, quiz_required FROM items WHERE id = ? AND is_published = 1").bind(itemId).first<{ category: string; quiz_required: number }>();
  if (!item) return errorResponse(404, "ITEM_NOT_FOUND", "Item not found.");

  const existing = await db.prepare("SELECT id FROM profile_progress WHERE profile_id = ? AND item_id = ?").bind(profileId, itemId).first<{ id: string }>();
  if (existing) return jsonResponse({ status: "done", already_done: true, newly_earned_badges: [] });

  if (Number(item.quiz_required) > 0) {
    const passed = await db
      .prepare("SELECT 1 AS passed FROM quiz_attempts WHERE profile_id = ? AND item_id = ? AND total > 0 AND score * 1.0 / total >= 0.8 LIMIT 1")
      .bind(profileId, itemId)
      .first<{ passed: number }>();
    if (!passed) return jsonResponse({ status: "quiz_required", already_done: false, newly_earned_badges: [] });
  }

  await db
    .prepare("INSERT INTO profile_progress (id, profile_id, item_id, category) VALUES (?, ?, ?, ?) ON CONFLICT(profile_id, item_id) DO NOTHING")
    .bind(crypto.randomUUID(), profileId, itemId, item.category)
    .run();
  return jsonResponse({ status: "done", already_done: false, newly_earned_badges: [] });
}

async function deleteProgress(db: D1Database, user: ChatGPTUser, profileId: string, itemId: string): Promise<Response> {
  if (!(await requireProfile(db, user, profileId))) return errorResponse(404, "PROFILE_NOT_FOUND", "Profile not found.");
  await db.prepare("DELETE FROM profile_progress WHERE profile_id = ? AND item_id = ?").bind(profileId, itemId).run();
  return new Response(null, { status: 204, headers: JSON_HEADERS });
}

function routeSegments(pathname: string): string[] {
  return pathname.replace(/^\/api\/v1\/?/, "").split("/").filter(Boolean);
}

export function isCoreApiPath(pathname: string): boolean {
  return pathname === "/api/v1/health/live"
    || pathname === "/api/v1/health/ready"
    || pathname === "/api/v1/auth/session"
    || pathname === "/api/v1/profiles"
    || pathname.startsWith("/api/v1/profiles/")
    || pathname === "/api/v1/items"
    || pathname.startsWith("/api/v1/items/");
}

export async function handleCoreApi(request: Request, env: WorkerEnv, user: ChatGPTUser | null): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/v1/health/live") {
    return request.method === "GET" ? jsonResponse({ status: "ok" }) : methodNotAllowed("GET");
  }

  if (pathname === "/api/v1/health/ready") {
    if (request.method !== "GET") return methodNotAllowed("GET");
    try {
      const db = requireDatabase(env);
      await ensureSchema(db);
      return jsonResponse({ status: "ready" });
    } catch {
      return errorResponse(503, "DATABASE_NOT_CONFIGURED", "The learning database is not configured.");
    }
  }

  if (!user) return errorResponse(401, "AUTHENTICATION_REQUIRED", "Sign in with ChatGPT to continue.");

  let db: D1Database;
  try {
    db = requireDatabase(env);
    await ensureSchema(db);
    await ensureFamily(db, user);
  } catch {
    return errorResponse(503, "DATABASE_NOT_CONFIGURED", "The learning database is not configured.");
  }

  try {
    const segments = routeSegments(pathname);
    if (segments[0] === "profiles" && segments.length === 1) {
      if (request.method === "GET") return listProfiles(db, user);
      if (request.method === "POST") return createProfile(db, user, request);
      return methodNotAllowed("GET, POST");
    }
    if (segments[0] === "profiles" && segments[1]) {
      const profileId = segments[1];
      if (segments.length === 2) {
        if (request.method === "PUT") return updateProfile(db, user, profileId, request);
        if (request.method === "DELETE") return deleteProfile(db, user, profileId);
        return methodNotAllowed("PUT, DELETE");
      }
      if (segments[2] === "progress") {
        if (segments.length === 3 && request.method === "GET") return getProgress(db, user, profileId);
        if (segments.length === 4 && segments[3]) {
          if (request.method === "GET") return getProgressStatus(db, user, profileId, segments[3]);
          if (request.method === "POST") return markProgress(db, user, profileId, segments[3]);
          if (request.method === "DELETE") return deleteProgress(db, user, profileId, segments[3]);
          return methodNotAllowed("GET, POST, DELETE");
        }
      }
    }
    if (segments[0] === "items" && segments.length === 1 && request.method === "GET") return listItems(db, request);
    if (segments[0] === "items" && segments[1] && segments.length === 2 && request.method === "GET") return getItem(db, request, segments[1]);
    return errorResponse(404, "NOT_FOUND", "The requested resource was not found.");
  } catch {
    return errorResponse(500, "DATABASE_ERROR", "The learning data could not be loaded.");
  }
}
