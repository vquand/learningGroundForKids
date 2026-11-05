import assert from "node:assert/strict";
import { test } from "node:test";
import argon2 from "argon2";
import { LEGAL_VERSION } from "../src/legal.js";
import { createApp } from "../src/app.js";
import { AppError } from "../src/errors.js";
import { hashSessionToken } from "../src/auth.js";
import { initialTown } from "../src/town-building/game.js";
import type { AppConfig } from "../src/config.js";
import type { MediaStorage } from "../src/media.js";
import type {
  AppDatabase,
  AdminCatalogItemRecord,
  FamilyRecord,
  ItemDetailRecord,
  ItemSummaryRecord,
  ProfileRecord,
  QuizQuestionRecord,
  UpdateProfileInput,
} from "../src/contracts/db.js";

const family: FamilyRecord = {
  id: "family-1",
  email: "parent@example.com",
  displayName: "Parent",
  passwordHash: "",
  role: "family",
};

const adminFamily: FamilyRecord = {
  ...family,
  id: "admin-family",
  email: "admin@example.com",
  role: "admin",
};

const rootFamily: FamilyRecord = {
  ...adminFamily,
  id: "root",
  email: "root@system.local",
};

const profile: ProfileRecord = {
  id: "profile-1",
  name: "Learner",
  emoji: "🌟",
  color: "blue",
  public_id: "PROFILE01",
  created_at: "2026-09-19T00:00:00.000Z",
  total_done: 0,
  badge_count: 0,
};

const item: ItemSummaryRecord = {
  id: "item-1",
  category: "animal",
  latitude: 10,
  longitude: 106,
  country_code: "VN",
  title: "Saola",
  icon_slug: "animal",
  has_quiz: false,
  quiz_required: false,
};

const adminCatalogItem: AdminCatalogItemRecord = {
  id: "saola-vn",
  category: "animal",
  latitude: 16.2,
  longitude: 107.8,
  country_code: "VN",
  icon_slug: "animal",
  is_published: false,
  source_type: "system",
  owner_family_id: null,
  recipe: null,
  location_desc: "A rare forest animal.",
  fun_facts: ["It is difficult to observe."],
  audio_urls: null,
  youtube_url: null,
  trailer_url: null,
  characters: null,
  start_year: null,
  end_year: null,
  time_precision: null,
  released_date: null,
  rich_fields: { sources: [{ url: "https://example.org/saola" }] },
  franchise_id: null,
  quiz_required: true,
  created_at: "2026-09-21T00:00:00.000Z",
  updated_at: "2026-09-21T00:00:00.000Z",
  translations: [{ id: "translation-1", lang: "en", title: "Saola", description: "A rare forest animal." }],
  media: [{ id: "media-1", media_type: "image", filename: "animals/saola.jpg", label: "Saola", lang: "en", sort_order: 0 }],
  quiz_questions: [{
    id: "question-1",
    lang: "en",
    question: "Where is it found?",
    question_type: "single",
    options: ["Vietnam", "Canada"],
    correct_answers: [0],
    sort_order: 0,
    is_active: true,
  }],
};

const quizQuestion: QuizQuestionRecord = {
  id: "question-1",
  item_id: "item-1",
  lang: "en",
  question_type: "single",
  question: "Which answer?",
  options: ["A", "B"],
  correct_answers: [0],
  sort_order: 0,
  is_active: true,
};

const flashcard = {
  id: "card-1",
  item_id: "item-1",
  item_title: "Saola",
  lang: "en",
  front: "What is a saola?",
  back: "A rare forest animal.",
  sort_order: 0,
  source_type: "catalog_description",
};

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: "test",
    port: 10000,
    databaseUrl: "postgresql://test:test@localhost:5432/test",
    databaseUrlUnpooled: undefined,
    allowedOrigins: new Set(["https://app.example.com"]),
    allowedForwardedHosts: new Set(["app.example.com", "localhost:3000"]),
    sessionCookieName: "plg_session",
    sessionMaxAgeSeconds: 3600,
    allowRegistration: true,
    maxBodyBytes: 16_384,
    authRateLimitMax: 10,
    authRateLimitWindowSeconds: 60,
    authRateLimitMaxKeys: 100,
    authTrustedProxyCidrs: [],
    maxMediaBytes: 1_048_576,
    trustProxyHeaders: false,
    renderExternalHostname: undefined,
    s3: undefined,
    ...overrides,
  };
}

function database(overrides: Partial<AppDatabase> = {}): AppDatabase {
  const families = new Map<string, FamilyRecord>();
  const sessions = new Map<string, FamilyRecord>();
  return {
    async ping() {},
    auth: {
      async updateOnboarding() {},
      async createRootIfMissing() { throw new Error("not used"); },
      async replaceRootPassword() { throw new Error("not used"); },
      async setFamilyPassword() { throw new Error("not used"); },
      async findFamilyByEmail(email) {
        return [...families.values()].find((value) => value.email === email) ?? null;
      },
      async createFamily(input) {
        const created = { ...input };
        families.set(created.id, created);
        return created;
      },
      async createSession({ tokenHash, familyId }) {
        const owner = families.get(familyId) ?? family;
        sessions.set(tokenHash, owner);
      },
      async findFamilyBySessionHash(tokenHash) {
        return sessions.get(tokenHash) ?? null;
      },
      async findFamilyById(id) {
        return [...families.values()].find((value) => value.id === id) ?? (id === family.id ? family : null);
      },
      async parentAccess(tokenHash, familyId) {
        return tokenHash === hashSessionToken("opaque") && familyId === family.id
          ? { method: "password" as const, until: new Date(Date.now() + 60_000) }
          : null;
      },
      async grantParentAccess() { return true; },
      async lockParentAccess() { return new Date(Date.now() + 3600_000); },
      async finalizePasskeyLogin() { return false; },
      async finalizePasskeyParentAccess() { return false; },
      async listPasskeys() { return []; },
      async findPasskey() { return null; },
      async addPasskey() {},
      async deletePasskey() { return { removed: false, preferred: false }; },
      async createPasskeyChallenge() {},
      async consumePasskeyChallenge() { return null; },
      async deleteSession(tokenHash) {
        sessions.delete(tokenHash);
      },
    },
    profiles: {
      async list() {
        return [profile];
      },
      async count() {
        return 1;
      },
      async get(familyId, profileId) {
        return familyId === family.id && profileId === profile.id ? profile : null;
      },
      async create() {
        return profile;
      },
      async update() {
        return profile;
      },
      async completeTour() { return profile; },
      async setAvatar() { return profile; },
      async delete() {
        return true;
      },
    },
    items: {
      async canReadMedia() { return false; },
      async list() {
        return [item];
      },
      async get(itemId): Promise<ItemDetailRecord | null> {
        return itemId === item.id ? { ...item, media: [], available_languages: ["en"] } : null;
      },
      async create() {
        throw new Error("not used");
      },
      async getAdmin() {
        return null;
      },
      async listAdmin() { return []; },
      async updateBatch() {
        throw new Error("not used");
      },
      async deleteAdmin() { return false; },
    },
    progress: {
      async list() {
        return { done_item_ids: [], wip_item_ids: [] };
      },
      async listDetailed() { return []; },
      async recentVisible() { return []; },
      async badges() { return []; },
      async get() {
        return { done: false };
      },
      async mark() {
        return { status: "done" as const, already_done: false, newly_earned_badges: [] };
      },
      async remove() {
        return true;
      },
    },
    quiz: {
      async getItemQuiz() {
        return { questions: [], difficulty: "Easy" as const };
      },
      async getItemStatus() {
        return { attempt_count: 0, passed: false, best_score: 0, best_total: 0, latest_score: 0, latest_total: 0 };
      },
      async submitItem() {
        return { score: 0, total: 0, passed: false, new_badges: [] };
      },
      async getDailyQuiz() {
        return null;
      },
      async getDailyStatus() {
        return { attempted_today: false, passed: false, score: 0, total: 0 };
      },
      async submitDaily() {
        return { score: 0, total: 0, passed: false, new_badges: [] };
      },
    },
    flashcards: {
      async getOptions() { return []; },
      async getDeck() { return null; },
      async createStudySession(profileId, input) {
        return {
          id: "study-1",
          profile_id: profileId,
          ...(input.focus_item_id ? { focus_item_id: input.focus_item_id } : {}),
          theme_type: input.theme_type,
          theme_value: input.theme_value,
          lang: input.lang,
          cards_shown: input.viewed_flashcard_ids.length,
          got_it_count: input.responses.filter((value) => value.rating === "got_it").length,
          review_again_count: input.responses.filter((value) => value.rating === "review_again").length,
          responses: input.responses,
          started_at: new Date(input.started_at),
          completed_at: new Date("2026-09-20T10:00:00.000Z"),
        };
      },
    },
    friendRequests: {
      async list() { return []; },
      async create() { throw new Error("not used"); },
      async respond() { throw new Error("not used"); },
    },
    parent: {
      async shareTargets() { return []; },
      async catalog() { return { system_lessons: [], custom_lessons: [] }; },
      async setSystemDisabled() { return 0; },
      async shareLesson() {},
    },
    admin: {
      async families() { return []; },
      async assessments() { return []; },
      async assessment() { return null; },
    },
    ...overrides,
  };
}

function request(app: ReturnType<typeof createApp>, path: string, init?: RequestInit) {
  return app.request(`https://app.example.com${path}`, init);
}

function authenticatedDatabase(overrides: Partial<AppDatabase> = {}): AppDatabase {
  return database({
    auth: {
      ...database().auth,
      async findFamilyByEmail() { return family; },
      async createFamily(input) { return input; },
      async createSession() {},
      async findFamilyBySessionHash() { return family; },
      async deleteSession() {},
    },
    ...overrides,
  });
}

test('math wall protects every endpoint and rejects forged scores, settings and lanes', async () => {
  const { emptyProgress, publicState } = await import('../src/math-wall/game.js');
  let reads = 0, writes = 0;
  const mathWall: import('../src/math-wall/repository.js').MathWallRepository = {
    async get() { reads++; return publicState(emptyProgress(), 1000); },
    async mutate() { writes++; return publicState(emptyProgress(), 1000); },
    async leaderboard() { reads++; return [{ name: 'Learner', score: 0, self: true }]; },
  };
  const app = createApp({ config: config(), db: authenticatedDatabase({ mathWall }) });
  const headers = { cookie: 'plg_session=opaque', 'content-type': 'application/json' };
  for (const [suffix, method] of [['', 'GET'], ['/leaderboard', 'GET'], ['/start', 'POST'], ['/action', 'POST']] as const) {
    const path = `/api/v1/profiles/profile-1/math-wall${suffix}`;
    assert.equal((await request(app, path, { method, ...(method === 'POST' ? { body: '{}' } : {}) })).status, 401);
    assert.equal((await request(app, path.replace('profile-1', 'other'), { method, headers, ...(method === 'POST' ? { body: '{}' } : {}) })).status, 404);
  }
  assert.equal(reads + writes, 0);
  for (const body of [
    { revision: 0, action: { type: 'lane', lane: 3 } },
    { revision: 0, action: { type: 'lane', lane: 1, correct: true } },
    { revision: 0, action: { type: 'settle' }, score: 999 },
    { revision: 0, action: { type: 'settle' }, profileId: 'other' },
  ]) assert.equal((await request(app, '/api/v1/profiles/profile-1/math-wall/action', { method: 'POST', headers, body: JSON.stringify(body) })).status, 422);
  assert.equal(writes, 0);
  const start = '/api/v1/profiles/profile-1/math-wall/start';
  assert.equal((await request(app, start, { method: 'POST', headers, body: JSON.stringify({ revision: 0, settings: { animal: 'cow', language: 'xx', wall: 'brick' } }) })).status, 422);
  assert.equal((await request(app, start, { method: 'POST', headers, body: JSON.stringify({ revision: 0, settings: { animal: 'cow', language: 'vi', wall: 'garden' } }) })).status, 200);
  const leaders = await request(app, '/api/v1/profiles/profile-1/math-wall/leaderboard', { headers });
  assert.equal(leaders.status, 200);
  assert.equal(leaders.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await leaders.json(), [{ name: 'Learner', score: 0, self: true }]);
  assert.equal((await request(app, start, { method: 'POST', headers: { ...headers, origin: 'https://untrusted.example' }, body: '{}' })).status, 403);
});

function authenticatedMediaDatabase(): AppDatabase {
  const base = authenticatedDatabase();
  return authenticatedDatabase({ items: { ...base.items, async canReadMedia() { return true; } } });
}

test("live health is public and includes security/request headers", async () => {
  const app = createApp({ config: config(), db: database() });
  const response = await request(app, "/api/v1/health/live");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/);
});

test("readiness reports a safe 503 when the database is unavailable", async () => {
  const app = createApp({
    config: config(),
    db: database({ ping: async () => { throw new Error("database offline"); } }),
  });
  const response = await request(app, "/api/v1/health/ready");

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: { code: "DATABASE_UNAVAILABLE", message: "The learning database is unavailable." },
  });
});

