import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import { hashSessionToken } from "../src/auth.js";
import { loadConfig } from "../src/config.js";
import type { AppDatabase, FamilyRecord, PasskeyChallengeRecord, PasskeyRecord } from "../src/contracts/db.js";

const family: FamilyRecord = {
  id: "family-1",
  email: "parent@example.com",
  displayName: "Parent",
  passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$rF7h2ZyFloX7gfcwGllA/A$Ii+R2irQphJFB4LNnCeVFF0fM1Iq4MyEiPJiazCE2qo",
  role: "family",
};

const passkey: PasskeyRecord = {
  id: "credential-1",
  familyId: family.id,
  publicKey: "AA==",
  counter: 1,
  transports: null,
  deviceType: "singleDevice",
  backedUp: false,
};

function makeFixture(options: {
  role?: FamilyRecord["role"];
  access?: { method: "password" | "passkey"; until: Date } | null;
  passkeyFamilyId?: string;
  empty?: boolean;
  disabled?: boolean;
} = {}) {
  const challenges: PasskeyChallengeRecord[] = [];
  const consumed: string[] = [];
  let access = options.access ?? null;
  let deleted = 0;
  let enrolled = !options.empty;
  let loginInput: Record<string, unknown> | null = null;
  let lockedSessionHash: string | null = null;
  let rotatedSession = false;
  let currentPasskey = { ...passkey, familyId: options.passkeyFamilyId ?? passkey.familyId };
  const currentFamily = { ...family, ...(options.role ? { role: options.role } : {}) };
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://test:test@localhost/test",
    ALLOWED_ORIGINS: "https://app.example.com",
    ALLOWED_FORWARDED_HOSTS: "app.example.com",
    WEB_AUTHN_RP_ID: "localhost",
    WEB_AUTHN_ORIGIN: "http://localhost:5173",
  });
  if (options.disabled) delete config.webauthn;
  const db = {
    auth: {
      async findFamilyBySessionHash(tokenHash: string) {
        return rotatedSession
          ? tokenHash !== hashSessionToken("opaque")
          : tokenHash === hashSessionToken("opaque") || tokenHash === hashSessionToken("other")
          ? currentFamily : null;
      },
      async parentAccess(_tokenHash: string, _familyId: string, now: Date) {
        return access && access.until > now ? access : null;
      },
      async grantParentAccess(_tokenHash: string, _familyId: string, until: Date, method: "password" | "passkey") {
        access = { until, method };
        return true;
      },
      async listPasskeys() { return enrolled ? [currentPasskey] : []; },
      async findPasskey() { return currentPasskey; },
      async createPasskeyChallenge(input: PasskeyChallengeRecord) { challenges.push(input); },
      async consumePasskeyChallenge(tokenHash: string, purpose: PasskeyChallengeRecord["purpose"], now: Date) {
        const index = challenges.findIndex((entry) => entry.tokenHash === tokenHash && entry.purpose === purpose
          && entry.expiresAt > now);
        if (index < 0) return null;
        const [entry] = challenges.splice(index, 1);
        consumed.push(purpose);
        return entry!;
      },
      async finalizePasskeyLogin(input: Record<string, unknown>) { loginInput = input; return true; },
      async finalizePasskeyParentAccess() { return true; },
      async lockParentAccess(input: { sessionHash: string; familyId: string; tokenHash: string }) {
        lockedSessionHash = input.sessionHash;
        access = null;
        challenges.length = 0;
        rotatedSession = true;
        return new Date(Date.now() + 3_600_000);
      },
      async addPasskey() {},
      async deletePasskey() { deleted++; enrolled = false; return { removed: true, preferred: false }; },
    },
    profiles: {
      async list() { return []; },
    },
  } as unknown as AppDatabase;
  const app = createApp({ config, db, logger: { info() {}, warn() {}, error() {} } });
  const request = (path: string, init?: RequestInit) => app.request(`https://app.example.com${path}`, init);
  return {
    app, request, config, db, challenges, consumed,
    setAccess(value: { method: "password" | "passkey"; until: Date } | null) { access = value; },
    setPasskeyFamilyId(value: string) { currentPasskey = { ...currentPasskey, familyId: value }; },
    get deleted() { return deleted; },
    get loginInput() { return loginInput; },
    get lockedSessionHash() { return lockedSessionHash; },
  };
}

function sessionHeaders(extra: Record<string, string> = {}) {
  return { cookie: "plg_session=opaque", ...extra };
}

function challengeCookie(response: Response): string {
  const header = response.headers.get("set-cookie");
  assert.ok(header);
  assert.match(header, /plg_passkey_challenge=/);
  return header.split(";", 1)[0]!;
}

const assertionBody = JSON.stringify({ id: passkey.id, type: "public-key", response: {} });

