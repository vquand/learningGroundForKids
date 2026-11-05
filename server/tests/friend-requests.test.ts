import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import type { FriendRequestRecord, FamilyRecord, AppDatabase } from "../src/contracts/db.js";
import { AppError } from "../src/errors.js";
import { friendRequestMessage, friendRequestResponse, normalizeTargetCode } from "../src/social.js";

const family: FamilyRecord = {
  id: "family-requester",
  email: "requester@example.test",
  displayName: "Requester",
  passwordHash: "",
  role: "family",
};

const request: FriendRequestRecord = {
  id: "request-1",
  requesting_family_id: "family-requester",
  requesting_scope: "profile",
  requesting_profile_id: "profile-requester",
  requesting_label: "Ari only",
  target_family_id: "family-target",
  target_scope: "family",
  target_profile_id: null,
  target_label: "Target family (all kids now and later)",
  target_code: "TARGET01",
  requester_message: "Ari only wants to be friends with Target family (all kids now and later). Target code: TARGET01 (Target).",
  status: "pending",
  created_at: new Date("2026-09-21T10:00:00.000Z"),
  responded_at: null,
  responded_by_family_id: null,
};

function config(): AppConfig {
  return {
    nodeEnv: "test",
    port: 10000,
    databaseUrl: "postgresql://test:test@localhost:5432/test",
    databaseUrlUnpooled: undefined,
    allowedOrigins: new Set(["https://app.example.com"]),
    allowedForwardedHosts: new Set(["app.example.com"]),
    sessionCookieName: "plg_session",
    sessionMaxAgeSeconds: 3600,
    allowRegistration: false,
    maxBodyBytes: 16_384,
    authRateLimitMax: 10,
    authRateLimitWindowSeconds: 60,
    authRateLimitMaxKeys: 100,
    authTrustedProxyCidrs: [],
    maxMediaBytes: 1_048_576,
    trustProxyHeaders: false,
    renderExternalHostname: undefined,
    s3: undefined,
  };
}

function database(overrides: Partial<AppDatabase> = {}): AppDatabase {
  let authenticated = true;
  const base = {
    async ping() {},
    auth: {
      async findFamilyByEmail() { return family; },
      async createFamily(input: never) { return input; },
      async createSession() {},
      async findFamilyBySessionHash() { return authenticated ? family : null; },
      async deleteSession() {},
    },
    profiles: {
      async list() { return []; },
      async count() { return 0; },
      async get() { return null; },
      async create() { throw new Error("not used"); },
      async update() { return null; },
      async delete() { return false; },
    },
    items: {
      async list() { return []; },
      async get() { return null; },
      async create() { throw new Error("not used"); },
      async getAdmin() { return null; },
      async listAdmin() { return []; },
      async updateBatch() { throw new Error("not used"); },
      async deleteAdmin() { return false; },
    },
    progress: {
      async list() { return { done_item_ids: [], wip_item_ids: [] }; },
      async get() { return { done: false }; },
      async mark() { return null; },
      async remove() { return false; },
    },
    quiz: {
      async getItemQuiz() { return null; },
      async getItemStatus() { return { attempt_count: 0, passed: false, best_score: 0, best_total: 0, latest_score: 0, latest_total: 0 }; },
      async submitItem() { throw new Error("not used"); },
      async getDailyQuiz() { return null; },
      async getDailyStatus() { return { attempted_today: false, passed: false, score: 0, total: 0 }; },
      async submitDaily() { throw new Error("not used"); },
    },
    flashcards: {
      async getOptions() { return []; },
      async getDeck() { return null; },
      async createStudySession() { throw new Error("not used"); },
    },
    friendRequests: {
      async list() { return [request]; },
      async create() { return request; },
      async respond() { return { ...request, status: "accepted" as const, responded_at: new Date("2026-09-21T11:00:00.000Z"), responded_by_family_id: family.id }; },
    },
  } as unknown as AppDatabase;
  return { ...base, ...overrides };
}

function requestTo(app: ReturnType<typeof createApp>, path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("cookie", "plg_session=test-session");
  return app.request(`https://app.example.com${path}`, { ...init, headers });
}

test("normalizes target codes and derives the historical message shape", () => {
  assert.equal(normalizeTargetCode("  target01 "), "TARGET01");
  assert.equal(
    friendRequestMessage("Ari only", "Target family (all kids now and later)", "TARGET01", "Target"),
    "Ari only wants to be friends with Target family (all kids now and later). Target code: TARGET01 (Target).",
  );
});