test("local readiness distinguishes current gardening APIs without changing the production health contract", async () => {
  const state = initialTown();
  const legacyTown = {
    async get() { return state; },
    async getName() { return state.townName!; },
    async mutate() { return state; },
  };
  const town = {
    ...legacyTown,
    async tick() { return state; },
    async checkpoint() { return state; },
  };
  for (const nodeEnv of ["development", "test", "production"] as const) {
    const app = createApp({ config: config({ nodeEnv }), db: database({ town }) });
    const response = await request(app, "/api/v1/health/ready");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ready" });
    assert.equal(response.headers.get("x-plg-dev-gardening"), nodeEnv === "development" ? "ready" : null);
  }
  const stale = createApp({ config: config({ nodeEnv: "development" }), db: database({ town: legacyTown }) });
  assert.equal((await request(stale, "/api/v1/health/ready")).headers.get("x-plg-dev-gardening"), null);
});

test("profile completions require an owned profile and preserve completion timestamps", async () => {
  const base = authenticatedDatabase();
  const app = createApp({
    config: config(),
    db: authenticatedDatabase({
      progress: {
        ...base.progress,
        async listDetailed(familyId, profileId) {
          assert.equal(familyId, family.id);
          assert.equal(profileId, profile.id);
          return [{ item_id: item.id, category: item.category, done_at: new Date("2026-09-20T10:00:00.000Z") }];
        },
      },
    }),
  });
  const headers = { cookie: "plg_session=opaque" };
  const response = await request(app, "/api/v1/profiles/profile-1/completions", { headers });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{ item_id: "item-1", category: "animal", done_at: "2026-09-20T10:00:00.000Z" }]);
  assert.equal((await request(app, "/api/v1/profiles/other/completions", { headers })).status, 404);
  assert.equal((await request(app, "/api/v1/profiles/profile-1/completions")).status, 401);
});

test("recent activity is authenticated and capped before repository access", async () => {
  const base = authenticatedDatabase();
  let receivedLimit = 0;
  const app = createApp({
    config: config(),
    db: authenticatedDatabase({
      progress: {
        ...base.progress,
        async recentVisible(familyId, limit) {
          assert.equal(familyId, family.id);
          receivedLimit = limit;
          return [{
            family_id: family.id, family_name: family.displayName,
            profile_id: profile.id, profile_name: profile.name,
            profile_emoji: profile.emoji, profile_color: profile.color,
            avatar_type: null, avatar_url: null, avatar_frame: null,
            item_id: item.id, item_category: item.category,
            completed_at: new Date("2026-09-20T10:00:00.000Z"),
          }];
        },
      },
    }),
  });
  const path = "/api/v1/activity/recent?limit=9999";
  assert.equal((await request(app, path)).status, 401);
  const response = await request(app, path, { headers: { cookie: "plg_session=opaque" } });
  assert.equal(response.status, 200);
  assert.equal(receivedLimit, 50);
  assert.equal((await response.json() as Array<{ completed_at: string }>)[0]?.completed_at, "2026-09-20T10:00:00.000Z");
  assert.equal((await request(app, "/api/v1/activity/recent?limit=0", { headers: { cookie: "plg_session=opaque" } })).status, 422);
});

test("badges are read only for an owned profile", async () => {
  const base = authenticatedDatabase();
  const app = createApp({
    config: config(),
    db: authenticatedDatabase({
      progress: {
        ...base.progress,
        async badges(familyId, profileId) {
          assert.equal(familyId, family.id);
          assert.equal(profileId, profile.id);
          return [{
            id: "badge-1", badge_key: "global_5", badge_type: "global",
            milestone: 5, earned_at: new Date("2026-09-20T10:00:00.000Z"),
          }];
        },
      },
    }),
  });
  const headers = { cookie: "plg_session=opaque" };
  const response = await request(app, "/api/v1/profiles/profile-1/badges", { headers });
  assert.equal(response.status, 200);
  assert.equal((await response.json() as Array<{ badge_key: string }>)[0]?.badge_key, "global_5");
  assert.equal((await request(app, "/api/v1/profiles/other/badges", { headers })).status, 404);
  assert.equal((await request(app, "/api/v1/profiles/profile-1/badges")).status, 401);
});

test("parent share targets come only from the signed-in family", async () => {
  const app = createApp({
    config: config(),
    db: authenticatedDatabase({
      parent: {
        async shareTargets(familyId) {
          assert.equal(familyId, family.id);
          return [{ family_id: family.id, family_name: family.displayName, profiles: [] }];
        },
        async catalog() { return { system_lessons: [], custom_lessons: [] }; },
        async setSystemDisabled() { return 0; },
        async shareLesson() {},
      },
    }),
  });
  assert.equal((await request(app, "/api/v1/parent/share-targets")).status, 401);
  const response = await request(app, "/api/v1/parent/share-targets", { headers: { cookie: "plg_session=opaque" } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{ family_id: "family-1", family_name: "Parent", profiles: [] }]);
});

test("parent lesson catalog is private and scoped to the authenticated family", async () => {
  const app = createApp({ config: config(), db: authenticatedDatabase({
    parent: {
      async shareTargets() { return []; },
      async catalog(familyId) {
        assert.equal(familyId, family.id);
        return { system_lessons: [], custom_lessons: [] };
      },
      async setSystemDisabled() { return 0; },
      async shareLesson() {},
    },
  }) });
  assert.equal((await request(app, "/api/v1/parent/lessons")).status, 401);
  const response = await request(app, "/api/v1/parent/lessons", { headers: { cookie: "plg_session=opaque" } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { system_lessons: [], custom_lessons: [] });
});

test("parent system-disable ignores forged family identity and validates the batch", async () => {
  let received: unknown;
  const app = createApp({ config: config(), db: authenticatedDatabase({ parent: {
    async shareTargets() { return []; },
    async catalog() { return { system_lessons: [], custom_lessons: [] }; },
    async setSystemDisabled(familyId, itemIds, disabled) {
      received = { familyId, itemIds, disabled };
      return itemIds.length;
    },
    async shareLesson() {},
  } }) });
  const headers = { cookie: "plg_session=opaque", "content-type": "application/json" };
  const response = await request(app, "/api/v1/parent/lessons/system/disable", {
    method: "POST", headers, body: JSON.stringify({ item_ids: ["item-1"], disabled: true }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { updated_count: 1 });
  assert.deepEqual(received, { familyId: family.id, itemIds: ["item-1"], disabled: true });
  const forged = await request(app, "/api/v1/parent/lessons/system/disable", {
    method: "POST", headers, body: JSON.stringify({ item_ids: ["item-1"], disabled: true, family_id: "other" }),
  });
  assert.equal(forged.status, 422);
});

test("parent lesson creation derives ownership from the session and rejects a foreign target", async () => {
  let options: unknown;
  const base = authenticatedDatabase();
  const app = createApp({ config: config(), db: authenticatedDatabase({
    items: {
      ...base.items,
      async create(input, receivedOptions) {
        options = receivedOptions;
        return { id: "new-lesson", category: input.category, is_published: input.is_published,
          quiz_required: input.quiz_required, translation_count: input.translations.length,
          media_count: 0, quiz_question_count: 0 };
      },
    },
  }) });
  const headers = { cookie: "plg_session=opaque", "content-type": "application/json" };
  const body = { item: {
    category: "animal", latitude: 10, longitude: 106, is_published: true,
    translations: [{ lang: "en", title: "Parent lesson" }],
  }, target_scope: "profile", target_profile_id: profile.id };
  const response = await request(app, "/api/v1/parent/lessons", { method: "POST", headers, body: JSON.stringify(body) });
  assert.equal(response.status, 201);
  assert.deepEqual(options, { ownerFamilyId: family.id, targetProfileId: profile.id });
  assert.equal((await response.json() as { id: string }).id, "new-lesson");
  const forged = await request(app, "/api/v1/parent/lessons", { method: "POST", headers,
    body: JSON.stringify({ ...body, family_id: "other" }) });
  assert.equal(forged.status, 422);
});

test("parent lesson detail is owner-only and omits answer keys", async () => {
  const base = authenticatedDatabase();
  const app = createApp({ config: config(), db: authenticatedDatabase({ items: {
    ...base.items,
    async getAdmin(itemId, ownerFamilyId) {
      assert.equal(itemId, "owned-lesson");
      assert.equal(ownerFamilyId, family.id);
      return { ...adminCatalogItem, id: itemId, source_type: "custom", owner_family_id: family.id };
    },
  } }) });
  assert.equal((await request(app, "/api/v1/parent/lessons/owned-lesson")).status, 401);
  const response = await request(app, "/api/v1/parent/lessons/owned-lesson", { headers: { cookie: "plg_session=opaque" } });
  assert.equal(response.status, 200);
  const detail = await response.json() as { quiz_questions: Array<Record<string, unknown>> };
  assert.equal(detail.quiz_questions.length, 1);
  assert.equal("correct_answers" in detail.quiz_questions[0]!, false);
});

test("parent lesson update validates body id and scopes update to owner", async () => {
  let received: unknown;
  const base = authenticatedDatabase();
  const app = createApp({ config: config(), db: authenticatedDatabase({ items: {
    ...base.items,
    async updateBatch(input, ownerFamilyId) {
      received = { input, ownerFamilyId };
      return [{ id: "owned-lesson", category: "animal", is_published: true,
        quiz_required: false, translation_count: 1, media_count: 0, quiz_question_count: 0 }];
    },
  } }) });
  const headers = { cookie: "plg_session=opaque", "content-type": "application/json" };
  const valid = await request(app, "/api/v1/parent/lessons/owned-lesson", {
    method: "PUT", headers, body: JSON.stringify({ item: { id: "owned-lesson", category: "animal" } }),
  });
  assert.equal(valid.status, 200);
  assert.deepEqual(received, { input: [{ id: "owned-lesson", category: "animal" }], ownerFamilyId: family.id });
  const mismatched = await request(app, "/api/v1/parent/lessons/owned-lesson", {
    method: "PUT", headers, body: JSON.stringify({ item: { id: "other", category: "animal" } }),
  });
  assert.equal(mismatched.status, 422);
  const forged = await request(app, "/api/v1/parent/lessons/owned-lesson", {
    method: "PUT", headers, body: JSON.stringify({ item: { id: "owned-lesson" }, family_id: "other" }),
  });
  assert.equal(forged.status, 422);
});

test("parent lesson share uses session owner and validated target", async () => {
  let received: unknown;
  const base = authenticatedDatabase();
  const app = createApp({ config: config(), db: authenticatedDatabase({ parent: {
    ...base.parent,
    async shareLesson(familyId, itemId, target) { received = { familyId, itemId, target }; },
  } }) });
  const headers = { cookie: "plg_session=opaque", "content-type": "application/json" };
  const response = await request(app, "/api/v1/parent/lessons/owned-lesson/share", {
    method: "POST", headers, body: JSON.stringify({ target_scope: "profile", target_family_id: "friend-family", target_profile_id: "friend-profile" }),
  });
  assert.equal(response.status, 204);
  assert.deepEqual(received, { familyId: family.id, itemId: "owned-lesson", target: {
    target_scope: "profile", target_family_id: "friend-family", target_profile_id: "friend-profile",
  } });
  const forged = await request(app, "/api/v1/parent/lessons/owned-lesson/share", {
    method: "POST", headers, body: JSON.stringify({ target_scope: "family", target_family_id: "friend-family", family_id: "other" }),
  });
  assert.equal(forged.status, 422);
});

test("admin session is private and requires an admin family", async () => {
  const ordinary = createApp({ config: config(), db: authenticatedDatabase() });
  assert.equal((await request(ordinary, "/api/v1/admin/session")).status, 401);
  assert.equal((await request(ordinary, "/api/v1/admin/session", { headers: { cookie: "plg_session=opaque" } })).status, 403);
  const admin = createApp({ config: config(), db: authenticatedDatabase({ auth: {
    ...database().auth,
    async findFamilyByEmail() { return adminFamily; },
    async createFamily(input) { return input; },
    async createSession() {},
    async findFamilyBySessionHash() { return adminFamily; },
    async deleteSession() {},
  } }) });
  const response = await request(admin, "/api/v1/admin/session", { headers: { cookie: "plg_session=opaque" } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { is_admin: true });
});

test("profile-targeted item listing and detail require a verified owned profile", async () => {
  let receivedList: unknown;
  let receivedGet: unknown;
  const base = authenticatedDatabase();
  const app = createApp({ config: config(), db: authenticatedDatabase({ items: {
    ...base.items,
    async list(input) { receivedList = input; return []; },
    async get(itemId, lang, familyId, profileId) {
      receivedGet = { itemId, lang, familyId, profileId };
      return { ...item, media: [], available_languages: ["en"] };
    },
  } }) });
  const headers = { cookie: "plg_session=opaque" };
  assert.equal((await request(app, "/api/v1/items?profile_id=other", { headers })).status, 404);
  assert.equal((await request(app, "/api/v1/items/item-1?profile_id=other", { headers })).status, 404);
  assert.equal((await request(app, "/api/v1/items?profile_id=profile-1", { headers })).status, 200);
  assert.deepEqual(receivedList, { familyId: family.id, limit: 5000, profileId: profile.id });
  assert.equal((await request(app, "/api/v1/items/item-1?profile_id=profile-1", { headers })).status, 200);
  assert.deepEqual(receivedGet, { itemId: item.id, lang: "en", familyId: family.id, profileId: profile.id });
});

test("profile-targeted quiz and flashcard options require a verified owned profile", async () => {
  let receivedQuiz: unknown;
  let receivedOptions: unknown;
  const base = authenticatedDatabase();
  const app = createApp({ config: config(), db: authenticatedDatabase({
    quiz: { ...base.quiz, async getItemQuiz(itemId, lang, familyId, profileId) {
      receivedQuiz = { itemId, lang, familyId, profileId };
      return { questions: [], difficulty: "Easy" as const };
    } },
    flashcards: { ...base.flashcards, async getOptions(itemId, lang, familyId, profileId) {
      receivedOptions = { itemId, lang, familyId, profileId };
      return [];
    } },
  }) });
  const headers = { cookie: "plg_session=opaque" };
  assert.equal((await request(app, "/api/v1/items/item-1/quiz?profile_id=other", { headers })).status, 404);
  assert.equal((await request(app, "/api/v1/items/item-1/flashcards/options?profile_id=other", { headers })).status, 404);
  assert.equal((await request(app, "/api/v1/items/item-1/quiz?profile_id=profile-1", { headers })).status, 200);
  assert.deepEqual(receivedQuiz, { itemId: item.id, lang: "en", familyId: family.id, profileId: profile.id });
  assert.equal((await request(app, "/api/v1/items/item-1/flashcards/options?profile_id=profile-1", { headers })).status, 200);
  assert.deepEqual(receivedOptions, { itemId: item.id, lang: "en", familyId: family.id, profileId: profile.id });
});

test("readiness accepts the actual Render service Host", async () => {
  const app = createApp({
    config: config({
      nodeEnv: "production",
      renderExternalHostname: "plg-api.onrender.com",
    }),
    db: database(),
  });
  const response = await app.request("https://plg-api.onrender.com/api/v1/health/ready");
  assert.equal(response.status, 200);
});

test("an arbitrary client cannot use X-Forwarded-Host to bypass Host validation", async () => {
  const app = createApp({
    config: config({
      nodeEnv: "production",
      trustProxyHeaders: true,
      renderExternalHostname: "plg-api.onrender.com",
    }),
    db: database(),
  });
  const response = await app.request("https://evil.example/api/v1/health/ready", {
    headers: { "x-forwarded-host": "app.example.com" },
  });
  assert.equal(response.status, 421);
  assert.deepEqual(await response.json(), {
    error: { code: "HOST_NOT_ALLOWED", message: "Host is not allowed." },
  });
});

test("a trusted Render proxy can forward an allowlisted frontend Host", async () => {
  const app = createApp({
    config: config({
      nodeEnv: "production",
      trustProxyHeaders: true,
      renderExternalHostname: "plg-api.onrender.com",
    }),
    db: database(),
  });
  const response = await app.request("https://plg-api.onrender.com/api/v1/health/ready", {
    headers: { "x-forwarded-host": "app.example.com" },
  });
  assert.equal(response.status, 200);
});

test("registration hashes passwords and session lookup uses an opaque cookie", async () => {
  let createdFamily: FamilyRecord | undefined;
  let sessionHash = "";
  const app = createApp({
    config: config(),
    db: database({
      auth: {
        ...database().auth,
        async findFamilyByEmail() { return null; },
        async createFamily(input) {
          createdFamily = { ...input };
          return createdFamily;
        },
        async createSession(input) { sessionHash = input.tokenHash; },
        async findFamilyBySessionHash(tokenHash) {
          return tokenHash === sessionHash ? { ...family, ...createdFamily } : null;
        },
        async deleteSession() {},
      },
    }),
  });

  const registration = await request(app, "/api/v1/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "parent@example.com", password: "a secure password", name: "Parent", legalVersion: LEGAL_VERSION }),
  });
  assert.equal(registration.status, 201);
  assert.ok(createdFamily?.passwordHash.startsWith("$argon2id$"));
  assert.equal(createdFamily?.legalAcceptedVersion, LEGAL_VERSION);
  assert.ok(createdFamily?.legalAcceptedAt instanceof Date);
  assert.match(registration.headers.get("set-cookie") ?? "", /HttpOnly/);
  assert.match(registration.headers.get("set-cookie") ?? "", /SameSite=Lax/);
  assert.match(registration.headers.get("set-cookie") ?? "", /Path=\//);
  assert.notEqual(sessionHash, "");

  const cookie = registration.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);
  const session = await request(app, "/api/v1/auth/session", {
    headers: { cookie },
  });
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), {
    authenticated: true,
    user: { id: createdFamily?.id, email: "parent@example.com", name: "Parent" },
    signOutUrl: "/api/v1/auth/logout",
  });
});

test("forged identity headers cannot authorize a protected request", async () => {
  const app = createApp({ config: config(), db: database() });
  const response = await request(app, "/api/v1/profiles", {
    headers: {
      "oai-authenticated-user-id": "family-1",
      "oai-authenticated-user-email": "parent@example.com",
    },
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required." },
  });
});

test("profile input rejects client ownership and role fields", async () => {
  const app = createApp({ config: config(), db: authenticatedDatabase() });
  const response = await request(app, "/api/v1/profiles", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "plg_session=invalid" },
    body: JSON.stringify({
      name: "Learner",
      emoji: "🌟",
      color: "blue",
      family_id: "other-family",
      role: "admin",
    }),
  });

  assert.equal(response.status, 422);
  assert.deepEqual((await response.json() as { error: { code: string } }).error.code, "VALIDATION_ERROR");
});