test("passkey options bind a one-use challenge to the session and clear its cookie", async () => {
  const fixture = makeFixture();
  const options = await fixture.request("/api/v1/parent/access/passkey/options", {
    method: "POST", headers: sessionHeaders(),
  });
  assert.equal(options.status, 200);
  assert.equal((await options.json()).rpId, "localhost");
  const cookie = challengeCookie(options);
  assert.equal(fixture.challenges.length, 1);
  assert.equal(fixture.challenges[0]!.sessionHash, hashSessionToken("opaque"));

  const first = await fixture.request("/api/v1/parent/access/passkey/verify", {
    method: "POST", headers: { ...sessionHeaders({ "content-type": "application/json" }), cookie: `plg_session=opaque; ${cookie}` },
    body: assertionBody,
  });
  assert.equal(first.status, 401);
  assert.match(first.headers.get("set-cookie") ?? "", /plg_passkey_challenge=; Max-Age=0/);
  assert.deepEqual(fixture.consumed, ["parent"]);

  const replay = await fixture.request("/api/v1/parent/access/passkey/verify", {
    method: "POST", headers: { ...sessionHeaders({ "content-type": "application/json" }), cookie: `plg_session=opaque; ${cookie}` },
    body: assertionBody,
  });
  assert.equal(replay.status, 401);
  assert.deepEqual(fixture.consumed, ["parent"]);
});

test("passkey verification rejects expired, wrong-session, and wrong-family challenges", async () => {
  const fixture = makeFixture();
  const expiredOptions = await fixture.request("/api/v1/parent/access/passkey/options", {
    method: "POST", headers: sessionHeaders(),
  });
  const expiredCookie = challengeCookie(expiredOptions);
  fixture.challenges[0]!.expiresAt = new Date(Date.now() - 1);
  const expired = await fixture.request("/api/v1/parent/access/passkey/verify", {
    method: "POST", headers: { ...sessionHeaders({ "content-type": "application/json" }), cookie: `plg_session=opaque; ${expiredCookie}` },
    body: assertionBody,
  });
  assert.equal(expired.status, 401);
  assert.deepEqual(fixture.consumed, []);

  const sessionOptions = await fixture.request("/api/v1/parent/access/passkey/options", {
    method: "POST", headers: sessionHeaders(),
  });
  const sessionCookie = challengeCookie(sessionOptions);
  const wrongSession = await fixture.request("/api/v1/parent/access/passkey/verify", {
    method: "POST", headers: { cookie: `plg_session=other; ${sessionCookie}`, "content-type": "application/json" },
    body: assertionBody,
  });
  assert.equal(wrongSession.status, 401);
  assert.deepEqual(fixture.consumed, ["parent"]);

  const familyOptions = await fixture.request("/api/v1/parent/access/passkey/options", {
    method: "POST", headers: sessionHeaders(),
  });
  const familyCookie = challengeCookie(familyOptions);
  fixture.setPasskeyFamilyId("another-family");
  const wrongFamily = await fixture.request("/api/v1/parent/access/passkey/verify", {
    method: "POST", headers: { ...sessionHeaders({ "content-type": "application/json" }), cookie: `plg_session=opaque; ${familyCookie}` },
    body: assertionBody,
  });
  assert.equal(wrongFamily.status, 401);
  assert.deepEqual(fixture.consumed, ["parent", "parent"]);
});

test("passkey removal requires recent password elevation and admins can elevate into their own parent space", async () => {
  const passkeyOnly = makeFixture({ access: { method: "passkey", until: new Date(Date.now() + 60_000) } });
  const blocked = await passkeyOnly.request("/api/v1/parent/passkeys/credential-1", {
    method: "DELETE", headers: sessionHeaders(),
  });
  assert.equal(blocked.status, 403);
  assert.equal((await blocked.json() as { error: { code: string } }).error.code, "PASSWORD_RECHECK_REQUIRED");

  passkeyOnly.setAccess({ method: "password", until: new Date(Date.now() + 86_400_000) });
  const removed = await passkeyOnly.request("/api/v1/parent/passkeys/credential-1", {
    method: "DELETE", headers: sessionHeaders(),
  });
  assert.equal(removed.status, 204);
  assert.equal(passkeyOnly.deleted, 1);

  const admin = makeFixture({ role: "admin" });
  const access = await admin.request("/api/v1/parent/access", { headers: sessionHeaders() });
  assert.equal(access.status, 200);
  assert.deepEqual(await access.json(), {
    elevated: false,
    method: null,
    expires_at: null,
    passkeys_enabled: true,
    passkeys_enrolled: true,
    password_confirmed: false,
  });

  const protectedBeforeElevation = await admin.request("/api/v1/parent/passkeys", { headers: sessionHeaders() });
  assert.equal(protectedBeforeElevation.status, 403);
  assert.equal((await protectedBeforeElevation.json() as { error: { code: string } }).error.code, "PARENT_ACCESS_REQUIRED");

  const elevated = await admin.request("/api/v1/parent/access/password", {
    method: "POST",
    headers: sessionHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ password: "password" }),
  });
  assert.equal(elevated.status, 200);
  assert.equal((await elevated.json() as { elevated: boolean }).elevated, true);

  const ownParentSpace = await admin.request("/api/v1/parent/passkeys", { headers: sessionHeaders() });
  assert.equal(ownParentSpace.status, 200);
});

