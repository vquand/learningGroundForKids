import { LEGAL_VERSION } from "./legal.js";
import { registerCalendarPeopleRoutes } from './calendar/participants.js';
import { WeatherService } from './calendar/weather.js';
import { registerCalendarRoutes } from './calendar/routes.js';
import { registerCalendarEventRoutes } from './calendar/events.js';
import { registerParentCalendarRoutes } from './calendar/parent.js';
import { registerCalendarMealRoutes } from './calendar/meals.js';
import { registerCalendarNotificationRoutes } from './calendar/notifications.js';
import { z } from 'zod';
import { registerRoadRacingRoutes } from './road-racing/routes.js';
import { registerAdventureRoutes } from './adventures/routes.js';
import { assertMapResponseSize, parseMapLeavesQuery, parseMapViewQuery } from './explore/http.js';
import { registerKitchenRoutes } from './kitchen/routes.js';
import { registerOnboardingRoutes } from './onboarding.js';
import { GOOGLE_ONLY_PASSWORD } from './google-auth/repository.js';
import { registerParentReportRoutes } from './parent-reports/routes.js';
import { registerGoogleRoutes } from './google-auth/routes.js';
import { registerTownRoutes } from './town-building/routes.js';
import { registerInfinidrillRoutes } from './infinidrill/routes.js';
import { registerMinikuRoutes } from './miniku/routes.js';
import { registerFishingRoutes } from './fishing/routes.js';
import { enforceScheduleLock, registerScheduleRoutes, TIMEZONE_HEADER } from './schedule/routes.js';
import { registerUfoRoutes } from './ufo/routes.js';
import { registerMathWallRoutes } from './math-wall/routes.js';
import { ACHIEVEMENT_GROUPS, achievementGroupStatus } from './achievement-catalog.js';
import { randomUUID } from "node:crypto";
import type { BlockList } from "node:net";
import { Hono, type Context, type Next } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppConfig } from "./config.js";
import type {
  AppDatabase,
  BadgeRecord,
  FamilyRecord,
  ItemDetailRecord,
  ItemSummaryRecord,
  ProfileRecord,
} from "./contracts/db.js";
import { AppError, toAppError } from "./errors.js";
import {
  createFamilySession,
  clearSessionCookie,
  deleteCurrentSession,
  findSessionFamily,
  getSessionToken,
  hashPassword,
  hashSessionToken,
  registerFamily,
  toPublicUser,
  verifyPassword,
} from "./auth.js";
import {
  categorySchema,
  catalogItemBatchUpdateSchema,
  catalogItemCreateSchema,
  catalogItemSingleUpdateSchema,
  parentLessonUpdateSchema,
  parentLessonShareSchema,
  flashcardStudySessionSchema,
  flashcardThemeSchema,
  loginSchema,
  rootPasswordSchema,
  adminFamilyPasswordSchema,
  parseJson,
  parseLimit,
  parsePathId,
  languageSchema,
  profileCreateSchema,
  profileUpdateSchema,
  parentSystemDisabledSchema,
  parentLessonCreateSchema,
  registerSchema,
  adminRegisterSchema,
  quizSubmitSchema,
  dailyQuizSubmitSchema,
  friendRequestCreateSchema,
  friendRequestRespondSchema,
  adminQuizQuestionSchema,
  adminFlashcardCreateSchema,
  adminFlashcardUpdateSchema,
  adminActivityQuerySchema,
  adminJourneyQuerySchema,
  adminProfileQuerySchema,
  parseAdminQuery,
} from "./input.js";
import { publicQuizQuestion } from "./quiz.js";
import {
  avatarObjectKey,
  InvalidAvatarError,
  limitMediaStream,
  MAX_AVATAR_BYTES,
  MediaTooLargeError,
  parseMediaKey,
  validateAvatarUpload,
} from "./media.js";
import { safeLogger } from "./logger.js";
import { FRIEND_REQUEST_MAX_LIST, friendRequestResponse } from "./social.js";
import { geocodeHome } from "./geocode.js";
import { authClientAddress, trustedProxyRanges } from "./client-address.js";
import { isRootAccount, ROOT_ACCOUNT_EMAIL, ROOT_ACCOUNT_ID, verifyRootFallback } from "./root-account.js";
import { CatalogRefreshJobManager } from "./catalog-refresh-job.js";
import { registerPasskeyRoutes } from "./passkeys.js";

import type { App, AppDependencies, AppVariables } from './contracts/app.js';
export type { App, AppDependencies } from './contracts/app.js';
import { AuthRateLimiter } from './auth-rate-limiter.js';
export { AuthRateLimiter } from './auth-rate-limiter.js';

const MAX_PROFILE_COUNT = 5;
const MAX_ITEM_LIMIT = 5000;
const MAX_AVATAR_REQUEST_BYTES = MAX_AVATAR_BYTES + 64 * 1024;

function isAvatarUploadPath(pathname: string): boolean {
  return /^\/api\/v1\/profiles\/[^/]+\/avatar$/.test(pathname);
}