test("profile updates persist avatar selection and frame changes", async () => {
  const base = authenticatedDatabase();
  const writes: UpdateProfileInput[] = [];
  let savedProfile: ProfileRecord = { ...profile };
  const app = createApp({
    config: config(),
    db: authenticatedDatabase({
      profiles: {
        ...base.profiles,
        async update(_familyId, _profileId, input) {
          writes.push(input);
          savedProfile = {
            ...savedProfile,
            ...(input.avatar_type !== undefined ? { avatar_type: input.avatar_type } : {}),
            ...(input.avatar_url !== undefined ? { avatar_url: input.avatar_url } : {}),
            ...(input.avatar_frame !== undefined ? { avatar_frame: input.avatar_frame } : {}),
          };
          return savedProfile;
        },
      },
    }),
  });
  const headers = { cookie: "plg_session=opaque", "content-type": "application/json" };
  const first = await request(app, "/api/v1/profiles/profile-1", {
    method: "PUT",
    headers,
    body: JSON.stringify({ avatar_type: "default", avatar_url: "capybara-calm", avatar_frame: "ufo" }),
  });
  assert.equal(first.status, 200);
  assert.equal((await first.json() as { avatar_frame?: string }).avatar_frame, "ufo");
  assert.equal(writes[0]?.avatar_url, "capybara-calm");

  const cleared = await request(app, "/api/v1/profiles/profile-1", {
    method: "PUT",
    headers,
    body: JSON.stringify({ avatar_frame: null }),
  });
  assert.equal(cleared.status, 200);
  assert.equal(writes[1]?.avatar_frame, null);
  assert.equal((await cleared.json() as { avatar_frame?: string }).avatar_frame, undefined);
  for (const frame of ["car", "plane", "jet", "volcano", "helicopter"]) {
    const response = await request(app, "/api/v1/profiles/profile-1", { method: "PUT", headers, body: JSON.stringify({ avatar_frame: frame }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { avatar_frame: string }).avatar_frame, frame);
  }
  assert.equal((await request(app, "/api/v1/profiles/profile-1", { method: "PUT", headers, body: JSON.stringify({ avatar_frame: "unknown-frame" }) })).status, 422);

});

test("catalog ingestion requires an authenticated admin", async () => {
  const app = createApp({ config: config(), db: database() });
  const response = await request(app, "/api/v1/admin/items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ category: "animal" }),
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required." },
  });
});

test("catalog ingestion rejects a normal family even with a valid session", async () => {
  const app = createApp({ config: config(), db: authenticatedDatabase() });
  const response = await request(app, "/api/v1/admin/items", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "plg_session=opaque" },
    body: JSON.stringify({ category: "animal" }),
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: { code: "ADMIN_REQUIRED", message: "Administrator access is required." },
  });
});

test("catalog ingestion validates the payload and forwards only server-owned catalog data", async () => {
  let received: Record<string, unknown> | undefined;
  const app = createApp({
    config: config(),
    db: database({
      auth: {
        ...database().auth,
        async findFamilyByEmail() { return adminFamily; },
        async createFamily(input) { return input; },
        async createSession() {},
        async findFamilyBySessionHash() { return adminFamily; },
        async deleteSession() {},
      },
      items: {
        async canReadMedia() { return false; },
        async list() { return []; },
        async get() { return null; },
        async create(input) {
          received = input as unknown as Record<string, unknown>;
          return {
            id: input.id ?? "generated-id",
            category: input.category,
            is_published: input.is_published,
            quiz_required: input.quiz_required,
            translation_count: input.translations.length,
            media_count: input.media.length,
            quiz_question_count: input.quiz_questions.length,
          };
        },
        async getAdmin() {
          return null;
        },
        async listAdmin() { return []; },
        async updateBatch() {
          throw new Error("not used");
        },
        async deleteAdmin() { return false; },
      },
    }),
  });
  const response = await request(app, "/api/v1/admin/items", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "plg_session=opaque" },
    body: JSON.stringify({
      id: "saola-vn",
      category: "animal",
      latitude: 16.2,
      longitude: 107.8,
      translations: [{ lang: "en", title: "Saola" }],
      quiz_questions: [{
        lang: "en",
        question: "Where is it found?",
        question_type: "single",
        options: ["Vietnam", "Canada"],
        correct_answers: [0],
      }],
      owner_family_id: "attacker-controlled-family",
    }),
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "VALIDATION_ERROR");
  assert.equal(received, undefined);

  const validResponse = await request(app, "/api/v1/admin/items", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "plg_session=opaque" },
    body: JSON.stringify({
      id: "saola-vn",
      category: "animal",
      latitude: 16.2,
      longitude: 107.8,
      translations: [{ lang: "en", title: "Saola" }],
      quiz_questions: [{
        lang: "en",
        question: "Where is it found?",
        question_type: "single",
        options: ["Vietnam", "Canada"],
        correct_answers: [0],
      }],
    }),
  });
  assert.equal(validResponse.status, 201);
  assert.deepEqual(await validResponse.json(), {
    id: "saola-vn",
    category: "animal",
    is_published: false,
    quiz_required: true,
    translation_count: 1,
    media_count: 0,
    quiz_question_count: 1,
  });
  assert.equal((received as unknown as { owner_family_id?: unknown }).owner_family_id, undefined);
  assert.equal((received as unknown as { quiz_required?: unknown }).quiz_required, true);
});

test("admin catalog reads return unpublished editable item data", async () => {
  let requestedId: string | undefined;
  const app = createApp({
    config: config(),
    db: database({
      auth: {
        ...database().auth,
        async findFamilyByEmail() { return adminFamily; },
        async createFamily(input) { return input; },
        async createSession() {},
        async findFamilyBySessionHash() { return adminFamily; },
        async deleteSession() {},
      },
      items: {
        async canReadMedia() { return false; },
        async list() { return []; },
        async get() { return null; },
        async create() { throw new Error("not used"); },
        async getAdmin(itemId) {
          requestedId = itemId;
          return itemId === adminCatalogItem.id ? adminCatalogItem : null;
        },
        async listAdmin() { return []; },
        async updateBatch() { throw new Error("not used"); },
        async deleteAdmin() { return false; },
      },
    }),
  });
  const response = await request(app, "/api/v1/admin/items/saola-vn", {
    headers: { cookie: "plg_session=opaque" },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), adminCatalogItem);
  assert.equal(requestedId, "saola-vn");
});