test("parent password failures use a per-family budget before the shared IP quota", async () => {
  const fixture = makeFixture();
  // The limiter is created lazily on the first request, so this keeps the
  // production default config shape while making the family budget explicit.
  fixture.config.authRateLimitMax = 1;

  const first = await fixture.request("/api/v1/parent/access/password", {
    method: "POST",
    headers: sessionHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ password: "wrong-password" }),
  });
  assert.equal(first.status, 401);
  assert.equal((await first.json() as { error: { code: string } }).error.code, "INVALID_CREDENTIALS");

  const second = await fixture.request("/api/v1/parent/access/password", {
    method: "POST",
    headers: sessionHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ password: "wrong-password" }),
  });
  assert.equal(second.status, 429);
  assert.equal((await second.json() as { error: { code: string } }).error.code, "RATE_LIMITED");
  assert.match(second.headers.get("retry-after") ?? "", /^\d+$/);
});

test("parent password elevation lasts exactly one day and status reads do not extend it", async () => {
  const fixture = makeFixture();
  const before = Date.now();
  const elevated = await fixture.request("/api/v1/parent/access/password", {
    method: "POST",
    headers: sessionHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ password: "password" }),
  });
  assert.equal(elevated.status, 200);
  const first = await elevated.json() as { expires_at: string };
  const firstExpiry = Date.parse(first.expires_at);
  assert.ok(firstExpiry >= before + 86_400_000 - 1_000);
  assert.ok(firstExpiry <= Date.now() + 86_400_000 + 1_000);

  const status = await fixture.request("/api/v1/parent/access", { headers: sessionHeaders() });
  assert.equal(status.status, 200);
  assert.equal(Date.parse((await status.json() as { expires_at: string }).expires_at), firstExpiry);
});

test("expired parent access denies parent endpoints while preserving kid profile access", async () => {
  const fixture = makeFixture({ access: { method: "password", until: new Date(Date.now() - 1) } });
  const parent = await fixture.request("/api/v1/parent/passkeys", { headers: sessionHeaders() });
  assert.equal(parent.status, 403);
  const profiles = await fixture.request("/api/v1/profiles", { headers: sessionHeaders() });
  assert.equal(profiles.status, 200);
});

test("locking parent space rotates the authenticated session and invalidates parent ceremonies", async () => {
  const fixture = makeFixture({ access: { method: "password", until: new Date(Date.now() + 86_400_000) } });
  fixture.challenges.push({
    tokenHash: hashSessionToken("parent-challenge"), challenge: "challenge", purpose: "parent",
    sessionHash: hashSessionToken("opaque"), familyId: family.id,
    expiresAt: new Date(Date.now() + 60_000),
  });

  const locked = await fixture.request("/api/v1/parent/access/lock", {
    method: "POST", headers: sessionHeaders(),
  });
  assert.equal(locked.status, 204);
  assert.equal(fixture.lockedSessionHash, hashSessionToken("opaque"));
  assert.equal(fixture.challenges.length, 0);

  const rotatedCookie = locked.headers.get("set-cookie")?.split(";", 1)[0];
  assert.match(rotatedCookie ?? "", /^plg_session=.+/);
  const status = await fixture.request("/api/v1/parent/access", { headers: { cookie: rotatedCookie! } });
  assert.deepEqual(await status.json(), {
    elevated: false, method: null, expires_at: null,
    passkeys_enabled: true, passkeys_enrolled: true, password_confirmed: false,
  });
  const denied = await fixture.request("/api/v1/parent/passkeys", { headers: { cookie: rotatedCookie! } });
  assert.equal(denied.status, 403);
  const oldSession = await fixture.request("/api/v1/parent/access", { headers: sessionHeaders() });
  assert.equal(oldSession.status, 401);
});

for (const path of ['/api/v1/parent/access', '/api/v1/parent/passkeys']) {
  test(`${path} reconciles the server-written preference with enrolled credentials`, async () => {
    for (const empty of [true, false]) {
      const fixture = makeFixture({ empty, access: { method: 'password', until: new Date(Date.now() + 86_400_000) } });
      const response = await fixture.request(path, { headers: sessionHeaders({
        cookie: `plg_session=opaque; plg_passkey_preferred=${empty ? 'true' : 'false'}`,
      }) });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('set-cookie') ?? '', new RegExp(`plg_passkey_preferred=${empty ? 'false' : 'true'};`));
    }
  });
}

test('deleting the last passkey clears the server login hint even before a list refresh', async () => {
  const fixture = makeFixture({ access: { method: 'password', until: new Date(Date.now() + 86_400_000) } });
  const response = await fixture.request('/api/v1/parent/passkeys/credential-1', { method: 'DELETE', headers: sessionHeaders() });
  assert.equal(response.status, 204);
  assert.match(response.headers.get('set-cookie') ?? '', /plg_passkey_preferred=false;/);
  const status = await fixture.request('/api/v1/parent/access', { headers: sessionHeaders() });
  assert.equal((await status.json()).passkeys_enrolled, false);
});

test('status reconciles the preference when WebAuthn is disabled', async () => {
  const fixture = makeFixture({ disabled: true });
  const response = await fixture.request('/api/v1/parent/access', { headers: sessionHeaders() });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie') ?? '', /plg_passkey_preferred=false;/);
});