test("maps dates and preserves the exact public friend-request output shape", () => {
  assert.deepEqual(friendRequestResponse(request), {
    ...request,
    created_at: "2026-09-21T10:00:00.000Z",
    responded_at: null,
  });
});

test("lists only participant-visible requests through an authenticated session", async () => {
  const app = createApp({ config: config(), db: database({
    friendRequests: {
      async list(familyId) {
        assert.equal(familyId, family.id);
        return [request];
      },
      async create() { return request; },
      async respond() { return request; },
    },
  }) });

  const response = await requestTo(app, "/api/v1/friend-requests");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{
    ...request,
    created_at: "2026-09-21T10:00:00.000Z",
    responded_at: null,
  }]);
});

test("derives requester family from the session and rejects forged identity and extra fields", async () => {
  let receivedFamilyId = "";
  const app = createApp({ config: config(), db: database({
    friendRequests: {
      async list() { return []; },
      async create(familyId, input) {
        receivedFamilyId = familyId;
        assert.equal(input.requesting_profile_id, "profile-requester");
        assert.equal(input.target_code, "TARGET01");
        return request;
      },
      async respond() { return request; },
    },
  }) });

  const response = await requestTo(app, "/api/v1/friend-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      requesting_scope: "profile",
      requesting_profile_id: "profile-requester",
      requesting_family_id: "attacker-family",
      target_code: "  target01 ",
      target_scope: "family",
    }),
  });
  assert.equal(response.status, 422);
  assert.equal(receivedFamilyId, "");

  const valid = await requestTo(app, "/api/v1/friend-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      requesting_scope: "profile",
      requesting_profile_id: "profile-requester",
      target_code: "  target01 ",
      target_scope: "family",
    }),
  });
  assert.equal(valid.status, 201);
  assert.equal(receivedFamilyId, family.id);
});

test("responds only for a pending request targeted at the current family", async () => {
  let receivedFamilyId = "";
  let receivedRequestId = "";
  const app = createApp({ config: config(), db: database({
    friendRequests: {
      async list() { return []; },
      async create() { return request; },
      async respond(familyId, requestId, accept) {
        receivedFamilyId = familyId;
        receivedRequestId = requestId;
        assert.equal(accept, true);
        return { ...request, status: "accepted" as const, responded_at: new Date(), responded_by_family_id: familyId };
      },
    },
  }) });

  const response = await requestTo(app, "/api/v1/friend-requests/request-1/respond", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accept: true, status: "accepted" }),
  });
  assert.equal(response.status, 422);
  assert.equal(receivedFamilyId, "");

  const valid = await requestTo(app, "/api/v1/friend-requests/request-1/respond", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accept: true }),
  });
  assert.equal(valid.status, 200);
  assert.equal(receivedFamilyId, family.id);
  assert.equal(receivedRequestId, "request-1");
});

test("maps duplicate creation to a stable conflict envelope", async () => {
  const app = createApp({ config: config(), db: database({
    friendRequests: {
      async list() { return []; },
      async create() {
        throw new AppError(409, "FRIEND_REQUEST_EXISTS", "That friend request is already pending.");
      },
      async respond() { return request; },
    },
  }) });

  const response = await requestTo(app, "/api/v1/friend-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requesting_scope: "family", target_code: "TARGET01", target_scope: "profile" }),
  });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: { code: "FRIEND_REQUEST_EXISTS", message: "That friend request is already pending." },
  });
});

test("does not leak request response state for a non-target family or a lost race", async () => {
  const app = createApp({ config: config(), db: database({
    friendRequests: {
      async list() { return []; },
      async create() { return request; },
      async respond() {
        throw new AppError(403, "FRIEND_REQUEST_NOT_TARGET", "Only the target family can respond to this request.");
      },
    },
  }) });
  const unauthorized = await requestTo(app, "/api/v1/friend-requests/request-1/respond", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accept: false }),
  });
  assert.equal(unauthorized.status, 403);

  const racedApp = createApp({ config: config(), db: database({
    friendRequests: {
      async list() { return []; },
      async create() { return request; },
      async respond() {
        throw new AppError(409, "FRIEND_REQUEST_ALREADY_HANDLED", "Friend request is no longer pending.");
      },
    },
  }) });
  const raced = await requestTo(racedApp, "/api/v1/friend-requests/request-1/respond", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accept: true }),
  });
  assert.equal(raced.status, 409);
});