test("admin catalog batch updates validate at the route and return repository summaries", async () => {
  let received: unknown;
  const app = createApp({
    config: config(),
    db: database({
      auth: {
        ...database().auth,
        async findFamilyByEmail() { return adminFamily; },
        async createFamily(input) { return input; },
        async createSession() {},
        async findFamilyBySessionHash() { return adminFamily; },
        async deleteSession() {},
      },
      items: {
        async canReadMedia() { return false; },
        async list() { return []; },
        async get() { return null; },
        async create() { throw new Error("not used"); },
        async getAdmin() { return null; },
        async listAdmin() { return []; },
        async updateBatch(input) {
          received = input;
          return input.map((value) => ({
            id: value.id,
            category: value.category ?? "animal",
            is_published: value.is_published ?? false,
            quiz_required: value.quiz_required ?? false,
            translation_count: value.translations?.length ?? 1,
            media_count: value.media?.length ?? 0,
            quiz_question_count: value.quiz_questions?.length ?? 0,
          }));
        },
        async deleteAdmin() { return false; },
      },
    }),
  });
  const response = await request(app, "/api/v1/admin/items/batch", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: "plg_session=opaque" },
    body: JSON.stringify({
      items: [
        { id: "saola-vn", location_desc: null },
        { id: "another-item", is_published: true },
      ],
    }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [
    { id: "saola-vn", category: "animal", is_published: false, quiz_required: false, translation_count: 1, media_count: 0, quiz_question_count: 0 },
    { id: "another-item", category: "animal", is_published: true, quiz_required: false, translation_count: 1, media_count: 0, quiz_question_count: 0 },
  ]);
  assert.deepEqual(received, [
    { id: "saola-vn", location_desc: null },
    { id: "another-item", is_published: true },
  ]);

  const tooLarge = await request(app, "/api/v1/admin/items/batch", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: "plg_session=opaque" },
    body: JSON.stringify({ items: Array.from({ length: 101 }, (_, index) => ({ id: `item-${index}` })) }),
  });
  assert.equal(tooLarge.status, 422);
  assert.equal((await tooLarge.json() as { error: { code: string } }).error.code, "VALIDATION_ERROR");
});

test("admin item list, single update, and delete use the canonical catalog contract", async () => {
  let updated: unknown;
  let deleted: unknown;
  const base = authenticatedDatabase();
  const app = createApp({ config: config(), db: authenticatedDatabase({
    auth: { ...base.auth, async findFamilyBySessionHash() { return adminFamily; } },
    items: { ...base.items,
      async listAdmin(limit) {
        assert.equal(limit, 5000);
        return [{ id: "item-1", category: "animal", is_published: true, title_en: "Saola", created_at: "2026-09-21T00:00:00.000Z" }];
      },
      async updateBatch(input) {
        updated = input;
        return [{ id: "item-1", category: "animal", is_published: false, quiz_required: false,
          translation_count: 1, media_count: 0, quiz_question_count: 0 }];
      },
      async deleteAdmin(itemId) { deleted = itemId; return true; },
    },
  }) });
  const headers = { cookie: "plg_session=opaque", "content-type": "application/json" };
  assert.equal((await request(app, "/api/v1/admin/items")).status, 401);
  const listed = await request(app, "/api/v1/admin/items", { headers });
  assert.equal(listed.status, 200);
  assert.deepEqual(await listed.json(), [{ id: "item-1", category: "animal", is_published: true,
    title_en: "Saola", created_at: "2026-09-21T00:00:00.000Z" }]);
  const changed = await request(app, "/api/v1/admin/items/item-1", { method: "PUT", headers,
    body: JSON.stringify({ item: { id: "item-1", is_published: false } }) });
  assert.equal(changed.status, 200);
  assert.deepEqual(updated, [{ id: "item-1", is_published: false }]);
  assert.equal((await changed.json() as { id: string }).id, "item-1");
  assert.equal((await request(app, "/api/v1/admin/items/item-1", { method: "PUT", headers,
    body: JSON.stringify({ item: { id: "other", is_published: false } }) })).status, 422);
  assert.equal((await request(app, "/api/v1/admin/items/item-1", { method: "DELETE", headers })).status, 204);
  assert.equal(deleted, "item-1");
});

test("admin catalog refresh is role-protected and reports no-op batches", async () => {
  const base = authenticatedDatabase();
  let refreshes = 0;
  let refreshOptions: { research?: boolean } | undefined;
  const app = createApp({ config: config(), db: authenticatedDatabase({
    auth: { ...base.auth, async findFamilyBySessionHash() { return adminFamily; } },
    catalog: {
      async refresh(options) {
        refreshes += 1;
        refreshOptions = options;
        return { updated_count: 0, skipped_count: 4614, batches: 0 };
      },
    },
  }) });
  const headers = { cookie: "plg_session=opaque" };
  assert.equal((await request(app, "/api/v1/admin/items/refresh")).status, 401);
  assert.equal((await request(app, "/api/v1/admin/items/refresh", { method: "GET", headers })).status, 405);
  const response = await request(app, "/api/v1/admin/items/refresh", { method: "POST", headers });
  assert.equal(response.status, 202);
  const queued = await response.json() as { job_id: string; status: string };
  assert.match(queued.job_id, /^[0-9a-f-]{36}$/);
  assert.ok(["queued", "running"].includes(queued.status));
  await new Promise<void>((resolve) => setImmediate(resolve));
  const status = await request(app, "/api/v1/admin/items/refresh/status", { headers });
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), {
    job_id: queued.job_id,
    status: "completed",
    total_batches: null,
    completed_batches: 0,
    updated_count: 0,
    skipped_count: 4614,
    batches: 0,
  });
  assert.equal(refreshes, 1);
  assert.equal(refreshOptions?.research, false);

  const ordinary = createApp({ config: config(), db: base });
  assert.equal((await request(ordinary, "/api/v1/admin/items/refresh", { method: "POST", headers })).status, 403);
});

test("admins create ordinary families without replacing their session or enabling public registration", async () => {
  const base = database();
  const root = { ...adminFamily, id: "root", email: "root@system.local" };
  let created: FamilyRecord | undefined;
  let sessions = 0;
  const db = database({ auth: { ...base.auth,
    async findFamilyBySessionHash() { return root; },
    async createFamily(input) { created = input; return base.auth.createFamily(input); },
    async createSession() { sessions++; },
  } });
  const app = createApp({ config: config({ allowRegistration: false }), db });
  const headers = { cookie: "plg_session=opaque", "content-type": "application/json", origin: "https://app.example.com" };
  const input = { name: " New Family ", email: " FAMILY@EXAMPLE.TEST ", password: "local-fixture-password" };
  const post = (body = input) => request(app, "/api/v1/admin/families", { method: "POST", headers, body: JSON.stringify(body) });
  const response = await post();
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const result = await response.json() as Record<string, unknown>;
  assert.deepEqual(Object.keys(result).sort(), ["display_name", "email", "id"]);
  assert.equal(created?.role, "family");
  assert.equal(created?.email, "family@example.test");
  assert.equal(created?.displayName, "New Family");
  assert.ok(created?.passwordHash.startsWith("$argon2id$"));
  assert.equal(sessions, 0);
  assert.equal(created?.legalAcceptedAt, undefined);
  assert.equal(created?.legalAcceptedVersion, undefined);
  const duplicate = await post();
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error.code, "FAMILY_EXISTS");
  assert.equal((await post({ ...input, email: "root@system.local" })).status, 409);
  assert.equal((await post({ ...input, password: "short" })).status, 422);
  assert.equal((await request(app, "/api/v1/admin/families", { method: "POST", headers, body: JSON.stringify({ ...input, role: "admin" }) })).status, 422);
  assert.equal((await request(app, "/api/v1/admin/families", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) })).status, 401);
  for (const owner of [family]) {
    const forbidden = createApp({ config: config(), db: database({ auth: { ...base.auth, async findFamilyBySessionHash() { return owner; } } }) });
    assert.equal((await request(forbidden, "/api/v1/admin/families", { method: "POST", headers, body: JSON.stringify(input) })).status, 403);
  }
  const admin = createApp({ config: config({ allowRegistration: false }), db: database({ auth: {
    ...database().auth, async findFamilyBySessionHash() { return adminFamily; },
  } }) });
  const adminCreated = await request(admin, "/api/v1/admin/families", { method: "POST", headers, body: JSON.stringify(input) });
  assert.equal(adminCreated.status, 201);
  assert.equal(adminCreated.headers.get("set-cookie"), null);
});

test("admin password replacement is scoped, validated, and never returns a secret", async () => {
  const base = database();
  const calls: Array<{ targetId: string; actorId: string; passwordHash: string; reason: string }> = [];
  const auth = {
    ...base.auth,
    async findFamilyBySessionHash() { return adminFamily; },
    async setFamilyPassword(input: { targetId: string; actorId: string; passwordHash: string; reason: string }) {
      calls.push(input);
      return input.targetId === "family-1" ? "updated" as const : "not_found" as const;
    },
  };
  const app = createApp({ config: config(), db: database({ auth }) });
  const path = "/api/v1/admin/families/family-1/password";
  const headers = { cookie: "plg_session=opaque", "content-type": "application/json", origin: "https://app.example.com" };
  const body = { new_password: "new-secure-password", reason: " Support request " };
  const put = (payload: unknown, target = path) => request(app, target, { method: "PUT", headers, body: JSON.stringify(payload) });
  const response = await put(body);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(calls.length, 1);
  const call = calls[0]!;
  assert.deepEqual({ targetId: call.targetId, actorId: call.actorId, reason: call.reason },
    { targetId: "family-1", actorId: "admin-family", reason: "Support request" });
  assert.ok(call.passwordHash.startsWith("$argon2id$"));
  assert.equal((await put({ ...body, actorId: "forged" })).status, 422);
  assert.equal((await put({ ...body, new_password: "short" })).status, 422);
  assert.equal((await put({ ...body, reason: `Shared ${body.new_password} with the family` })).status, 422);
  assert.equal((await put(body, "/api/v1/admin/families/missing/password")).status, 404);
  assert.equal((await put(body, "/api/v1/admin/families/root/password")).status, 404);
  assert.equal((await request(app, path, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).status, 401);
  const ordinary = createApp({ config: config(), db: database({ auth: { ...auth, async findFamilyBySessionHash() { return family; } } }) });
  assert.equal((await request(ordinary, path, { method: "PUT", headers, body: JSON.stringify(body) })).status, 403);
});

test("admin family report requires admin role and retains nested profile and request fields", async () => {
  const base = authenticatedDatabase();
  const expected = [{
    id: "family-1", display_name: "Parent", created_at: "2026-09-21T00:00:00.000Z",
    profile_count: 1, accepted_request_count: 0, pending_incoming_count: 0,
    pending_outgoing_count: 0, rejected_request_count: 0,
    profiles: [{ id: "profile-1", name: "Learner", emoji: "🌟", color: "blue", public_id: "PROFILE01",
      created_at: "2026-09-21T00:00:00.000Z", total_done: 0, badge_count: 0,
      total_items: 1, completion_rate: 0, recent_activities: [] }], friend_requests: [],
  }];
  const adminDb = authenticatedDatabase({
    auth: { ...base.auth, async findFamilyBySessionHash() { return adminFamily; } },
    admin: { ...base.admin, async families() { return expected; } },
  });
  const app = createApp({ config: config(), db: adminDb });
  assert.equal((await request(app, "/api/v1/admin/families")).status, 401);
  const ordinary = createApp({ config: config(), db: authenticatedDatabase() });
  assert.equal((await request(ordinary, "/api/v1/admin/families", { headers: { cookie: "plg_session=opaque" } })).status, 403);
  const response = await request(app, "/api/v1/admin/families", { headers: { cookie: "plg_session=opaque" } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected);
});

test('admin family learning reports reuse the saved snapshot and require admin access', async () => {
  const { summarizeChild, summarizeFamily } = await import('../src/parent-reports/summary.js');
  const saved = summarizeFamily([summarizeChild({ ...profile, miniku: { completed: 7 }, quiz_attempts: 2,
    math_wall: { stats: { passed: 10, hard: 10 } },
    cabbage_rolls: {completed:1,perfect:1},
    fishing: { stats: { caught: 3, questions: 4, casts: 4 }, points: { pond: 8, river: 0 }, discovered: { pond: ['P1', 'P2'], river: [] },
      earnedBaits: ['baby'], friendCatches: ['cow'], earned: { 'fishing-first-nibble': '2026-10-19T00:00:00Z' }, question: { answer: 'PRIVATE-FISHING-ANSWER' } },
    town:{entities:[{blueprintId:'bakery',civ:{phase:'ready'}}],civ:{helpedTypes:['bakery']},earned:{'town-new-neighbor':'2026-10-16T00:00:00Z'}} })], new Date('2026-10-14T00:00:00Z'));
  const reads: string[] = [];
  const base = authenticatedDatabase();
  const reports = { async read(id: string) { reads.push(id); return saved; } };
  const adminDb = authenticatedDatabase({ auth: { ...base.auth, async findFamilyBySessionHash() { return adminFamily; } }, parentReports: reports });
  const app = createApp({ config: config(), db: adminDb });
  const path = '/api/v1/admin/families/family-1/reports';
  const headers = { cookie: 'plg_session=opaque' };
  assert.equal((await request(app, path)).status, 401);
  const ordinary = createApp({ config: config(), db: authenticatedDatabase({ parentReports: reports }) });
  assert.equal((await request(ordinary, path, { headers })).status, 403);
  assert.deepEqual(reads, []);
  const response = await request(app, path, { headers });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), saved);
  const scientist = saved.children[0]!.games.find(game => game.id === 'waddle-wall')!.achievements.find(badge => badge.id === 'waddle-wall-scientist');
  assert.equal(scientist?.earned, true);
  assert.equal(scientist?.name, 'Math Scientist');
  assert.equal(scientist?.badge, '/minigames/math-quiz-wall/math-scientist.png');
  const cabbageReport=saved.children[0]!.games.find(g=>g.id==='cabbage-rolls')!;
  assert.equal(cabbageReport.earning,'server-verified');
  assert.deepEqual(cabbageReport.achievements.map(b=>b.earned),[true,false,false,true]);
  const townReport=saved.children[0]!.games.find(g=>g.id==='town-building')!;
  assert.equal(townReport.achievements.filter(a=>a.badge==='/minigames/town-building/civ-badges-v1.png').length,3);
  assert.equal(townReport.achievements.find(a=>a.id==='town-new-neighbor')!.earned,true);
  assert.equal(townReport.metrics.find(m=>m.key==='neighbors')!.value,2);
  const fishingReport = saved.children[0]!.games.find(game => game.id === 'fishing')!;
  assert.equal(fishingReport.achievements.length, 7);
  assert.equal(fishingReport.achievements.find(badge => badge.id === 'fishing-first-nibble')?.earned, true);
  assert.equal(fishingReport.metrics.find(metric => metric.key === 'pondPoints')?.value, 8);
  assert.equal(JSON.stringify(saved).includes('PRIVATE-FISHING-ANSWER'), false);
  assert.deepEqual(reads, ['family-1'], 'target family, never the administrator’s own family');
  assert.equal((await request(app, path.replace('family-1', 'missing'), { headers })).status, 404);
  assert.equal((await request(app, path, { method: 'POST', headers: { ...headers, origin: 'https://app.example.com' } })).status, 405);
  for (const query of ['family_id=forged', 'profile_id=forged', 'page=1&page=2', '__proto__=x']) {
    assert.equal((await request(app, `${path}?${query}`, { headers })).status, 422);
  }
  assert.deepEqual(reads, ['family-1']);
  const { parentReports: omittedReports, ...withoutReports } = adminDb;
  assert.ok(omittedReports);
  const unavailable = createApp({ config: config(), db: withoutReports });
  assert.equal((await request(unavailable, path, { headers })).status, 503);
});