async function readBoundedBody(request: Request, maximum: number): Promise<Uint8Array> {
  if (!request.body) throw new AppError(400, "INVALID_AVATAR", "Choose an image to upload.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) {
        await reader.cancel("avatar upload size limit exceeded");
        throw new AppError(413, "REQUEST_TOO_LARGE", "Avatar upload is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function json(c: Context, body: unknown, status: ContentfulStatusCode = 200): Response {
  return c.json(body, status);
}

function error(c: Context, status: number, code: string, message: string, details?: unknown): Response {
  return json(c, { error: { code, message, ...(details === undefined ? {} : { details }) } }, status as ContentfulStatusCode);
}

function methodNotAllowed(c: Context, allow: string): Response {
  c.header("allow", allow);
  return error(c, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
}

function normalizedOrigin(value: string): string {
  return value.replace(/\/$/, "").toLowerCase();
}

function hostWithoutPort(value: string): string {
  const first = value.split(",", 1)[0]?.trim().toLowerCase() ?? "";
  if (first.startsWith("[")) return first.slice(1, first.indexOf("]"));
  return first.split(":", 1)[0] ?? first;
}

function effectiveRequestHost(c: Context, config: AppConfig): string {
  const directHost = hostWithoutPort(c.req.header("host") ?? new URL(c.req.url).host);
  const isTrustedRenderProxy = config.trustProxyHeaders
    && config.renderExternalHostname !== undefined
    && directHost === config.renderExternalHostname;
  const forwardedHost = c.req.header("x-forwarded-host");
  return isTrustedRenderProxy && forwardedHost ? hostWithoutPort(forwardedHost) : directHost;
}

function isAllowedRequestHost(c: Context, config: AppConfig): boolean {
  const directHost = hostWithoutPort(c.req.header("host") ?? new URL(c.req.url).host);
  const effectiveHost = effectiveRequestHost(c, config);
  return config.allowedForwardedHosts.has(effectiveHost)
    || (config.renderExternalHostname !== undefined && directHost === config.renderExternalHostname && effectiveHost === directHost);
}

function requestNeedsAuthentication(pathname: string): boolean {
  return pathname === "/media"
    || pathname.startsWith("/media/")
    || pathname === "/api/v1/items"
    || pathname.startsWith("/api/v1/items/")
    || pathname === "/api/v1/profiles"
    || pathname.startsWith("/api/v1/profiles/")
    || pathname.startsWith("/api/v1/family/onboarding")
    || pathname === "/api/v1/activity/recent"
    || pathname === "/api/v1/calendar"
    || pathname.startsWith("/api/v1/calendar/")
    || pathname === "/api/v1/parent"
    || pathname.startsWith("/api/v1/parent/")
    || pathname === "/api/v1/friend-requests"
    || pathname.startsWith("/api/v1/friend-requests/")
    || pathname === "/api/v1/geocode/home"
    || pathname === "/api/v1/admin"
    || pathname.startsWith("/api/v1/admin/");
}


function clientRateKey(c: Context, deps: AppDependencies, trusted: BlockList): string {
  const config = deps.config;
  const directHost = hostWithoutPort(c.req.header("host") ?? new URL(c.req.url).host);
  const isTrustedRenderProxy = config.trustProxyHeaders
    && config.renderExternalHostname !== undefined
    && directHost === config.renderExternalHostname;
  const address = authClientAddress(deps.clientAddress?.(c),
    isTrustedRenderProxy ? c.req.header("x-forwarded-for") : undefined, trusted);
  return address ? `client:${address}` : "unknown-client";
}

function requestId(c: Context): string {
  return c.get("requestId");
}

function dateString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function profileResponse(profile: ProfileRecord): Record<string, unknown> {
  return {
    id: profile.id,
    name: profile.name,
    emoji: profile.emoji,
    color: profile.color,
    public_id: profile.public_id,
    ...(profile.native_country_code ? { native_country_code: profile.native_country_code } : {}),
    ...(profile.native_city ? { native_city: profile.native_city } : {}),
    ...(profile.avatar_type ? { avatar_type: profile.avatar_type } : {}),
    ...(profile.avatar_url ? { avatar_url: profile.avatar_url } : {}),
    ...(profile.avatar_frame ? { avatar_frame: profile.avatar_frame } : {}),
    created_at: dateString(profile.created_at),
    total_done: Number(profile.total_done ?? 0),
    badge_count: Number(profile.badge_count ?? 0),
  };
}

function badgeResponse(badge: BadgeRecord): Record<string, unknown> {
  return {
    id: badge.id,
    badge_key: badge.badge_key,
    badge_type: badge.badge_type,
    milestone: badge.milestone,
    earned_at: dateString(badge.earned_at),
    name: badge.name ?? "",
    description: badge.description ?? "",
  };
}

async function profileWithBadgeCount(db: AppDatabase, familyId: string, profile: ProfileRecord) {
  const badges = await db.progress.badges(familyId, profile.id);
  return profileResponse({ ...profile, badge_count: badges.length });
}

function itemSummaryResponse(item: ItemSummaryRecord): Record<string, unknown> {
  return {
    id: item.id,
    category: item.category,
    latitude: item.latitude,
    longitude: item.longitude,
    ...(item.country_code ? { country_code: item.country_code } : {}),
    title: item.title,
    icon_slug: item.icon_slug,
    ...(item.start_year !== null && item.start_year !== undefined ? { start_year: item.start_year } : {}),
    ...(item.end_year !== null && item.end_year !== undefined ? { end_year: item.end_year } : {}),
    has_quiz: item.has_quiz,
    quiz_required: item.quiz_required,
  };
}

function itemDetailResponse(item: ItemDetailRecord): Record<string, unknown> {
  const output: Record<string, unknown> = itemSummaryResponse(item);
  if (item.translation) {
    output.translation = {
      lang: item.translation.lang,
      title: item.translation.title,
      ...(item.translation.description ? { description: item.translation.description } : {}),
      ...(item.translation.history ? { history: item.translation.history } : {}),
    };
  }
  output.media = item.media.map((media) => ({
    id: media.id,
    media_type: media.media_type,
    ...(media.label ? { label: media.label } : {}),
    filename: media.filename,
    url: media.url ?? (/^https:\/\//i.test(media.filename) ? media.filename : `/media/${media.filename}`),
  }));
  output.available_languages = item.available_languages;
  const optionalFields = [
    "recipe", "location_desc", "fun_facts", "audio_urls", "youtube_url", "trailer_url",
    "characters", "time_precision", "released_date", "rich_fields", "franchise_id", "franchise_siblings",
  ] as const;
  for (const field of optionalFields) {
    const value = item[field];
    if (value !== undefined && value !== null) output[field] = value;
  }
  return output;
}

function quizResponse(quiz: { questions: import("./contracts/db.js").QuizQuestionRecord[]; difficulty: "Easy" | "Medium" | "Hard" }): Record<string, unknown> {
  return {
    questions: quiz.questions.map(publicQuizQuestion),
    difficulty: quiz.difficulty,
  };
}

function requestLanguage(c: Context): string {
  const raw = new URL(c.req.url).searchParams.get("lang") ?? "en";
  const result = languageSchema.safeParse(raw);
  if (!result.success) throw new AppError(422, "VALIDATION_ERROR", "lang must be a valid language code.");
  return result.data;
}

function currentUtcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function requestFlashcardTheme(c: Context): { themeType: import("./contracts/db.js").FlashcardThemeType; themeValue: string } {
  const url = new URL(c.req.url);
  const parsedType = flashcardThemeSchema.safeParse(url.searchParams.get("theme_type"));
  const themeValue = url.searchParams.get("theme_value")?.trim() ?? "";
  if (!parsedType.success || themeValue.length < 1 || themeValue.length > 128) {
    throw new AppError(422, "VALIDATION_ERROR", "theme_type and theme_value must identify a valid flashcard theme.");
  }
  return { themeType: parsedType.data, themeValue };
}

function flashcardSessionResponse(session: import("./contracts/db.js").FlashcardStudySessionRecord): Record<string, unknown> {
  return {
    id: session.id,
    profile_id: session.profile_id,
    ...(session.focus_item_id ? { focus_item_id: session.focus_item_id } : {}),
    theme_type: session.theme_type,
    theme_value: session.theme_value,
    lang: session.lang,
    cards_shown: session.cards_shown,
    got_it_count: session.got_it_count,
    review_again_count: session.review_again_count,
    responses: session.responses,
    started_at: session.started_at.toISOString(),
    completed_at: session.completed_at.toISOString(),
  };
}

async function authenticatedFamily(c: Context, db: AppDatabase, config: AppConfig): Promise<FamilyRecord | null> {
  try {
    return await findSessionFamily(c, db, config);
  } catch {
    throw new AppError(503, "DATABASE_UNAVAILABLE", "The learning database is unavailable.");
  }
}

async function requireOwnedProfile(c: Context, db: AppDatabase, profileId: string): Promise<ProfileRecord> {
  const family = c.get("family");
  const profile = await db.profiles.get(family.id, profileId);
  if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found.");
  return profile;
}

function requireAdminFamily(c: Context): FamilyRecord {
  const family = c.get("family");
  if (family.role !== "admin") {
    throw new AppError(403, "ADMIN_REQUIRED", "Administrator access is required.");
  }
  return family;
}

async function handleMedia(c: Context, deps: AppDependencies): Promise<Response> {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") return methodNotAllowed(c, "GET, HEAD");
  const key = parseMediaKey(new URL(c.req.url).pathname);
  if (!key) return error(c, 400, "INVALID_MEDIA_PATH", "The media path is invalid.");
  if (key.startsWith("profile-avatars/")) {
    const parts = key.split("/");
    const familyId = c.get("family").id;
    if (parts.length !== 4 || !parts[1] || !parts[2] || !parts[3]) {
      return error(c, 404, "MEDIA_NOT_FOUND", "Media not found.");
    }
    const visitor=c.req.query('townVisitor');
    const avatar=parts[1]===familyId
      ?(await deps.db.profiles.get(familyId,parts[2]))?.avatar_url
      :visitor?await deps.db.townVisits?.avatar(familyId,visitor,parts[2]):null;
    const friendAvatar=!visitor&&parts[1]!==familyId&&await deps.db.friendRequests?.canReadAvatar?.(familyId,key);
    if (avatar !== `/media/${key}` && !friendAvatar) {
      return error(c, 404, "MEDIA_NOT_FOUND", "Media not found.");
    }
  } else if (!await deps.db.items.canReadMedia(c.get("family").id, key, c.get("family").role === "admin")) {
    return error(c, 404, "MEDIA_NOT_FOUND", "Media not found.");
  }
  if (!deps.media) return error(c, 503, "MEDIA_NOT_CONFIGURED", "Media storage is not configured.");
  try {
    const object = await deps.media.get(key);
    if (!object) return error(c, 404, "MEDIA_NOT_FOUND", "Media not found.");
    if (object.contentLength !== undefined && object.contentLength > deps.config.maxMediaBytes) {
      await object.body.cancel().catch(() => {});
      return error(c, 413, "MEDIA_TOO_LARGE", "Media object exceeds the allowed size.");
    }
    const headers = new Headers({
      // A friend's photo must stop loading when the friendship ends; the family's own photos may be cached.
      "cache-control": key.startsWith('profile-avatars/')&&key.split("/")[1]!==c.get("family").id?'private, no-store':"private, max-age=3600",
      "x-content-type-options": "nosniff",
    });
    if (object.contentType) headers.set("content-type", object.contentType);
    if (object.contentLength !== undefined) headers.set("content-length", String(object.contentLength));
    if (object.etag) headers.set("etag", object.etag);
    if (c.req.method === "HEAD") await object.body.cancel().catch(() => {});
    const body = c.req.method === "HEAD" ? null : limitMediaStream(object.body, deps.config.maxMediaBytes);
    return new Response(body, { status: 200, headers });
  } catch (caught) {
    if (caught instanceof MediaTooLargeError) {
      return error(c, 413, "MEDIA_TOO_LARGE", "Media object exceeds the allowed size.");
    }
    return error(c, 502, "MEDIA_UNAVAILABLE", "Media storage is temporarily unavailable.");
  }
}

export function createApp(deps: AppDependencies): App {
  const app: App = new Hono<{ Variables: AppVariables }>();
  const logger = deps.logger ?? safeLogger;
  const catalogRefreshJobs = deps.catalogRefreshJobs ?? new CatalogRefreshJobManager(logger);
  const trusted = trustedProxyRanges(deps.config.authTrustedProxyCidrs);
  const authLimiter = new AuthRateLimiter(
    deps.config.authRateLimitMax,
    deps.config.authRateLimitWindowSeconds * 1000,
    deps.config.authRateLimitMaxKeys,
  );

  app.use("*", async (c, next: Next) => {
    const id = randomUUID();
    c.set("requestId", id);
    c.header("x-request-id", id);
    c.header("x-content-type-options", "nosniff");
    c.header("x-frame-options", "DENY");
    c.header("referrer-policy", "no-referrer");
    c.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
    c.header("content-security-policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    c.header("cache-control", "no-store");
    if (deps.config.nodeEnv === "production") c.header("strict-transport-security", "max-age=31536000; includeSubDomains");

    const origin = c.req.header("origin");
    if (origin) {
      const normalized = normalizedOrigin(origin);
      if (deps.config.allowedOrigins.size > 0 && !deps.config.allowedOrigins.has(normalized)) {
        return error(c, 403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed.");
      }
      if (deps.config.allowedOrigins.has(normalized)) {
        c.header("access-control-allow-origin", origin);
        c.header("access-control-allow-credentials", "true");
      }
      c.header("vary", "Origin");
    }

    if (!isAllowedRequestHost(c, deps.config)) {
      return error(c, 421, "HOST_NOT_ALLOWED", "Host is not allowed.");
    }

    const pathname = new URL(c.req.url).pathname;
    const bodyLimit = isAvatarUploadPath(pathname) && c.req.method === "POST"
      ? MAX_AVATAR_REQUEST_BYTES : deps.config.maxBodyBytes;
    const contentLength = Number(c.req.header("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > bodyLimit) {
      return error(c, 413, "REQUEST_TOO_LARGE", "Request body is too large.");
    }

    if (((pathname === "/api/v1/auth/google/start" || pathname === "/api/v1/parent/google/password" || pathname === "/api/v1/auth/login" || pathname === "/api/v1/auth/register" || pathname === "/api/v1/admin/families"
      || pathname === "/api/v1/auth/passkey/options" || pathname === "/api/v1/auth/passkey/verify"
      || pathname === "/api/v1/parent/access/password" || pathname === "/api/v1/parent/access/passkey/options"
      || pathname === "/api/v1/parent/access/passkey/verify" || pathname === "/api/v1/parent/passkeys/options"
      || pathname === "/api/v1/parent/passkeys/verify") && c.req.method === "POST")
      || (pathname === "/api/v1/auth/google/callback" && c.req.method === "GET")
      || (pathname === "/api/v1/admin/root/password" && c.req.method === "PATCH")
      || (/^\/api\/v1\/admin\/families\/[^/]+\/password$/.test(pathname) && c.req.method === "PUT")) {
      const limited = authLimiter.check(clientRateKey(c, deps, trusted));
      if (!limited.allowed) {
        c.header("retry-after", String(limited.retryAfterSeconds));
        return error(c, 429, "RATE_LIMITED", "Too many authentication attempts.");
      }
    }

    const started = Date.now();
    try {
      if (requestNeedsAuthentication(pathname)) {
        const family = await authenticatedFamily(c, deps.db, deps.config);
        if (!family) return error(c, 401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
        c.set("family", family);
        if (family.passwordHash===GOOGLE_ONLY_PASSWORD && !['/api/v1/parent/access','/api/v1/parent/access/lock','/api/v1/parent/google','/api/v1/parent/google/password'].includes(pathname)) {
          return error(c,403,'PARENT_SETUP_REQUIRED','Set a parent password before children start playing.');
        }
        // Admins may be parents of their own family; the capability stays session-bound.
        const isParentAccess = pathname === "/api/v1/parent/access" || pathname.startsWith("/api/v1/parent/access/");
        if (pathname.startsWith("/api/v1/parent/") && !isParentAccess) {
          const token = getSessionToken(c, deps.config);
          const access = token && await deps.db.auth.parentAccess(hashSessionToken(token), family.id, new Date());
          if (!access || (access.method==='google' && family.passwordHash!==GOOGLE_ONLY_PASSWORD)) return error(c, 403, "PARENT_ACCESS_REQUIRED", "Confirm parent access again.");
        }
      }
      if (c.get("family") && (pathname.startsWith("/api/v1/profiles/") || pathname.startsWith("/api/v1/items"))) {
        await enforceScheduleLock(deps.db, c.get("family").id, c.req.method, pathname, c.req.header(TIMEZONE_HEADER) ?? null, new Date(), async () => {
          const token = getSessionToken(c, deps.config);
          return Boolean(token && await deps.db.auth.parentAccess(hashSessionToken(token), c.get("family").id, new Date()));
        }, new URL(c.req.url).searchParams.get("profile_id"));
      }
      await next();
      logger.info("request completed", {
        requestId: id,
        method: c.req.method,
        path: pathname,
        status: c.res.status,
        durationMs: Date.now() - started,
      });
    } catch (caught) {
      const appError = toAppError(caught);
      logger.error("request failed", {
        requestId: id,
        method: c.req.method,
        path: pathname,
        status: appError.status,
        durationMs: Date.now() - started,
        code: appError.code,
        ...(caught instanceof Error && caught.stack ? { stack: caught.stack } : {}),
      });
      return error(c, appError.status, appError.code, appError.safeMessage, appError.details);
    }
  });

  registerUfoRoutes(app, deps.db, deps.config.maxBodyBytes, requireOwnedProfile, requireAdminFamily);
  registerRoadRacingRoutes(app, deps.db, deps.config.maxBodyBytes, requireOwnedProfile);
  registerMathWallRoutes(app, deps.db, deps.config.maxBodyBytes, requireOwnedProfile);
  registerInfinidrillRoutes(app, deps.db, deps.config.maxBodyBytes, requireOwnedProfile);
  registerMinikuRoutes(app, deps.db, deps.config.maxBodyBytes, requireOwnedProfile, requireAdminFamily);
  registerCalendarPeopleRoutes(app, deps.db, deps.config.maxBodyBytes, requireOwnedProfile);
  registerCalendarEventRoutes(app, deps.db, deps.config.maxBodyBytes, requireOwnedProfile);
  registerCalendarRoutes(app, deps.db, deps.config.maxBodyBytes, requireOwnedProfile,
    deps.weather === null ? null : deps.weather ?? new WeatherService({
      ...(deps.weatherFetch ? { fetch: deps.weatherFetch } : {}),
      ...(deps.weatherClock ? { clock: deps.weatherClock } : {}),
      ...(deps.geocoder ? { geocoder: deps.geocoder } : {}),
      ...(deps.config.weather ? { config: deps.config.weather } : {}),
    }), deps.weatherClock);
  registerCalendarMealRoutes(app, deps.db, deps.config.maxBodyBytes, requireOwnedProfile);
  registerCalendarNotificationRoutes(app, deps.db);
  registerScheduleRoutes(app, deps.db, deps.config.maxBodyBytes, requireOwnedProfile);
  registerFishingRoutes(app, deps.db, deps.config.maxBodyBytes, requireOwnedProfile);
  registerAdventureRoutes(app, deps.db, requireOwnedProfile);
  registerKitchenRoutes(app, deps.db, deps.config, requireOwnedProfile);
  registerTownRoutes(app, deps.db, deps.config, requireOwnedProfile);
  registerParentReportRoutes(app, deps.db);
  registerParentCalendarRoutes(app, deps.db, requireOwnedProfile);
  registerOnboardingRoutes(app, deps.db, deps.config);
  registerPasskeyRoutes(app, deps);
  registerGoogleRoutes(app, deps);

  app.all("/api/v1/health/live", (c) => c.req.method === "GET"
    ? json(c, { status: "ok" })
    : methodNotAllowed(c, "GET"));

  app.all("/api/v1/health/ready", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    try {
      await deps.db.ping();
      // Local startup must distinguish a database-ready but stale API from
      // one that actually supports the frontend's gardening requests.
      if (deps.config.nodeEnv === "development" && deps.db.town?.tick && deps.db.town?.checkpoint) {
        c.header("x-plg-dev-gardening", "ready");
      }
      return json(c, { status: "ready" });
    } catch {
      return error(c, 503, "DATABASE_UNAVAILABLE", "The learning database is unavailable.");
    }
  });

  app.all("/api/v1/auth/session", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    const family = await authenticatedFamily(c, deps.db, deps.config);
    if (!family) return json(c, { authenticated: false });
    return json(c, {
      authenticated: true,
      user: toPublicUser(family),
      ...(family.role === "family" && family.onboardingDismissed === false ? { onboarding: true } : {}),
      ...(family.passwordHash===GOOGLE_ONLY_PASSWORD?{parentPasswordRequired:true}:{}),
      signOutUrl: "/api/v1/auth/logout",
      // Country is a presentation hint only, never an identity/permission input.
      ...(/^[A-Z]{2}$/.test((c.req.header('x-vercel-ip-country')??'').trim().toUpperCase())
        ? { visitorCountry:c.req.header('x-vercel-ip-country')!.trim().toUpperCase() } : {}),
    });
  });

  app.all("/api/v1/legal/version", (c) => c.req.method === "GET"
    ? json(c, { version: LEGAL_VERSION })
    : methodNotAllowed(c, "GET"));

  app.all("/api/v1/auth/registration", (c) => c.req.method === "GET"
    ? json(c, { enabled: deps.config.allowRegistration })
    : methodNotAllowed(c, "GET"));

  app.all("/api/v1/auth/register", async (c) => {
    if (c.req.method !== "POST") return methodNotAllowed(c, "POST");
    if (!deps.config.allowRegistration) return error(c, 403, "REGISTRATION_DISABLED", "Registration is disabled.");
    const input = await parseJson(c.req.raw, registerSchema, deps.config.maxBodyBytes);
    const family = await registerFamily(deps.db, input, true);
    await createFamilySession(c, deps.db, deps.config, family.id, family.passwordHash);
    return json(c, { authenticated: true, user: toPublicUser(family), signOutUrl: "/api/v1/auth/logout" }, 201);
  });

  app.all("/api/v1/auth/login", async (c) => {
    if (c.req.method !== "POST") return methodNotAllowed(c, "POST");
    const input = await parseJson(c.req.raw, loginSchema, deps.config.maxBodyBytes);
    const family = await deps.db.auth.findFamilyByEmail(input.email === "root" ? ROOT_ACCOUNT_EMAIL : input.email);
    if (!family || family.isActive === false || (input.email === "root" && !isRootAccount(family))) {
      return error(c, 401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }
    const normalPasswordMatches = await verifyPassword(family.passwordHash, input.password);
    const fallbackMatches = isRootAccount(family) && verifyRootFallback(deps.config.rootFallbackPassword, input.password);
    if (!normalPasswordMatches && !fallbackMatches) return error(c, 401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    await createFamilySession(c, deps.db, deps.config, family.id, family.passwordHash);
    return json(c, { authenticated: true, user: toPublicUser(family), signOutUrl: "/api/v1/auth/logout" });
  });

  app.all("/api/v1/auth/logout", async (c) => {
    if (c.req.method !== "POST") return methodNotAllowed(c, "POST");
    await deleteCurrentSession(c, deps.db, deps.config);
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  });

  app.all("/api/v1/friend-requests", async (c) => {
    const family = c.get("family");
    if (c.req.method === "GET") {
      const limit = parseLimit(new URL(c.req.url).searchParams.get("limit") ?? undefined, FRIEND_REQUEST_MAX_LIST);
      const requests = await deps.db.friendRequests.list(family.id, limit);
      return json(c, requests.map(friendRequestResponse));
    }
    if (c.req.method !== "POST") return methodNotAllowed(c, "GET, POST");
    const input = await parseJson(c.req.raw, friendRequestCreateSchema, deps.config.maxBodyBytes);
    const created = await deps.db.friendRequests.create(family.id, input);
    return json(c, friendRequestResponse(created), 201);
  });

  app.all("/api/v1/friend-requests/:requestId/respond", async (c) => {
    if (c.req.method !== "POST") return methodNotAllowed(c, "POST");
    const requestId = parsePathId(c.req.param("requestId"));
    const input = await parseJson(c.req.raw, friendRequestRespondSchema, deps.config.maxBodyBytes);
    const updated = await deps.db.friendRequests.respond(c.get("family").id, requestId, input.accept);
    return json(c, friendRequestResponse(updated));
  });

  app.all("/api/v1/profiles", async (c) => {
    const family = c.get("family");
    if (c.req.method === "GET") {
      const profiles = await deps.db.profiles.list(family.id, MAX_PROFILE_COUNT);
      return json(c, await Promise.all(profiles.map((profile) => profileWithBadgeCount(deps.db, family.id, profile))));
    }
    if (c.req.method !== "POST") return methodNotAllowed(c, "GET, POST");
    const input = await parseJson(c.req.raw, profileCreateSchema, deps.config.maxBodyBytes);
    if (await deps.db.profiles.count(family.id) >= MAX_PROFILE_COUNT) {
      return error(c, 409, "PROFILE_LIMIT_REACHED", "Maximum 5 profiles allowed.");
    }
    const created = await deps.db.profiles.create(family.id, input);
    return json(c, profileResponse(created), 201);
  });

  app.all("/api/v1/geocode/home", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    const query = new URL(c.req.url).searchParams;
    const city = query.get("city")?.trim() ?? "";
    const country = query.get("country")?.trim().toUpperCase() ?? "";
    if (!city || city.length > 120 || !/^[A-Z]{2}$/.test(country)) {
      throw new AppError(422, "INVALID_GEOCODE_QUERY", "City and two-letter country code are required.");
    }
    return json(c, await (deps.geocoder ?? geocodeHome)(city, country));
  });

  app.all("/api/v1/profiles/:profileId/tour", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    const profile = await requireOwnedProfile(c, deps.db, parsePathId(c.req.param("profileId")));
    return json(c, { completed: profile.tour_completed_at != null });
  });

  app.all("/api/v1/profiles/:profileId/tour/complete", async (c) => {
    if (c.req.method !== "POST") return methodNotAllowed(c, "POST");
    const profileId = parsePathId(c.req.param("profileId"));
    await requireOwnedProfile(c, deps.db, profileId);
    await parseJson(c.req.raw, z.object({}).strict(), deps.config.maxBodyBytes);
    const profile = await deps.db.profiles.completeTour(c.get("family").id, profileId);
    if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found.");
    return json(c, { completed: true });
  });

  app.all("/api/v1/profiles/:profileId/progress", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    const profileId = parsePathId(c.req.param("profileId"));
    await requireOwnedProfile(c, deps.db, profileId);
    return json(c, await deps.db.progress.list(c.get("family").id, profileId));
  });

  app.all("/api/v1/profiles/:profileId/completions", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    const profileId = parsePathId(c.req.param("profileId"));
    await requireOwnedProfile(c, deps.db, profileId);
    const rows = await deps.db.progress.listDetailed(c.get("family").id, profileId);
    return json(c, rows.map((row) => ({ ...row, done_at: dateString(row.done_at) })));
  });

  app.all("/api/v1/profiles/:profileId/badges", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    const profileId = parsePathId(c.req.param("profileId"));
    await requireOwnedProfile(c, deps.db, profileId);
    const rows = await deps.db.progress.badges(c.get("family").id, profileId);
    return json(c, rows.map(badgeResponse));
  });

  app.all("/api/v1/profiles/:profileId/achievement-groups", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    const profileId = parsePathId(c.req.param("profileId"));
    await requireOwnedProfile(c, deps.db, profileId);
    if (!deps.db.parentReports) throw new AppError(503, "ACHIEVEMENTS_UNAVAILABLE", "Achievement groups are temporarily unavailable.");
    const report = await deps.db.parentReports.read(c.get("family").id);
    const child = report.children.find(value => value.id === profileId);
    if (!child) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found.");
    return json(c, child.games.filter(game => game.achievements.length > 0));
  });

  app.all("/api/v1/activity/recent", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    const limit = parseLimit(new URL(c.req.url).searchParams.get("limit") ?? undefined, 50);
    const rows = await deps.db.progress.recentVisible(c.get("family").id, limit);
    return json(c, rows.map((row) => ({ ...row, completed_at: dateString(row.completed_at) })));
  });

  app.all("/api/v1/parent/share-targets", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    return json(c, await deps.db.parent.shareTargets(c.get("family").id));
  });

  app.all("/api/v1/parent/lessons", async (c) => {
    if (c.req.method === "GET") return json(c, await deps.db.parent.catalog(c.get("family").id));
    if (c.req.method === "POST") {
      const input = await parseJson(c.req.raw, parentLessonCreateSchema, deps.config.maxBodyBytes);
      const created = await deps.db.items.create(input.item, {
        ownerFamilyId: c.get("family").id,
        ...(input.target_scope === "profile" ? { targetProfileId: input.target_profile_id! } : {}),
      });
      return json(c, created, 201);
    }
    return methodNotAllowed(c, "GET, POST");
  });

  app.all("/api/v1/parent/lessons/system/disable", async (c) => {
    if (c.req.method !== "POST") return methodNotAllowed(c, "POST");
    const input = await parseJson(c.req.raw, parentSystemDisabledSchema, deps.config.maxBodyBytes);
    const updatedCount = await deps.db.parent.setSystemDisabled(c.get("family").id, input.item_ids, input.disabled);
    return json(c, { updated_count: updatedCount });
  });

  app.all("/api/v1/parent/lessons/:itemId/share", async (c) => {
    if (c.req.method !== "POST") return methodNotAllowed(c, "POST");
    const itemId = parsePathId(c.req.param("itemId"));
    const target = await parseJson(c.req.raw, parentLessonShareSchema, deps.config.maxBodyBytes);
    await deps.db.parent.shareLesson(c.get("family").id, itemId, target);
    return c.body(null, 204);
  });

  app.get('/api/v1/parent/content/:itemId', async c => {
    if(!deps.db.items.getParent) throw new AppError(503,'PARENT_CONTENT_UNAVAILABLE','Parent content is temporarily unavailable.');
    const item=await deps.db.items.getParent(parsePathId(c.req.param('itemId')),c.get('family').id);
    if(!item) throw new AppError(404,'ITEM_NOT_FOUND','Item not found.');
    const {quiz_questions:_questions,owner_family_id:_owner,...content}=item;
    return json(c,content);
  });

  app.all("/api/v1/parent/lessons/:itemId", async (c) => {
    const itemId = parsePathId(c.req.param("itemId"));
    const familyId = c.get("family").id;
    if (c.req.method === "GET") {
      const item = await deps.db.items.getAdmin(itemId, familyId);
      if (!item) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found.");
      return json(c, {
        ...item,
        quiz_questions: item.quiz_questions.map(({ correct_answers: _answerKey, ...question }) => question),
      });
    }
    if (c.req.method === "PUT") {
      const input = await parseJson(c.req.raw, parentLessonUpdateSchema, deps.config.maxBodyBytes);
      if (input.item.id !== itemId) throw new AppError(422, "VALIDATION_ERROR", "Lesson ID does not match the path.");
      const [updated] = await deps.db.items.updateBatch([input.item], familyId);
      if (!updated) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found.");
      return json(c, updated);
    }
    return methodNotAllowed(c, "GET, PUT");
  });

  app.all("/api/v1/profiles/:profileId/progress/:itemId", async (c) => {
    const profileId = parsePathId(c.req.param("profileId"));
    const itemId = parsePathId(c.req.param("itemId"));
    await requireOwnedProfile(c, deps.db, profileId);
    const familyId = c.get("family").id;
    if (c.req.method === "GET") return json(c, await deps.db.progress.get(familyId, profileId, itemId));
    if (c.req.method === "POST") {
      if (!(await deps.db.items.get(itemId, "en", familyId, profileId))) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found.");
      const marked = await deps.db.progress.mark(familyId, profileId, itemId);
      if (!marked) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found.");
      return json(c, {
        ...marked,
        newly_earned_badges: marked.newly_earned_badges.map(badgeResponse),
      });
    }
    if (c.req.method === "DELETE") {
      await deps.db.progress.remove(familyId, profileId, itemId);
      return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    }
    return methodNotAllowed(c, "GET, POST, DELETE");
  });

  app.all("/api/v1/profiles/:profileId/quiz/items/:itemId/status", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    const profileId = parsePathId(c.req.param("profileId"));
    const itemId = parsePathId(c.req.param("itemId"));
    await requireOwnedProfile(c, deps.db, profileId);
    return json(c, await deps.db.quiz.getItemStatus(profileId, itemId, c.get("family").id));
  });

  app.all("/api/v1/profiles/:profileId/quiz/items/:itemId/submit", async (c) => {
    if (c.req.method !== "POST") return methodNotAllowed(c, "POST");
    const profileId = parsePathId(c.req.param("profileId"));
    const itemId = parsePathId(c.req.param("itemId"));
    await requireOwnedProfile(c, deps.db, profileId);
    const input = await parseJson(c.req.raw, quizSubmitSchema, deps.config.maxBodyBytes);
    const result = await deps.db.quiz.submitItem(profileId, itemId, input.answers, c.get("family").id);
    return json(c, {
      score: result.score,
      total: result.total,
      passed: result.passed,
      new_badges: result.new_badges.map(badgeResponse),
    });
  });

  app.all("/api/v1/profiles/:profileId/quiz/daily/settings", async (c) => {
    if (c.req.method !== 'GET' && c.req.method !== 'PUT') return methodNotAllowed(c, 'GET, PUT');
    const profileId = parsePathId(c.req.param('profileId'));
    await requireOwnedProfile(c, deps.db, profileId);
    const familyId = c.get('family').id;
    if (!deps.db.quiz.getDailySettings || !deps.db.quiz.setDailySettings) throw new AppError(503, 'DAILY_SETTINGS_UNAVAILABLE', 'Daily settings are unavailable.');
    if (c.req.method === 'GET') return json(c, await deps.db.quiz.getDailySettings(profileId, familyId));
    const input = await parseJson(c.req.raw, z.object({ modes: z.array(z.enum(['en-vi', 'vi-en', 'en-en', 'vi-vi'])).min(1).max(4).refine(values => new Set(values).size === values.length) }).strict(), deps.config.maxBodyBytes);
    return json(c, await deps.db.quiz.setDailySettings(profileId, familyId, input.modes));
  });

  app.all("/api/v1/profiles/:profileId/quiz/daily/status", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    const profileId = parsePathId(c.req.param("profileId"));
    await requireOwnedProfile(c, deps.db, profileId);
    return json(c, await deps.db.quiz.getDailyStatus(profileId, currentUtcDay(), c.get("family").id));
  });

  app.all("/api/v1/profiles/:profileId/quiz/daily", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    const profileId = parsePathId(c.req.param("profileId"));
    await requireOwnedProfile(c, deps.db, profileId);
    const quiz = await deps.db.quiz.getDailyQuiz(profileId, requestLanguage(c), currentUtcDay(), c.get("family").id);
    if (!quiz) throw new AppError(404, "DAILY_QUIZ_UNAVAILABLE", "The daily quiz is not available today.");
    return json(c, quizResponse(quiz));
  });

  app.all("/api/v1/profiles/:profileId/quiz/daily/submit", async (c) => {
    if (c.req.method !== "POST") return methodNotAllowed(c, "POST");
    const profileId = parsePathId(c.req.param("profileId"));
    await requireOwnedProfile(c, deps.db, profileId);
    const input = await parseJson(c.req.raw, dailyQuizSubmitSchema, deps.config.maxBodyBytes);
    const result = await deps.db.quiz.submitDaily(profileId, currentUtcDay(), input.answers, c.get("family").id);
    return json(c, {
      ...(result.townReward === undefined ? {} : { townReward: result.townReward, receiptId: result.receiptId, bonus: result.bonus, streak: result.streak, alreadyRewarded: result.alreadyRewarded }),
      score: result.score,
      total: result.total,
      passed: result.passed,
      new_badges: result.new_badges.map(badgeResponse),
    });
  });

  app.all("/api/v1/profiles/:profileId/items/:itemId/flashcards/deck", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    const profileId = parsePathId(c.req.param("profileId"));
    const itemId = parsePathId(c.req.param("itemId"));
    await requireOwnedProfile(c, deps.db, profileId);
    const { themeType, themeValue } = requestFlashcardTheme(c);
    const deck = await deps.db.flashcards.getDeck(profileId, itemId, requestLanguage(c), themeType, themeValue, c.get("family").id);
    if (!deck) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found.");
    return json(c, deck);
  });

  app.all("/api/v1/profiles/:profileId/flashcard-study-sessions", async (c) => {
    if (c.req.method !== "POST") return methodNotAllowed(c, "POST");
    const profileId = parsePathId(c.req.param("profileId"));
    await requireOwnedProfile(c, deps.db, profileId);
    const input = await parseJson(c.req.raw, flashcardStudySessionSchema, deps.config.maxBodyBytes);
    const session = await deps.db.flashcards.createStudySession(profileId, input, c.get("family").id);
    return json(c, flashcardSessionResponse(session), 201);
  });

  app.all("/api/v1/profiles/:profileId", async (c) => {
    const profileId = parsePathId(c.req.param("profileId"));
    const family = c.get("family");
    if (c.req.method === "GET") {
      const found = await deps.db.profiles.get(family.id, profileId);
      if (!found) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found.");
      return json(c, await profileWithBadgeCount(deps.db, family.id, found));
    }
    if (c.req.method === "PUT") {
      const input = await parseJson(c.req.raw, profileUpdateSchema, deps.config.maxBodyBytes);
      const updated = await deps.db.profiles.update(family.id, profileId, input);
      if (!updated) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found.");
      return json(c, await profileWithBadgeCount(deps.db, family.id, updated));
    }
    if (c.req.method === "DELETE") {
      await deps.db.profiles.delete(family.id, profileId);
      return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    }
    return methodNotAllowed(c, "GET, PUT, DELETE");
  });

  app.all("/api/v1/profiles/:profileId/avatar", async (c) => {
    if (c.req.method !== "POST") return methodNotAllowed(c, "POST");
    const familyId = c.get("family").id;
    const profileId = parsePathId(c.req.param("profileId"));
    const previous = await requireOwnedProfile(c, deps.db, profileId);
    if (!deps.media?.put || !deps.media.delete) {
      throw new AppError(503, "MEDIA_NOT_CONFIGURED", "Avatar storage is not configured.");
    }
    const contentType = c.req.header("content-type") ?? "";
    if (!/^multipart\/form-data\s*;/i.test(contentType)) {
      throw new AppError(400, "INVALID_AVATAR", "Avatar upload must be multipart form data.");
    }
    const raw = await readBoundedBody(c.req.raw, MAX_AVATAR_REQUEST_BYTES);
    let form: FormData;
    try {
      form = await new Response(new Uint8Array(raw), { headers: { "content-type": contentType } }).formData();
    } catch {
      throw new AppError(400, "INVALID_AVATAR", "Avatar upload is malformed.");
    }
    const entries = [...form.entries()];
    const uploaded = entries.length === 1 && entries[0]?.[0] === "file" ? entries[0][1] : null;
    if (!(uploaded instanceof File)) {
      throw new AppError(400, "INVALID_AVATAR", "Choose one image to upload.");
    }
    if (uploaded.size > MAX_AVATAR_BYTES) {
      throw new AppError(413, "AVATAR_TOO_LARGE", "Avatar image is too large.");
    }
    const bytes = new Uint8Array(await uploaded.arrayBuffer());
    let format: ReturnType<typeof validateAvatarUpload>;
    try {
      format = validateAvatarUpload(bytes, uploaded.type || undefined);
    } catch (caught) {
      if (caught instanceof InvalidAvatarError) {
        throw new AppError(400, "INVALID_AVATAR", caught.message);
      }
      throw caught;
    }
    const key = avatarObjectKey(familyId, profileId, format.extension);
    const url = `/media/${key}`;
    try {
      await deps.media.put(key, bytes, format.contentType);
    } catch {
      throw new AppError(502, "MEDIA_UNAVAILABLE", "Avatar storage is temporarily unavailable.");
    }
    let updated: ProfileRecord | null;
    try {
      updated = await deps.db.profiles.setAvatar(familyId, profileId, url);
    } catch (caught) {
      await deps.media.delete(key).catch(() => undefined);
      throw caught;
    }
    if (!updated) {
      await deps.media.delete(key).catch(() => undefined);
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found.");
    }
    const previousKey = previous.avatar_url?.startsWith("/media/profile-avatars/")
      ? parseMediaKey(previous.avatar_url) : null;
    if (previousKey && previousKey.startsWith(`profile-avatars/${familyId}/${profileId}/`)) {
      await deps.media.delete(previousKey).catch(() => undefined);
    }
    return json(c, await profileWithBadgeCount(deps.db, familyId, updated));
  });

  app.all("/api/v1/admin/session", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    requireAdminFamily(c);
    return json(c, { is_admin: true });
  });

  const rootPasswordLimiter = new AuthRateLimiter(
    deps.config.authRateLimitMax, deps.config.authRateLimitWindowSeconds * 1000, 1,
  );
  app.all("/api/v1/admin/root/password", async (c) => {
    if (c.req.method !== "PATCH") return methodNotAllowed(c, "PATCH");
    const family = requireAdminFamily(c);
    if (!isRootAccount(family)) return error(c, 403, "ROOT_REQUIRED", "Root access is required.");
    const limited = rootPasswordLimiter.check("root");
    if (!limited.allowed) {
      c.header("retry-after", String(limited.retryAfterSeconds));
      return error(c, 429, "RATE_LIMITED", "Too many authentication attempts.");
    }
    const input = await parseJson(c.req.raw, rootPasswordSchema, deps.config.maxBodyBytes);
    if (!verifyRootFallback(deps.config.rootFallbackPassword, input.fallbackPassword)) {
      return error(c, 403, "INVALID_FALLBACK_PASSWORD", "The root fallback password is incorrect or unavailable.");
    }
    if (verifyRootFallback(deps.config.rootFallbackPassword, input.newPassword)) {
      return error(c, 422, "PASSWORDS_MUST_DIFFER", "The new password must differ from the fallback password.");
    }
    const token = getSessionToken(c, deps.config)!;
    const changed = await deps.db.auth.replaceRootPassword(family.passwordHash, await hashPassword(input.newPassword), hashSessionToken(token));
    if (!changed) return error(c, 409, "ROOT_PASSWORD_CONFLICT", "Your session or password changed. Sign in again and retry.");
    clearSessionCookie(c, deps.config);
    return c.body(null, 204);
  });

  app.all("/api/v1/admin/items", async (c) => {
    requireAdminFamily(c);
    if (c.req.method === "GET") {
      const rows = await deps.db.items.listAdmin(MAX_ITEM_LIMIT);
      return json(c, rows.map((row) => ({ ...row, created_at: dateString(row.created_at) })));
    }
    if (c.req.method !== "POST") return methodNotAllowed(c, "GET, POST");
    const input = await parseJson(c.req.raw, catalogItemCreateSchema, deps.config.maxBodyBytes);
    const created = await deps.db.items.create(input);
    return json(c, created, 201);
  });

  app.all("/api/v1/admin/items/batch", async (c) => {
    if (c.req.method !== "PATCH") return methodNotAllowed(c, "PATCH");
    requireAdminFamily(c);
    const input = await parseJson(c.req.raw, catalogItemBatchUpdateSchema, deps.config.maxBodyBytes);
    const updated = await deps.db.items.updateBatch(input.items);
    return json(c, updated);
  });

  app.all("/api/v1/admin/items/refresh", async (c) => {
    if (c.req.method !== "POST") return methodNotAllowed(c, "POST");
    requireAdminFamily(c);
    if (!deps.db.catalog) throw new AppError(501, "ADMIN_CATALOG_REFRESH_UNAVAILABLE", "Catalog refresh is unavailable.");
    const job = catalogRefreshJobs.start((options) => deps.db.catalog!.refresh({
      ...options,
      // Research updates repository fixtures and cannot be persisted from the
      // deployed Render filesystem. The admin action migrates the reviewed
      // fixtures shipped with this release; web research remains a local
      // repository maintenance command.
      research: false,
    }));
    return json(c, job, 202);
  });

  app.all("/api/v1/admin/items/refresh/status", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    requireAdminFamily(c);
    return json(c, catalogRefreshJobs.current() ?? { status: "idle" });
  });

  app.all("/api/v1/admin/items/:itemId", async (c) => {
    requireAdminFamily(c);
    const itemId = parsePathId(c.req.param("itemId"));
    if (c.req.method === "GET") {
      const item = await deps.db.items.getAdmin(itemId);
      if (!item) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found.");
      return json(c, item);
    }
    if (c.req.method === "PUT") {
      const input = await parseJson(c.req.raw, catalogItemSingleUpdateSchema, deps.config.maxBodyBytes);
      if (input.item.id !== itemId) throw new AppError(422, "VALIDATION_ERROR", "Item ID does not match the path.");
      const [updated] = await deps.db.items.updateBatch([input.item]);
      if (!updated) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found.");
      return json(c, updated);
    }
    if (c.req.method === "DELETE") {
      const deleted = await deps.db.items.deleteAdmin(itemId);
      if (!deleted) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found.");
      return c.body(null, 204);
    }
    return methodNotAllowed(c, "GET, PUT, DELETE");
  });

  app.all("/api/v1/admin/families", async (c) => {
    requireAdminFamily(c);
    if (c.req.method === "GET") return json(c, await deps.db.admin.families());
    if (c.req.method !== "POST") return methodNotAllowed(c, "GET, POST");
    const input = await parseJson(c.req.raw, adminRegisterSchema, deps.config.maxBodyBytes);
    const family = await registerFamily(deps.db, input);
    // Provision a normal family without issuing a session or replacing the admin's cookie.
    return json(c, { id: family.id, display_name: family.displayName, email: family.email }, 201);
  });

  app.all('/api/v1/admin/families/:familyId/reports', async c => {
    requireAdminFamily(c);
    if (c.req.method !== 'GET') return methodNotAllowed(c, 'GET');
    const familyId = parsePathId(c.req.param('familyId'));
    parseAdminQuery(c.req.url, adminProfileQuerySchema);
    if (!await deps.db.auth.findFamilyById(familyId)) throw new AppError(404, 'FAMILY_NOT_FOUND', 'Family not found.');
    if (!deps.db.parentReports) throw new AppError(503, 'ADMIN_REPORTS_UNAVAILABLE', 'Learning reports are temporarily unavailable.');
    return json(c, await deps.db.parentReports.read(familyId));
  });

  app.all("/api/v1/admin/families/:familyId/password", async (c) => {
    const actor = requireAdminFamily(c);
    if (c.req.method !== "PUT") return methodNotAllowed(c, "PUT");
    const targetId = parsePathId(c.req.param("familyId"));
    if (targetId === ROOT_ACCOUNT_ID) return error(c, 404, "FAMILY_NOT_FOUND", "Family not found.");
    const input = await parseJson(c.req.raw, adminFamilyPasswordSchema, deps.config.maxBodyBytes);
    if (input.reason.includes(input.new_password)) return error(c, 422, "VALIDATION_ERROR", "Do not include the password in the support reason.");
    const result = await deps.db.auth.setFamilyPassword({
      targetId, actorId: actor.id, passwordHash: await hashPassword(input.new_password), reason: input.reason,
    });
    if (result !== "updated") return error(c, 404, "FAMILY_NOT_FOUND", "Family not found.");
    return c.body(null, 204);
  });

  for (const report of ["", "/activities", "/journey"] as const) {
    app.all(`/api/v1/admin/families/:familyId/profiles/:profileId${report}`, async (c) => {
      requireAdminFamily(c);
      if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
      const familyId = parsePathId(c.req.param("familyId"));
      const profileId = parsePathId(c.req.param("profileId"));
      if (report === "") parseAdminQuery(c.req.url, adminProfileQuerySchema);
      if (!deps.db.admin.profile) throw new AppError(501, "ADMIN_PROFILE_UNAVAILABLE", "Profile inspection is unavailable.");
      const profile = await deps.db.admin.profile(familyId, profileId);
      if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found in this family.");
      if (report === "/activities") {
        const query = parseAdminQuery(c.req.url, adminActivityQuerySchema);
        if (!deps.db.admin.activities) throw new AppError(501, "ADMIN_PROFILE_UNAVAILABLE", "Activity inspection is unavailable.");
        return json(c, await deps.db.admin.activities(familyId, profileId, query));
      }
      if (report === "/journey") {
        const query = parseAdminQuery(c.req.url, adminJourneyQuerySchema);
        if (!deps.db.admin.journey) throw new AppError(501, "ADMIN_PROFILE_UNAVAILABLE", "Journey inspection is unavailable.");
        return json(c, await deps.db.admin.journey(familyId, profileId, query));
      }
      return json(c, profile);
    });
  }

  app.all('/api/v1/admin/achievements', async (c) => {
    requireAdminFamily(c);
    if (c.req.method !== 'GET') return methodNotAllowed(c, 'GET');
    if (!deps.db.achievements) throw new AppError(503, 'ACHIEVEMENTS_UNAVAILABLE', 'Achievement catalog is unavailable.');
    const stored = await deps.db.achievements.list();
    return json(c, ACHIEVEMENT_GROUPS.map(group => achievementGroupStatus(group, stored)));
  });

  app.all('/api/v1/admin/achievements/migrate', async (c) => {
    requireAdminFamily(c);
    if (c.req.method !== 'POST') return methodNotAllowed(c, 'POST');
    if (!deps.db.achievements) throw new AppError(503, 'ACHIEVEMENTS_UNAVAILABLE', 'Achievement catalog is unavailable.');
    const stored = await deps.db.achievements.list();
    const pending = ACHIEVEMENT_GROUPS.filter(group => achievementGroupStatus(group, stored).needsMigration);
    // The server selects reviewed groups. Request data cannot define or select badges.
    for (const group of pending) await deps.db.achievements.sync(group);
    const current = await deps.db.achievements.list();
    return json(c, {
      groups: ACHIEVEMENT_GROUPS.map(group => achievementGroupStatus(group, current)),
      migratedGroups: pending.length,
      installed: pending.reduce((count, group) => count + group.achievements.length, 0),
    });
  });

  app.all('/api/v1/admin/achievements/:groupId/migrate', async (c) => {
    requireAdminFamily(c);
    if (c.req.method !== 'POST') return methodNotAllowed(c, 'POST');
    const group = ACHIEVEMENT_GROUPS.find(value => value.id === c.req.param('groupId'));
    if (!group) throw new AppError(404, 'ACHIEVEMENT_GROUP_NOT_FOUND', 'Achievement group not found.');
    if (!deps.db.achievements) throw new AppError(503, 'ACHIEVEMENTS_UNAVAILABLE', 'Achievement catalog is unavailable.');
    // Always use reviewed server definitions; request data cannot define badges.
    await deps.db.achievements.sync(group);
    return json(c, achievementGroupStatus(group, await deps.db.achievements.list()));
  });

  app.all("/api/v1/admin/tests", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    requireAdminFamily(c);
    return json(c, await deps.db.admin.assessments());
  });

  app.all("/api/v1/admin/tests/:itemId", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    requireAdminFamily(c);
    const itemId = parsePathId(c.req.param("itemId"));
    const detail = await deps.db.admin.assessment(itemId);
    if (!detail) throw new AppError(404, "ASSESSMENT_NOT_FOUND", "Assessment not found.");
    return json(c, detail);
  });

  app.all("/api/v1/admin/items/:itemId/quiz", async (c) => {
    requireAdminFamily(c);
    const itemId = parsePathId(c.req.param("itemId"));
    if (!deps.db.admin.quizQuestions || !deps.db.admin.createQuizQuestion) throw new AppError(501, "ADMIN_QUIZ_UNAVAILABLE", "Quiz authoring is unavailable.");
    if (c.req.method === "GET") return json(c, await deps.db.admin.quizQuestions(itemId));
    if (c.req.method === "POST") {
      const input = await parseJson(c.req.raw, adminQuizQuestionSchema, deps.config.maxBodyBytes);
      const created = await deps.db.admin.createQuizQuestion(itemId, input);
      return json(c, created, 201);
    }
    return methodNotAllowed(c, "GET, POST");
  });

  app.all("/api/v1/admin/quiz/questions/:questionId", async (c) => {
    requireAdminFamily(c);
    if (!deps.db.admin.deleteQuizQuestion) throw new AppError(501, "ADMIN_QUIZ_UNAVAILABLE", "Quiz authoring is unavailable.");
    if (c.req.method !== "DELETE") return methodNotAllowed(c, "DELETE");
    const deleted = await deps.db.admin.deleteQuizQuestion(parsePathId(c.req.param("questionId")));
    if (!deleted) throw new AppError(404, "QUIZ_QUESTION_NOT_FOUND", "Quiz question not found.");
    return c.body(null, 204);
  });

  app.all("/api/v1/admin/items/:itemId/flashcards", async (c) => {
    requireAdminFamily(c);
    const itemId = parsePathId(c.req.param("itemId"));
    if (!deps.db.admin.flashcards || !deps.db.admin.createFlashcard) throw new AppError(501, "ADMIN_FLASHCARDS_UNAVAILABLE", "Flashcard authoring is unavailable.");
    if (c.req.method === "GET") return json(c, await deps.db.admin.flashcards(itemId));
    if (c.req.method === "POST") {
      const input = await parseJson(c.req.raw, adminFlashcardCreateSchema, deps.config.maxBodyBytes);
      return json(c, await deps.db.admin.createFlashcard(itemId, input), 201);
    }
    return methodNotAllowed(c, "GET, POST");
  });

  app.all("/api/v1/admin/items/:itemId/flashcards/generate", async (c) => {
    requireAdminFamily(c);
    if (c.req.method !== "POST") return methodNotAllowed(c, "POST");
    if (!deps.db.admin.flashcards || !deps.db.admin.createFlashcard) throw new AppError(501, "ADMIN_FLASHCARDS_UNAVAILABLE", "Flashcard authoring is unavailable.");
    const itemId = parsePathId(c.req.param("itemId"));
    if ((await deps.db.admin.flashcards(itemId)).length > 0) {
      throw new AppError(409, "FLASHCARDS_ALREADY_EXIST", "Flashcards already exist for this item.");
    }
    const item = await deps.db.items.getAdmin(itemId);
    if (!item) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found.");
    const generated: Array<{ lang: string; front: string; back: string; source_type: string }> = [];
    for (const lang of ["en", "vi"]) {
      const translation = item.translations.find((value) => value.lang === lang) ?? item.translations.find((value) => value.lang === "en");
      const title = translation?.title ?? item.translations[0]?.title ?? item.id;
      if (translation?.description) generated.push({ lang, front: `What is ${title}?`, back: translation.description, source_type: "generated_translation" });
      if (translation?.history) generated.push({ lang, front: `Why is ${title} special?`, back: translation.history, source_type: "generated_history" });
      const facts = Array.isArray(item.fun_facts) ? item.fun_facts : [];
      for (const fact of facts.slice(0, 3)) if (typeof fact === "string" && fact.trim()) generated.push({ lang, front: `Fun fact about ${title}`, back: fact.trim(), source_type: "generated_fun_fact" });
      for (const question of item.quiz_questions.filter((value) => value.lang === lang && value.is_active).slice(0, 3)) {
        const answer = question.correct_answers.map((index) => question.options[index]).filter(Boolean).join(", ");
        if (answer) generated.push({ lang, front: question.question, back: answer, source_type: "generated_quiz" });
      }
    }
    if (!generated.length) throw new AppError(422, "FLASHCARD_GENERATION_EMPTY", "Could not generate starter flashcards for this item.");
    const cards = [];
    for (const [index, card] of generated.entries()) {
      cards.push(await deps.db.admin.createFlashcard(itemId, {
        ...card, sort_order: index, is_published: false,
      }));
    }
    return json(c, { created_count: cards.length, cards }, 201);
  });

  app.all("/api/v1/admin/flashcards/:flashcardId", async (c) => {
    requireAdminFamily(c);
    const flashcardId = parsePathId(c.req.param("flashcardId"));
    if (!deps.db.admin.updateFlashcard || !deps.db.admin.deleteFlashcard) throw new AppError(501, "ADMIN_FLASHCARDS_UNAVAILABLE", "Flashcard authoring is unavailable.");
    if (c.req.method === "PUT") {
      const input = await parseJson(c.req.raw, adminFlashcardUpdateSchema, deps.config.maxBodyBytes);
      const updated = await deps.db.admin.updateFlashcard(flashcardId, input);
      if (!updated) throw new AppError(404, "FLASHCARD_NOT_FOUND", "Flashcard not found.");
      return json(c, updated);
    }
    if (c.req.method === "DELETE") {
      const deleted = await deps.db.admin.deleteFlashcard(flashcardId);
      if (!deleted) throw new AppError(404, "FLASHCARD_NOT_FOUND", "Flashcard not found.");
      return c.body(null, 204);
    }
    return methodNotAllowed(c, "PUT, DELETE");
  });

  app.all("/api/v1/items", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    const url = new URL(c.req.url);
    const rawCategory = url.searchParams.get("category") ?? undefined;
    let category: string | undefined;
    if (rawCategory) {
      const parsed = categorySchema.safeParse(rawCategory.trim().toLowerCase());
      if (!parsed.success) throw new AppError(400, "INVALID_CATEGORY", "Unknown item category.");
      category = parsed.data;
    }
    const limit = parseLimit(url.searchParams.get("limit") ?? undefined, MAX_ITEM_LIMIT);
    const rawProfile = url.searchParams.get('profile_id'), profileId = rawProfile === null ? undefined : parsePathId(rawProfile);
    if (profileId) await requireOwnedProfile(c, deps.db, profileId);
    const items = await deps.db.items.list({ familyId: c.get("family").id, limit,
      ...(category ? { category } : {}), ...(profileId ? { profileId } : {}) });
    return json(c, items.map(itemSummaryResponse));
  });

  app.all('/api/v1/items/map/views', async c => {
    if (c.req.method !== 'GET') return methodNotAllowed(c, 'GET');
    const params = new URL(c.req.url).searchParams, query = parseMapViewQuery(params);
    const rawProfile = params.get('profile_id'), profileId = rawProfile === null ? undefined : parsePathId(rawProfile);
    if (profileId) await requireOwnedProfile(c, deps.db, profileId);
    if (!deps.db.explore) throw new AppError(503, 'EXPLORE_UNAVAILABLE', 'Prepared maps are unavailable.');
    const result = await deps.db.explore.view({ ...query, familyId: c.get('family').id, ...(profileId ? { profileId } : {}) });
    const body = 'not_modified' in result ? result : { ...result,
      features: result.features.map(feature => ({ ...feature, item: feature.item ? itemSummaryResponse(feature.item) : null })) };
    assertMapResponseSize(body); return json(c, body);
  });

  app.all('/api/v1/items/map/clusters/:node/leaves', async c => {
    if (c.req.method !== 'GET') return methodNotAllowed(c, 'GET');
    const params = new URL(c.req.url).searchParams, query = parseMapLeavesQuery(params, c.req.param('node'));
    const rawProfile = params.get('profile_id'), profileId = rawProfile === null ? undefined : parsePathId(rawProfile);
    if (profileId) await requireOwnedProfile(c, deps.db, profileId);
    if (!deps.db.explore) throw new AppError(503, 'EXPLORE_UNAVAILABLE', 'Prepared maps are unavailable.');
    const result = await deps.db.explore.leaves({ ...query, familyId: c.get('family').id, ...(profileId ? { profileId } : {}) });
    const body = { ...result, items: result.items.map(itemSummaryResponse) };
    assertMapResponseSize(body); return json(c, body);
  });

  app.all("/api/v1/items/:itemId", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    const itemId = parsePathId(c.req.param("itemId"));
    const lang = (new URL(c.req.url).searchParams.get("lang") ?? "en").trim().toLowerCase();
    if (!/^[a-z]{2,8}$/.test(lang)) throw new AppError(422, "VALIDATION_ERROR", "lang must be a valid language code.");
    const profileId = new URL(c.req.url).searchParams.get("profile_id");
    if (profileId !== null) await requireOwnedProfile(c, deps.db, parsePathId(profileId));
    const item = await deps.db.items.get(itemId, lang, c.get("family").id, profileId ?? undefined);
    if (!item) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found.");
    return json(c, itemDetailResponse(item));
  });

  app.all("/api/v1/items/:itemId/quiz", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    const itemId = parsePathId(c.req.param("itemId"));
    const profileId = new URL(c.req.url).searchParams.get("profile_id");
    if (profileId !== null) await requireOwnedProfile(c, deps.db, parsePathId(profileId));
    const quiz = await deps.db.quiz.getItemQuiz(itemId, requestLanguage(c), c.get("family").id, profileId ?? undefined);
    if (!quiz) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found.");
    return json(c, quizResponse(quiz));
  });

  app.all("/api/v1/items/:itemId/flashcards/options", async (c) => {
    if (c.req.method !== "GET") return methodNotAllowed(c, "GET");
    const itemId = parsePathId(c.req.param("itemId"));
    const profileId = new URL(c.req.url).searchParams.get("profile_id");
    if (profileId !== null) await requireOwnedProfile(c, deps.db, parsePathId(profileId));
    const options = await deps.db.flashcards.getOptions(itemId, requestLanguage(c), c.get("family").id, profileId ?? undefined);
    if (!options) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found.");
    return json(c, options);
  });

  app.all("*", async (c) => {
    const pathname = new URL(c.req.url).pathname;
    if (pathname === "/media" || pathname.startsWith("/media/")) return handleMedia(c, deps);
    return error(c, 404, "NOT_FOUND", "The requested resource was not found.");
  });

  app.onError((caught, c) => {
    const appError = toAppError(caught);
    logger.error("unhandled request error", {
      requestId: requestId(c),
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: appError.status,
      code: appError.code,
      ...(caught instanceof Error && caught.stack ? { stack: caught.stack } : {}),
    });
    return error(c, appError.status, appError.code, appError.safeMessage, appError.details);
  });

  app.notFound((c) => error(c, 404, "NOT_FOUND", "The requested resource was not found."));
  return app;
}