test("admin profile inspection is read-only, role protected, and checks family/profile pairing", async () => {
  const base = authenticatedDatabase();
  const paths = ["", "/activities", "/journey"].map((suffix) => `/api/v1/admin/families/family-1/profiles/profile-1${suffix}`);
  const seen: unknown[] = [];
  const detail = { ...profile, family_id: "family-1", family_name: "Parent", quiz_attempt_count: 2, flashcard_session_count: 1 };
  const db = authenticatedDatabase({
    auth: { ...base.auth, async findFamilyBySessionHash() { return adminFamily; } },
    admin: { ...base.admin,
      async profile(familyId: string, profileId: string) { seen.push([familyId, profileId]); return familyId === "family-1" ? detail : null; },
      async activities(_familyId: string, _profileId: string, query: unknown) { seen.push(query); return { activities: [], page: 2, page_size: 20, total: 0, total_pages: 1 }; },
      async journey(_familyId: string, _profileId: string, query: unknown) { seen.push(query); return { origin: { latitude: 0, longitude: 0, title: "Start" }, waypoints: [], exploredCount: 0, page: 1, page_size: 100, total: 0, total_pages: 1 }; },
    } as AppDatabase["admin"],
  });
  const app = createApp({ config: config(), db });
  const headers = { cookie: "plg_session=opaque" };
  const ordinary = createApp({ config: config(), db: base });
  for (const path of paths) {
    assert.equal((await request(app, path)).status, 401);
    assert.equal((await request(ordinary, path, { headers })).status, 403);
    assert.equal((await request(app, path, { method: "POST", headers: { ...headers, origin: "https://app.example.com" } })).status, 405);
    assert.equal((await request(app, path.replace("family-1", "family-other"), { headers })).status, 404);
  }
  const response = await request(app, paths[0]!, { headers });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), detail);
  assert.equal(response.headers.get("cache-control"), "no-store");
  for (const query of ["family_id=forged", "page=1&page=2", "__proto__=x", "__proto__=x&__proto__=y"]) {
    assert.equal((await request(app, `${paths[0]}?${query}`, { headers })).status, 422, query);
  }
  assert.equal((await request(app, `${paths[1]}?page=2&page_size=20&type=quiz`, { headers })).status, 200);
  assert.ok(seen.some((entry) => JSON.stringify(entry) === JSON.stringify({ page: 2, page_size: 20, type: "quiz" })));
  assert.equal((await request(app, `${paths[2]}?period=yesterday`, { headers })).status, 200);
  for (const query of ["page=0", "page=1.5", "page=1000001", "page_size=101", "type=login", "page=1&page=2", "family_id=forged", "__proto__=x", "__proto__=x&__proto__=y"]) {
    assert.equal((await request(app, `${paths[1]}?${query}`, { headers })).status, 422, query);
  }
  for (const query of ["period=forever", "page_size=501", "page=-1", "period=today&period=all", "__proto__=x"]) {
    assert.equal((await request(app, `${paths[2]}?${query}`, { headers })).status, 422, query);
  }
});

test("admin assessment reports require admin role and return safe 404 for missing detail", async () => {
  const base = authenticatedDatabase();
  const summary = { id: "item-1", item_id: "item-1", assessment_type: "quiz" as const,
    item_title: "Saola", item_category: "animal", country_code: "VN", created_at: "2026-09-21T00:00:00.000Z",
    question_count: 1, active_question_count: 1, language_count: 1, attempt_count: 0,
    unique_profile_count: 0, pass_rate: 0, fail_rate: 0, average_score_rate: 0,
    average_time_seconds: null, latest_attempt_at: null };
  const detail = { ...summary, questions: [{ id: "q-1", item_id: "item-1", question_group_id: null,
    lang: "en", question_type: "single", question: "Where?", options: ["VN", "CA"],
    correct_answers: [0], sort_order: 0, is_active: true, created_at: "2026-09-21T00:00:00.000Z" }], performance: [] };
  const app = createApp({ config: config(), db: authenticatedDatabase({
    auth: { ...base.auth, async findFamilyBySessionHash() { return adminFamily; } },
    admin: { ...base.admin,
      async assessments() { return [summary]; },
      async assessment(itemId) { return itemId === "item-1" ? detail : null; },
    },
  }) });
  const headers = { cookie: "plg_session=opaque" };
  assert.equal((await request(app, "/api/v1/admin/tests")).status, 401);
  const ordinary = createApp({ config: config(), db: authenticatedDatabase() });
  assert.equal((await request(ordinary, "/api/v1/admin/tests", { headers })).status, 403);
  assert.equal((await request(ordinary, "/api/v1/admin/tests/item-1", { headers })).status, 403);
  assert.deepEqual(await (await request(app, "/api/v1/admin/tests", { headers })).json(), [summary]);
  assert.deepEqual(await (await request(app, "/api/v1/admin/tests/item-1", { headers })).json(), detail);
  const missing = await request(app, "/api/v1/admin/tests/missing", { headers });
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: { code: "ASSESSMENT_NOT_FOUND", message: "Assessment not found." } });
});

test("profile reads are family-scoped through the database contract", async () => {
  const app = createApp({
    config: config(),
    db: database({
      auth: {
        ...database().auth,
        async findFamilyByEmail() { return family; },
        async createFamily(input) { return input; },
        async createSession() {},
        async findFamilyBySessionHash() { return family; },
        async deleteSession() {},
      },
      profiles: {
        async list(familyId) {
          return familyId === family.id ? [profile] : [];
        },
        async count() { return 1; },
        async get(familyId, profileId) {
          return familyId === family.id && profileId === profile.id ? profile : null;
        },
        async create() { return profile; },
        async update() { return profile; },
        async completeTour() { return profile; },
        async setAvatar() { return profile; },
        async delete() { return true; },
      },
    }),
  });

  const response = await request(app, "/api/v1/profiles/profile-foreign", {
    headers: { cookie: "plg_session=opaque" },
  });
  assert.equal(response.status, 404);
});

test("invalid media paths are rejected before storage access", async () => {
  const app = createApp({ config: config(), db: authenticatedDatabase() });
  // Encoding the slash keeps the traversal segment intact through URL
  // normalization so the application receives and rejects it.
  const response = await request(app, "/media/%2e%2e%2fprivate.png", {
    headers: { cookie: "plg_session=opaque" },
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: { code: "INVALID_MEDIA_PATH", message: "The media path is invalid." },
  });
});

test("avatar upload verifies profile ownership, image bytes, and storage support", async () => {
  const stored: string[] = [];
  const base = authenticatedDatabase();
  let avatarUrl = "";
  const app = createApp({ config: config(), db: authenticatedDatabase({ profiles: {
    ...base.profiles,
    async setAvatar(familyId, profileId, url) {
      assert.deepEqual([familyId, profileId], [family.id, profile.id]);
      avatarUrl = url;
      return { ...profile, avatar_type: "custom", avatar_url: url };
    },
  } }), media: {
    async get() { return null; },
    async put(key, bytes, contentType) {
      assert.equal(contentType, "image/png");
      assert.deepEqual([...bytes], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      stored.push(key);
    },
    async delete() {},
  } });
  const form = new FormData();
  form.set("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "avatar.png", { type: "image/png" }));
  const headers = { cookie: "plg_session=opaque" };
  assert.equal((await request(app, "/api/v1/profiles/profile-1/avatar", { method: "POST", body: form })).status, 401);
  assert.equal((await request(app, "/api/v1/profiles/foreign/avatar", { method: "POST", headers, body: form })).status, 404);
  const response = await request(app, "/api/v1/profiles/profile-1/avatar", { method: "POST", headers, body: form });
  assert.equal(response.status, 200);
  assert.match(avatarUrl, /^\/media\/profile-avatars\/family-1\/profile-1\/[0-9a-f-]+\.png$/);
  assert.equal(stored.length, 1);
  assert.equal((await response.json() as { avatar_url: string }).avatar_url, avatarUrl);
  const unsupported = createApp({ config: config(), db: authenticatedDatabase(), media: { async get() { return null; } } });
  assert.equal((await request(unsupported, "/api/v1/profiles/profile-1/avatar", { method: "POST", headers, body: form })).status, 503);
});

test("avatar media access requires the matching current family-owned profile key", async () => {
  const key = "profile-avatars/family-1/profile-1/00000000-0000-0000-0000-000000000000.png";
  const base = authenticatedDatabase();
  const app = createApp({ config: config(), db: authenticatedDatabase({ profiles: {
    ...base.profiles, async get(familyId, profileId) {
      return familyId === family.id && profileId === profile.id
        ? { ...profile, avatar_type: "custom", avatar_url: `/media/${key}` } : null;
    },
  } }), media: { async get() {
    return { body: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.close(); } }), contentType: "image/png" };
  } } });
  const headers = { cookie: "plg_session=opaque" };
  assert.equal((await request(app, `/media/${key}`)).status, 401);
  assert.equal((await request(app, `/media/${key}`, { headers })).status, 200);
  assert.equal((await request(app, "/media/profile-avatars/other/profile-1/old.png", { headers })).status, 404);
  assert.equal((await request(app, "/media/profile-avatars/family-1/profile-1/old.png", { headers })).status, 404);
});

test('friend avatar reads require a current request relationship and never cache across sessions',async()=>{
  const key='profile-avatars/other/kid/photo.png',base=authenticatedDatabase();let allowed=true,reads=0;
  const db=authenticatedDatabase({friendRequests:{...base.friendRequests,async canReadAvatar(familyId,requested){assert.equal(familyId,family.id);return allowed&&requested===key;}}});
  const app=createApp({config:config(),db,media:{async get(){reads++;return {body:new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array([1]));c.close();}}),contentType:'image/png'};}}});
  const headers={cookie:'plg_session=opaque'};
  const accepted=await request(app,`/media/${key}`,{headers});assert.equal(accepted.status,200);assert.match(accepted.headers.get('cache-control')??'',/no-store/);
  allowed=false;assert.equal((await request(app,`/media/${key}`,{headers})).status,404);assert.equal(reads,1);
  assert.equal((await request(app,'/media/profile-avatars/other/kid/old.png',{headers})).status,404);
});

test("auth requests are rate limited with a retry hint", async () => {
  const app = createApp({ config: config({ authRateLimitMax: 1 }), db: database() });
  const first = await request(app, "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "parent@example.com", password: "wrong password" }),
  });
  const second = await request(app, "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "parent@example.com", password: "wrong password" }),
  });
  assert.equal(first.status, 401);
  assert.equal(second.status, 429);
  assert.match(second.headers.get("retry-after") ?? "", /^\d+$/);
});

test("direct authentication quotas use adapter addresses and ignore forged forwarding headers", async () => {
  const app = createApp({
    config: config({ authRateLimitMax: 1 }), db: database(),
    clientAddress: (c) => (c.env as { remoteAddress: string }).remoteAddress,
  });
  const attempt = (address: string, forwarded: string) => app.request("https://app.example.com/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": forwarded },
    body: JSON.stringify({ email: "parent@example.com", password: "wrong password" }),
  }, { remoteAddress: address });
  assert.equal((await attempt("192.0.2.1", "203.0.113.1")).status, 401);
  assert.equal((await attempt("192.0.2.1", "203.0.113.2")).status, 429);
  assert.equal((await attempt("192.0.2.2", "203.0.113.1")).status, 401);
});

test("trusted Render proxy addresses have independent authentication quotas", async () => {
  const app = createApp({ config: config({ authRateLimitMax: 1, trustProxyHeaders: true, renderExternalHostname: "plg-api.onrender.com", authTrustedProxyCidrs: ["10.0.0.1", "192.0.2.10"] }), db: database(), clientAddress: () => "10.0.0.1" });
  const attempt = (address: string) => app.request("https://plg-api.onrender.com/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `${address}, 192.0.2.10` },
    body: JSON.stringify({ email: "parent@example.com", password: "wrong password" }),
  });
  assert.equal((await attempt("203.0.113.1")).status, 401);
  assert.equal((await attempt("203.0.113.1")).status, 429);
  assert.equal((await attempt("203.0.113.2")).status, 401);
});

test("anonymous registration availability reflects the server flag without opening registration", async () => {
  for (const enabled of [false, true]) {
    const app = createApp({ config: config({ allowRegistration: enabled }), db: database() });
    const response = await request(app, "/api/v1/auth/registration");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { enabled });
    if (!enabled) {
      const blocked = await request(app, "/api/v1/auth/register", { method: "POST" });
      assert.equal(blocked.status, 403);
      assert.equal((await blocked.json() as { error: { code: string } }).error.code, "REGISTRATION_DISABLED");
    }
  }
});

test("oversized JSON bodies are rejected before route parsing", async () => {
  const app = createApp({ config: config({ maxBodyBytes: 32 }), db: database() });
  const response = await request(app, "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "100" },
    body: JSON.stringify({ email: "parent@example.com", password: "wrong password" }),
  });
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    error: { code: "REQUEST_TOO_LARGE", message: "Request body is too large." },
  });
});

test("chunked JSON bodies are bounded while reading without Content-Length", async () => {
  const app = createApp({ config: config({ maxBodyBytes: 32 }), db: database() });
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('{"email":"parent@example.com",'));
      controller.enqueue(encoder.encode('"password":"wrong password"}'));
      controller.close();
    },
  });
  const init = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" };
  const response = await app.fetch(new Request("https://app.example.com/api/v1/auth/login", init));
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    error: { code: "REQUEST_TOO_LARGE", message: "Request body is too large." },
  });
});

test("invalid path parameters return a stable 400 envelope", async () => {
  const app = createApp({ config: config(), db: authenticatedDatabase() });
  const response = await request(app, "/api/v1/profiles/bad!", {
    headers: { cookie: "plg_session=opaque" },
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: { code: "INVALID_PATH_PARAMETER", message: "Path parameter is invalid." },
  });
});

test("unknown item categories preserve the INVALID_CATEGORY 400 contract", async () => {
  const app = createApp({ config: config(), db: authenticatedDatabase() });
  const response = await request(app, "/api/v1/items?category=unknown", {
    headers: { cookie: "plg_session=opaque" },
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: { code: "INVALID_CATEGORY", message: "Unknown item category." },
  });
});

test("catalog list and detail pass the authenticated family to item authorization", async () => {
  let listedFamilyId: string | undefined;
  let detailedFamilyId: string | undefined;
  const app = createApp({
    config: config(),
    db: authenticatedDatabase({
      items: {
        async canReadMedia() { return false; },
        async list(input) {
          listedFamilyId = input.familyId;
          return [item];
        },
        async get(itemId, _lang, familyId) {
          detailedFamilyId = familyId;
          return itemId === item.id ? { ...item, media: [], available_languages: ["en"] } : null;
        },
        async create() {
          throw new Error("not used");
        },
        async getAdmin() {
          return null;
        },
        async listAdmin() { return []; },
        async updateBatch() {
          throw new Error("not used");
        },
        async deleteAdmin() { return false; },
      },
    }),
  });
  const headers = { cookie: "plg_session=opaque" };

  assert.equal((await request(app, "/api/v1/items", { headers })).status, 200);
  assert.equal((await request(app, "/api/v1/items/item-1", { headers })).status, 200);
  assert.equal(listedFamilyId, family.id);
  assert.equal(detailedFamilyId, family.id);
});

test("all item-backed quiz and flashcard routes pass session family scope", async () => {
  const familyIds: string[] = [];
  const app = createApp({
    config: config(),
    db: authenticatedDatabase({
      quiz: {
        async getItemQuiz(...args) { familyIds.push(String(args[2])); return { questions: [], difficulty: "Easy" as const }; },
        async getItemStatus() { return { attempt_count: 0, passed: false, best_score: 0, best_total: 0, latest_score: 0, latest_total: 0 }; },
        async submitItem(...args) { familyIds.push(String(args.at(-1))); return { score: 0, total: 0, passed: false, new_badges: [] }; },
        async getDailyQuiz(...args) { familyIds.push(String(args.at(-1))); return { questions: [], difficulty: "Easy" as const }; },
        async getDailyStatus() { return { attempted_today: false, passed: false, score: 0, total: 0 }; },
        async submitDaily() { return { score: 0, total: 0, passed: false, new_badges: [] }; },
      },
      flashcards: {
        async getOptions(...args) { familyIds.push(String(args[2])); return []; },
        async getDeck(...args) { familyIds.push(String(args.at(-1))); return null; },
        async createStudySession(...args) {
          familyIds.push(String(args.at(-1)));
          return {
            id: "study-1", profile_id: "profile-1", theme_type: "category", theme_value: "animal", lang: "en",
            cards_shown: 1, got_it_count: 0, review_again_count: 0, responses: [],
            started_at: new Date("2026-09-20T09:00:00.000Z"), completed_at: new Date("2026-09-20T10:00:00.000Z"),
          };
        },
      },
    }),
  });
  const headers = { cookie: "plg_session=opaque" };
  await request(app, "/api/v1/items/item-1/quiz", { headers });
  await request(app, "/api/v1/profiles/profile-1/quiz/items/item-1/submit", {
    method: "POST", headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ answers: [{ question_id: "question-1", chosen_answers: [0] }] }),
  });
  await request(app, "/api/v1/profiles/profile-1/quiz/daily", { headers });
  await request(app, "/api/v1/items/item-1/flashcards/options", { headers });
  await request(app, "/api/v1/profiles/profile-1/items/item-1/flashcards/deck?theme_type=item&theme_value=item-1", { headers });
  await request(app, "/api/v1/profiles/profile-1/flashcard-study-sessions", {
    method: "POST", headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ theme_type: "category", theme_value: "animal", lang: "en", viewed_flashcard_ids: ["card-1"], responses: [], started_at: "2026-09-20T09:00:00.000Z" }),
  });
  assert.deepEqual(familyIds, [family.id, family.id, family.id, family.id, family.id, family.id]);
});

test("item quiz output preserves catalog question types and omits answer keys", async () => {
  const app = createApp({
    config: config(),
    db: authenticatedDatabase({
      quiz: {
        async getItemQuiz() { return { questions: [quizQuestion], difficulty: "Easy" as const }; },
        async getItemStatus() { return { attempt_count: 0, passed: false, best_score: 0, best_total: 0, latest_score: 0, latest_total: 0 }; },
        async submitItem() { return { score: 1, total: 1, passed: true, new_badges: [] }; },
        async getDailyQuiz() { return { questions: [quizQuestion], difficulty: "Easy" as const }; },
        async getDailyStatus() { return { attempted_today: false, passed: false, score: 0, total: 0 }; },
        async submitDaily() { return { score: 1, total: 1, passed: true, new_badges: [] }; },
      },
    }),
  });
  const response = await request(app, "/api/v1/items/item-1/quiz?lang=vi", { headers: { cookie: "plg_session=opaque" } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    questions: [{
      id: "question-1",
      item_id: "item-1",
      question_type: "single",
      question: "Which answer?",
      options: ["A", "B"],
      answer_count: 1,
      sort_order: 0,
    }],
    difficulty: "Easy",
  });
});

test("quiz profile routes enforce family ownership before repository access", async () => {
  const app = createApp({
    config: config(),
    db: authenticatedDatabase({
      profiles: {
        async list() { return []; },
        async count() { return 0; },
        async get() { return null; },
        async create() { return profile; },
        async update() { return null; },
        async completeTour() { return null; },
        async setAvatar() { return null; },
        async delete() { return false; },
      },
    }),
  });
  const response = await request(app, "/api/v1/profiles/foreign/quiz/items/item-1/status", {
    headers: { cookie: "plg_session=opaque" },
  });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: { code: "PROFILE_NOT_FOUND", message: "Profile not found." } });
});

test("quiz status and daily snapshot routes preserve server response shapes", async () => {
  let dailyLoads = 0;
  const app = createApp({
    config: config(),
    db: authenticatedDatabase({
      quiz: {
        async getItemQuiz() { return { questions: [quizQuestion], difficulty: "Easy" as const }; },
        async getItemStatus() { return { attempt_count: 2, passed: true, best_score: 1, best_total: 1, latest_score: 0, latest_total: 1 }; },
        async submitItem() { return { score: 1, total: 1, passed: true, new_badges: [] }; },
        async getDailyQuiz() { dailyLoads += 1; return { questions: [quizQuestion], difficulty: "Easy" as const }; },
        async getDailyStatus() { return { attempted_today: true, passed: false, score: 1, total: 2 }; },
        async submitDaily(_profileId, _day, answers) {
          if (!answers.some((answer) => answer.question_id === quizQuestion.id)) {
            throw new AppError(422, "INVALID_QUIZ_ANSWERS", "Quiz answers must match today's snapshot.");
          }
          return { score: 1, total: 1, passed: true, new_badges: [] };
        },
      },
    }),
  });
  const status = await request(app, "/api/v1/profiles/profile-1/quiz/items/item-1/status", { headers: { cookie: "plg_session=opaque" } });
  assert.deepEqual(await status.json(), { attempt_count: 2, passed: true, best_score: 1, best_total: 1, latest_score: 0, latest_total: 1 });
  const dailyStatus = await request(app, "/api/v1/profiles/profile-1/quiz/daily/status", { headers: { cookie: "plg_session=opaque" } });
  assert.deepEqual(await dailyStatus.json(), { attempted_today: true, passed: false, score: 1, total: 2 });
  const firstDaily = await request(app, "/api/v1/profiles/profile-1/quiz/daily?lang=vi", { headers: { cookie: "plg_session=opaque" } });
  const secondDaily = await request(app, "/api/v1/profiles/profile-1/quiz/daily?lang=en", { headers: { cookie: "plg_session=opaque" } });
  assert.deepEqual(await firstDaily.json(), await secondDaily.json());
  assert.equal(dailyLoads, 2);
  const outsideSnapshot = await request(app, "/api/v1/profiles/profile-1/quiz/daily/submit", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "plg_session=opaque" },
    body: JSON.stringify({ answers: [{ question_id: "foreign", chosen_answers: [0] }] }),
  });
  assert.equal(outsideSnapshot.status, 422);
});

test("flashcard options and decks preserve the existing answer shape", async () => {
  const option = {
    theme_type: "item" as const,
    theme_value: "item-1",
    title: "Study This Item",
    description: "Quick cards for this place, food, song, or story.",
    available_cards: 1,
    item_count: 1,
  };
  const app = createApp({
    config: config(),
    db: authenticatedDatabase({
      flashcards: {
        async getOptions(itemId, lang) {
          assert.equal(itemId, "item-1");
          assert.equal(lang, "vi");
          return [option];
        },
        async getDeck(profileId, itemId, lang, themeType, themeValue) {
          assert.deepEqual([profileId, itemId, lang, themeType, themeValue], ["profile-1", "item-1", "vi", "item", "item-1"]);
          return { ...option, cards: [flashcard] };
        },
        async createStudySession() { throw new Error("not used"); },
      },
    }),
  });
  const headers = { cookie: "plg_session=opaque" };
  const options = await request(app, "/api/v1/items/item-1/flashcards/options?lang=vi", { headers });
  assert.equal(options.status, 200);
  assert.deepEqual(await options.json(), [option]);

  const deck = await request(app, "/api/v1/profiles/profile-1/items/item-1/flashcards/deck?lang=vi&theme_type=item&theme_value=item-1", { headers });
  assert.equal(deck.status, 200);
  assert.deepEqual(await deck.json(), { ...option, cards: [flashcard] });
});

test("flashcard profile routes verify family ownership before repository work", async () => {
  let repositoryCalled = false;
  const base = authenticatedDatabase();
  const app = createApp({
    config: config(),
    db: authenticatedDatabase({
      profiles: { ...base.profiles, async get() { return null; } },
      flashcards: {
        async getOptions() { return []; },
        async getDeck() { repositoryCalled = true; return null; },
        async createStudySession() { repositoryCalled = true; throw new Error("must not run"); },
      },
    }),
  });
  const response = await request(app, "/api/v1/profiles/foreign/items/item-1/flashcards/deck?theme_type=item&theme_value=item-1", {
    headers: { cookie: "plg_session=opaque" },
  });
  assert.equal(response.status, 404);
  assert.equal(repositoryCalled, false);
});

test("flashcard session input rejects forged counts and completion fields", async () => {
  let repositoryCalled = false;
  const app = createApp({
    config: config(),
    db: authenticatedDatabase({
      flashcards: {
        async getOptions() { return []; },
        async getDeck() { return null; },
        async createStudySession() { repositoryCalled = true; throw new Error("must not run"); },
      },
    }),
  });
  const response = await request(app, "/api/v1/profiles/profile-1/flashcard-study-sessions", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "plg_session=opaque" },
    body: JSON.stringify({
      focus_item_id: "item-1",
      theme_type: "item",
      theme_value: "item-1",
      lang: "en",
      viewed_flashcard_ids: ["card-1"],
      responses: [{ flashcard_id: "card-1", rating: "got_it" }],
      started_at: "2026-09-20T09:00:00.000Z",
      cards_shown: 999,
      got_it_count: 999,
      completed_at: "2026-09-20T09:01:00.000Z",
    }),
  });
  assert.equal(response.status, 422);
  assert.equal(repositoryCalled, false);
});

test("flashcard session response exposes only server-derived counts and times", async () => {
  const app = createApp({ config: config(), db: authenticatedDatabase() });
  const response = await request(app, "/api/v1/profiles/profile-1/flashcard-study-sessions", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "plg_session=opaque" },
    body: JSON.stringify({
      focus_item_id: "item-1",
      theme_type: "item",
      theme_value: "item-1",
      lang: "en",
      viewed_flashcard_ids: ["card-1", "card-2"],
      responses: [{ flashcard_id: "card-1", rating: "got_it" }],
      started_at: "2026-09-20T09:00:00.000Z",
    }),
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    id: "study-1",
    profile_id: "profile-1",
    focus_item_id: "item-1",
    theme_type: "item",
    theme_value: "item-1",
    lang: "en",
    cards_shown: 2,
    got_it_count: 1,
    review_again_count: 0,
    responses: [{ flashcard_id: "card-1", rating: "got_it" }],
    started_at: "2026-09-20T09:00:00.000Z",
    completed_at: "2026-09-20T10:00:00.000Z",
  });
});

test("flashcard sessions accept omitted or null focus_item_id and normalize both to undefined", async () => {
  const receivedFocusValues: Array<string | undefined> = [];
  const app = createApp({
    config: config(),
    db: authenticatedDatabase({
      flashcards: {
        async getOptions() { return []; },
        async getDeck() { return null; },
        async createStudySession(profileId, input) {
          receivedFocusValues.push(input.focus_item_id);
          return {
            id: `study-${receivedFocusValues.length}`,
            profile_id: profileId,
            theme_type: input.theme_type,
            theme_value: input.theme_value,
            lang: input.lang,
            cards_shown: 1,
            got_it_count: 0,
            review_again_count: 0,
            responses: [],
            started_at: new Date(input.started_at),
            completed_at: new Date("2026-09-20T10:00:00.000Z"),
          };
        },
      },
    }),
  });
  const baseBody = {
    theme_type: "category",
    theme_value: "animal",
    lang: "en",
    viewed_flashcard_ids: ["card-1"],
    responses: [],
    started_at: "2026-09-20T09:00:00.000Z",
  };
  for (const body of [baseBody, { ...baseBody, focus_item_id: null }]) {
    const response = await request(app, "/api/v1/profiles/profile-1/flashcard-study-sessions", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "plg_session=opaque" },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 201);
    assert.equal(Object.hasOwn(await response.json() as object, "focus_item_id"), false);
  }
  assert.deepEqual(receivedFocusValues, [undefined, undefined]);
});

test("media rejects a known oversized object before streaming", async () => {
  let cancelled = false;
  const media: MediaStorage = {
    async get() {
      return {
        body: new ReadableStream<Uint8Array>({
          cancel() { cancelled = true; },
        }),
        contentLength: 9,
      };
    },
  };
  const app = createApp({
    config: config({ maxMediaBytes: 4 }),
    db: authenticatedMediaDatabase(),
    media,
  });
  const response = await request(app, "/media/private.txt", {
    headers: { cookie: "plg_session=opaque" },
  });
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
  assert.deepEqual(await response.json(), {
    error: { code: "MEDIA_TOO_LARGE", message: "Media object exceeds the allowed size." },
  });
});

test("media HEAD releases the storage stream while preserving metadata", async () => {
  let cancelled = false;
  const app = createApp({
    config: config(),
    db: authenticatedMediaDatabase(),
    media: {
      async get() {
        return {
          body: new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } }),
          contentLength: 9,
          contentType: "text/plain",
        };
      },
    },
  });
  const response = await request(app, "/media/private.txt", {
    method: "HEAD",
    headers: { cookie: "plg_session=opaque" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-length"), "9");
  assert.equal(response.headers.get("content-type"), "text/plain");
  assert.equal(await response.text(), "");
  assert.equal(cancelled, true);
});

test("storage cancellation errors preserve HEAD and oversized-object responses", async () => {
  for (const scenario of [
    { method: "HEAD", maxMediaBytes: 10, expectedStatus: 200 },
    { method: "GET", maxMediaBytes: 4, expectedStatus: 413 },
  ]) {
    let cancelled = false;
    const app = createApp({
      config: config({ maxMediaBytes: scenario.maxMediaBytes }),
      db: authenticatedMediaDatabase(),
      media: {
        async get() {
          return {
            body: new ReadableStream<Uint8Array>({
              cancel() {
                cancelled = true;
                throw new Error("Storage disconnect failed");
              },
            }),
            contentLength: 9,
          };
        },
      },
    });
    const response = await request(app, "/media/private.txt", {
      method: scenario.method,
      headers: { cookie: "plg_session=opaque" },
    });
    assert.equal(response.status, scenario.expectedStatus);
    assert.equal(cancelled, true);
  }
});

test("media streams an object without buffering it into a byte array", async () => {
  let pulls = 0;
  const media: MediaStorage = {
    async get() {
      return {
        body: new ReadableStream<Uint8Array>({
          pull(controller) {
            pulls += 1;
            if (pulls === 1) controller.enqueue(new TextEncoder().encode("streamed"));
            else controller.close();
          },
        }),
      };
    },
  };
  const app = createApp({ config: config(), db: authenticatedMediaDatabase(), media });
  const response = await request(app, "/media/private.txt", {
    headers: { cookie: "plg_session=opaque" },
  });
  assert.equal(response.status, 200);
  assert.ok(response.body);
  assert.equal(await response.text(), "streamed");
  assert.ok(pulls >= 1);
});

test("media terminates an unknown-length stream when it crosses the byte cap", async () => {
  const media: MediaStorage = {
    async get() {
      return {
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]));
            controller.enqueue(new Uint8Array([4, 5, 6]));
            controller.close();
          },
        }),
      };
    },
  };
  const app = createApp({
    config: config({ maxMediaBytes: 4 }),
    db: authenticatedMediaDatabase(),
    media,
  });
  const response = await request(app, "/media/private.bin", {
    headers: { cookie: "plg_session=opaque" },
  });
  assert.equal(response.status, 200);
  await assert.rejects(() => response.arrayBuffer(), /Media object exceeds the allowed size/);
});

test("unreferenced media is hidden before storage access", async () => {
  let reads = 0;
  const base = authenticatedDatabase();
  const app = createApp({
    config: config(),
    db: authenticatedDatabase({ items: {
      ...base.items,
      async canReadMedia(familyId, key) {
        assert.deepEqual([familyId, key], [family.id, "private/unreferenced.png"]);
        return false;
      },
    } }),
    media: { async get() { reads += 1; return null; } },
  });
  const response = await request(app, "/media/private/unreferenced.png", {
    headers: { cookie: "plg_session=opaque" },
  });
  assert.equal(response.status, 404);
  assert.equal(reads, 0);
});

test('UFO routes require owned profiles and admin access; reject forged progress', async () => {
 const {emptyProgress,publicState}=await import('../src/ufo/game.js');
 let writes=0;const ufo:import('../src/ufo/repository.js').UfoRepository={
  async list(){return [];},async save(w){writes++;return {...w,id:'word-1'};},async remove(){writes++;},async loadMaster(){writes++;return 190;},async get(){return publicState(emptyProgress());},async mutate(){writes++;return publicState(emptyProgress());},
 };
 const app=createApp({config:config(),db:authenticatedDatabase({ufo})});const headers={cookie:'plg_session=opaque','content-type':'application/json'};
 assert.equal((await request(app,'/api/v1/profiles/profile-1/ufo')).status,401);
 assert.equal((await request(app,'/api/v1/profiles/other/ufo',{headers})).status,404);
 assert.equal((await request(app,'/api/v1/profiles/profile-1/ufo',{headers})).status,200);
 for(const path of ['/api/v1/admin/ufo/words','/api/v1/admin/ufo/words/master','/api/v1/admin/ufo/words/word-1'])assert.equal((await request(app,path,{headers,method:'POST',body:'{}'})).status,403);
 assert.equal((await request(app,'/api/v1/profiles/profile-1/ufo/action',{headers,method:'POST',body:JSON.stringify({revision:0,action:{type:'guess',letter:'A'},charges:3,solved:100})})).status,422);
 assert.equal((await request(app,'/api/v1/profiles/profile-1/ufo/action',{headers,method:'POST',body:JSON.stringify({revision:0,action:{type:'guess',letter:'CAT'}})})).status,422);
 assert.equal(writes,0);
 assert.equal((await request(app,'/api/v1/profiles/profile-1/ufo/action',{headers,method:'POST',body:JSON.stringify({revision:0,action:{type:'hint'}})})).status,200);
 assert.equal(writes,1);
 const base=authenticatedDatabase({ufo});const adminApp=createApp({config:config(),db:{...base,auth:{...base.auth,async findFamilyBySessionHash(){return adminFamily;}}}});
 assert.equal((await request(adminApp,'/api/v1/admin/ufo/words/master',{headers,method:'POST'})).status,200);
 const word={word:'cat',difficulty:'easy',clue:'A furry pet.',definition:'An animal that purrs.'};
 assert.equal((await request(adminApp,'/api/v1/admin/ufo/words',{headers,method:'POST',body:JSON.stringify(word)})).status,201);
 assert.equal((await request(adminApp,'/api/v1/admin/ufo/words',{headers,method:'POST',body:JSON.stringify({...word,word:'TWO WORDS'})})).status,422);
});

test('achievement catalog and migration require admin; migration uses reviewed definitions only', async () => {
  const { ACHIEVEMENT_GROUPS, INFINIDRILL_ACHIEVEMENT_GROUP } = await import('../src/achievement-catalog.js');
  let stored: Array<import('../src/achievement-catalog.js').AchievementDefinition & { groupId: string }> = [];
  let writes = 0;
  const achievements: NonNullable<AppDatabase['achievements']> = {
    async list() { return stored; },
    async sync(group) {
      writes++;
      stored = [...stored.filter(row => row.groupId !== group.id), ...group.achievements.map(a => ({ ...a, groupId: group.id }))];
    },
  };
  const headers = { cookie: 'plg_session=opaque', 'content-type': 'application/json' };
  const path = '/api/v1/admin/achievements';
  const migrateAll = `${path}/migrate`;
  const migrate = `${path}/infinidrill-earth/migrate`;
  const ordinary = createApp({ config: config(), db: authenticatedDatabase({ achievements }) });
  assert.equal((await request(ordinary, path)).status, 401);
  assert.equal((await request(ordinary, path, { headers })).status, 403);
  assert.equal((await request(ordinary, migrateAll, { method: 'POST', headers })).status, 403);
  assert.equal((await request(ordinary, migrate, { method: 'POST', headers })).status, 403);
  assert.equal((await request(ordinary, `${path}/fishing/migrate`, { method: 'POST', headers })).status, 403);
  assert.equal(writes, 0);
  const admin = createApp({ config: config(), db: authenticatedDatabase({ achievements, auth: {
    ...database().auth, async findFamilyBySessionHash() { return adminFamily; },
  } }) });
  const before = await request(admin, path, { headers });
  assert.equal(before.status, 200);
  assert.match(before.headers.get('cache-control')!, /no-store/);
  const listed = await before.json();
  assert.deepEqual(listed.map((group: { id: string }) => group.id), ACHIEVEMENT_GROUPS.map(group => group.id));
  assert.equal(listed[0].needsMigration, true);
  assert.equal(listed[1].achievements.length, 15);
  assert.equal(listed[2].achievements.length, 7);
  assert.ok(listed.slice(3, 6).every((group: { earning: string }) => group.earning === 'catalog-only'));
  assert.equal((await request(admin, migrateAll, { headers })).status, 405);
  assert.equal((await request(admin, migrate, { headers })).status, 405);
  assert.equal((await request(admin, `${path}/unknown/migrate`, { method: 'POST', headers })).status, 404);
  const totalDefinitions = ACHIEVEMENT_GROUPS.reduce((count, group) => count + group.achievements.length, 0);
  const migrated = await request(admin, migrateAll, { method: 'POST', headers, body: JSON.stringify({ groupId: 'forged', achievements: [{ id: 'forged' }] }) });
  assert.equal(migrated.status, 200);
  const catalog = await migrated.json();
  assert.equal(catalog.migratedGroups, ACHIEVEMENT_GROUPS.length);
  assert.equal(catalog.installed, totalDefinitions);
  assert.deepEqual(catalog.groups.map((group: { id: string }) => group.id), ACHIEVEMENT_GROUPS.map(group => group.id));
  assert.ok(catalog.groups.every((group: { needsMigration: boolean }) => !group.needsMigration));
  assert.equal(writes, ACHIEVEMENT_GROUPS.length);
  assert.equal(stored.length, totalDefinitions);
  const repeated = await (await request(admin, migrateAll, { method: 'POST', headers })).json();
  assert.equal(repeated.migratedGroups, 0);
  assert.equal(repeated.installed, 0);
  assert.equal(writes, ACHIEVEMENT_GROUPS.length);
  const oneGroup = await (await request(admin, migrate, { method: 'POST', headers })).json();
  assert.equal(oneGroup.installed, 10);
  assert.deepEqual(oneGroup.achievements, INFINIDRILL_ACHIEVEMENT_GROUP.achievements);
  assert.equal(stored.length, totalDefinitions);
  const fishingGroup = ACHIEVEMENT_GROUPS.find(group => group.id === 'fishing')!;
  const fishingResponse = await request(admin, `${path}/fishing/migrate`, { method: 'POST', headers,
    body: JSON.stringify({ achievements: [{ id: 'forged', target: 0 }] }) });
  assert.equal(fishingResponse.status, 200);
  assert.deepEqual((await fishingResponse.json()).achievements, fishingGroup.achievements);
  assert.equal(stored.filter(row => row.groupId === 'fishing').length, 7);
});

test('Infinidrill validates ownership and rejects client awards, progress, clocks and unsupported commands', async () => {
  const { applyCommand, emptyProgress, publicState } = await import('../src/infinidrill/progress.js');
  let progress = emptyProgress(), writes = 0;
  const infinidrill: NonNullable<AppDatabase['infinidrill']> = {
    async get() { return publicState(progress); },
    async mutate(_id, revision, command) {
      assert.equal(revision, progress.revision); writes++;
      progress = applyCommand(progress, command, 1000, { random: () => 0 });
      return publicState(progress);
    },
  };
  const app = createApp({ config: config(), db: authenticatedDatabase({ infinidrill }) });
  const path = '/api/v1/profiles/profile-1/infinidrill';
  const headers = { cookie: 'plg_session=opaque', 'content-type': 'application/json' };
  assert.equal((await request(app, path)).status, 401);
  assert.equal((await request(app, path.replace('profile-1', 'other'), { headers })).status, 404);
  assert.equal((await request(app, path.replace('profile-1', 'other') + '/action', { method: 'POST', headers, body: '{}' })).status, 404);
  for (const body of [
    { revision: 0, command: { type: 'replay', depthMetres: 2160 } },
    { revision: 0, command: { type: 'replay', earned: ['infinidrill-core-champion'] } },
    { revision: 0, command: { type: 'replay', at: 0 } },
    { revision: 0, command: { type: 'question-ready', questionId: 'fake' } },
    { revision: 0, command: { type: 'submit-answer', questionId: 'fake', answer: -1 } },
    { revision: 0, command: { type: 'submit-answer', questionId: 'fake', answer: 0.5 } },
  ]) assert.equal((await request(app, path + '/action', { method: 'POST', headers, body: JSON.stringify(body) })).status, 422);
  assert.equal(writes, 0);
  const started = await request(app, path + '/action', { method: 'POST', headers, body: JSON.stringify({ revision: 0, command: { type: 'replay' } }) });
  assert.equal(started.status, 200);
  assert.match(started.headers.get('cache-control')!, /no-store/);
  const startedState = await started.json();
  assert.equal('answer' in startedState.game.currentQuestion, false);
  assert.equal('key' in startedState.game.currentQuestion, false);
});

test('Miniku puzzle menus restrict editing to admins and hints to verified parents', async () => {
  let hints = true, writes = 0;
  const minikuCatalog: NonNullable<AppDatabase['minikuCatalog']> = {
    async list() { return [{ id: 'puzzle-1', size: 3, givens: [0,0,0,0,0,0,1,2,0], enabled:true, revision:0, ownerFamilyId:null }]; },
    async create(input, ownerFamilyId) { writes++; return {id:'new',...input,revision:0,ownerFamilyId:ownerFamilyId ?? null}; },
    async update(id, input) { writes++; return { id, size:3, ...input, revision:input.revision+1, ownerFamilyId:null }; },
    async hints() { return hints; },
    async setHints(_id, enabled) { hints=enabled; },
  };
  const headers = { cookie:'plg_session=opaque', 'content-type':'application/json' };
  const familyApp = createApp({ config:config(), db:authenticatedDatabase({ minikuCatalog }) });
  assert.equal((await request(familyApp,'/api/v1/parent/miniku/puzzles')).status,401);
  assert.equal((await request(familyApp,'/api/v1/admin/miniku/puzzles',{headers})).status,403);
  assert.equal((await request(familyApp,'/api/v1/admin/miniku/puzzles/puzzle-1',{method:'PATCH',headers,body:'{}'})).status,403);
  assert.equal(writes,0);
  assert.equal((await request(familyApp,'/api/v1/parent/miniku/puzzles',{headers})).status,200);
  assert.deepEqual(await (await request(familyApp,'/api/v1/parent/miniku/settings',{headers})).json(),{ hints:true });
  assert.equal((await request(familyApp,'/api/v1/parent/miniku/settings',{method:'PATCH',headers,body:JSON.stringify({hints:false})})).status,200);
  assert.equal(hints,false);
  assert.equal((await request(familyApp,'/api/v1/parent/miniku/settings',{method:'PATCH',headers,body:JSON.stringify({hints:false,familyId:'other'})})).status,422);
  const unverified = createApp({ config:config(), db:authenticatedDatabase({ minikuCatalog, auth: { ...authenticatedDatabase().auth, async parentAccess() { return null; } } }) });
  assert.equal((await request(unverified,'/api/v1/parent/miniku/settings',{method:'PATCH',headers,body:JSON.stringify({hints:true})})).status,403);
  const adminApp = createApp({ config:config(), db:authenticatedDatabase({ minikuCatalog, auth:{...authenticatedDatabase().auth,async findFamilyBySessionHash(){return adminFamily;}} }) });
  assert.equal((await request(adminApp,'/api/v1/admin/miniku/puzzles',{headers})).status,200);
  assert.equal((await request(adminApp,'/api/v1/admin/miniku/puzzles/puzzle-1',{method:'PATCH',headers,body:JSON.stringify({givens:[0,0,0,0,0,0,1,2,0],enabled:false,revision:0})})).status,200);
  assert.equal(writes,1);
  const custom={size:3,givens:[0,0,0,0,0,0,1,2,0],enabled:true};
  const created=await request(familyApp,'/api/v1/parent/miniku/puzzles',{method:'POST',headers,body:JSON.stringify(custom)});
  assert.equal(created.status,201);
  assert.equal((await created.json()).ownerFamilyId,family.id);
  assert.equal((await request(familyApp,'/api/v1/parent/miniku/puzzles',{method:'POST',headers,body:JSON.stringify({...custom,ownerFamilyId:'other'})})).status,422);
  assert.equal((await request(unverified,'/api/v1/parent/miniku/puzzles',{method:'POST',headers,body:JSON.stringify(custom)})).status,403);
});

test('town naming and animal choices require profile ownership and reject forged counts and names',async()=>{
 const { emptyTown,applyTownCommand }=await import('../src/town-building/game.js');let state=emptyTown();let writes=0;
 state.entities=[{id:'farm',blueprintId:'farmhouse',x:7,y:12,paidCost:{}}];
 const town:NonNullable<AppDatabase['town']>={async get(){return state;},async getName(){return state.townName!;},async mutate(_id,revision,command){assert.equal(revision,state.revision);writes++;state=applyTownCommand(state,'town',command,'unused',100);return state;}};
 const app=createApp({config:config(),db:authenticatedDatabase({town})});const headers={cookie:'plg_session=opaque','content-type':'application/json'};
 const path='/api/v1/profiles/profile-1/town';
 assert.equal((await request(app,path+'/name')).status,401);
 assert.equal((await request(app,path.replace('profile-1','other')+'/name',{headers})).status,404);
 assert.deepEqual(await(await request(app,path+'/name',{headers})).json(),{townName:{adjective:'Sunny',noun:'Meadow'}});
 for(const command of [{type:'rename',adjective:'Invented',noun:'Meadow'},{type:'set-animal',entityId:'farm',animal:'dragon'},{type:'set-animal',entityId:'farm',animal:'sheep',count:200},{type:'rename',adjective:'Cozy',noun:'Nest',materials:{wood:100}}]){
  assert.equal((await request(app,path+'/action',{method:'POST',headers,body:JSON.stringify({revision:0,command})})).status,422);
 }
 assert.equal(writes,0);
 assert.equal((await request(app,path+'/action',{method:'POST',headers,body:JSON.stringify({revision:0,command:{type:'rename',adjective:'Cozy',noun:'Nest'}})})).status,200);
 assert.deepEqual(await(await request(app,path+'/name',{headers})).json(),{townName:{adjective:'Cozy',noun:'Nest'}});
});

test('visitor country is a bounded presentation hint, not an authorization input',async()=>{
 const app=createApp({config:config(),db:authenticatedDatabase()});
 const response=await request(app,'/api/v1/auth/session',{headers:{cookie:'plg_session=opaque','x-vercel-ip-country':'VN'}});
 assert.equal((await response.json()).visitorCountry,'VN');
 const invalid=await request(app,'/api/v1/auth/session',{headers:{cookie:'plg_session=opaque','x-vercel-ip-country':'Vietnam'}});
 assert.equal((await invalid.json()).visitorCountry,undefined);
 assert.equal((await request(app,'/api/v1/admin/session',{headers:{cookie:'plg_session=opaque','x-vercel-ip-country':'VN'}})).status,403);
});


test("public registration conflicts are generic and hash once, including reserved email and races", async (t) => {
  for (const mode of ["existing", "reserved", "race"]) {
    const hashes = t.mock.method(argon2, "hash", async () => "discarded-test-hash");
    let creations = 0;
    const base = database();
    const app = createApp({ config: config(), db: database({ auth: { ...base.auth,
      async findFamilyByEmail() { return mode === "existing" ? family : null; },
      async createFamily() { creations++; throw new AppError(409, "FAMILY_EXISTS", "An account with that email already exists."); },
    } }) });
    const response = await request(app, "/api/v1/auth/register", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Family", email: mode === "reserved" ? "root@system.local" : family.email, password: "a secure password", legalVersion: LEGAL_VERSION }) });
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.error.code, "REGISTRATION_FAILED");
    assert.equal(body.error.message, "We could not create this account. Try signing in, or use a different email.");
    assert.equal(hashes.mock.callCount(), 1);
    assert.equal(hashes.mock.calls[0]?.arguments[0], "a secure password");
    assert.equal(creations, mode === "race" ? 1 : 0);
    hashes.mock.restore();
  }
});

test("public legal version is read-only; missing or stale consent cannot create an account", async () => {
  let creations = 0;
  const base = database();
  const app = createApp({ config: config(), db: database({ auth: { ...base.auth,
    async createFamily(input) { creations++; return base.auth.createFamily(input); },
  } }) });
  const version = await request(app, "/api/v1/legal/version");
  assert.equal(version.status, 200);
  assert.deepEqual(await version.json(), { version: LEGAL_VERSION });
  assert.equal((await request(app, "/api/v1/legal/version", { method: "POST" })).status, 405);
  for (const legal of [{}, { legalVersion: "stale" }, { legalVersion: null }]) {
    const response = await request(app, "/api/v1/auth/register", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Family", email: family.email, password: "a secure password", ...legal }) });
    assert.equal(response.status, 400);
    assert.ok(["CONSENT_REQUIRED", "LEGAL_VERSION_MISMATCH"].includes((await response.json()).error.code));
  }
  assert.equal(creations, 0);
});
