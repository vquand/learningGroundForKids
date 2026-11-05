import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { hashPassword, verifyPassword } from "../src/auth.js";
import { loadConfig } from "../src/config.js";
import type { AppDatabase, FamilyRecord } from "../src/contracts/db.js";
import { initializeRoot, ROOT_ACCOUNT_EMAIL, ROOT_ACCOUNT_ID } from "../src/root-account.js";

const normalPassword = "normal test password only";
const fallbackPassword = "fallback test password only";
const newPassword = "updated test password only";
const root = { id: "root", email: "root@system.local", displayName: "Root", role: "admin", isActive: true };

async function fixture(account: Partial<FamilyRecord> = {}, fallback: string | null = fallbackPassword) {
  let family: FamilyRecord = { ...root, passwordHash: await hashPassword(normalPassword), ...account };
  const sessions = new Map<string, string>();
  const db = { auth: {
    async findFamilyByEmail(email: string) { return family.email === email ? { ...family } : null; },
    async createSession(input: { tokenHash: string; familyId: string; expectedPasswordHash?: string }) {
      assert.equal(input.expectedPasswordHash, family.passwordHash);
      sessions.set(input.tokenHash, input.familyId);
    },
    async findFamilyBySessionHash(hash: string) { return sessions.has(hash) && family.isActive ? { ...family } : null; },
    async deleteSession(hash: string) { sessions.delete(hash); },
    async replaceRootPassword(expectedHash: string, passwordHash: string, sessionHash: string) {
      if (family.passwordHash !== expectedHash || !sessions.has(sessionHash)) return false;
      family = { ...family, passwordHash };
      sessions.clear();
      return true;
    },
  } } as unknown as AppDatabase;
  const config = loadConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@localhost/root_test",
    ALLOWED_ORIGINS: "https://app.example.com", ALLOWED_FORWARDED_HOSTS: "app.example.com",
    ...(fallback ? { ROOT_FALLBACK_PASSWORD: fallback } : {}), AUTH_RATE_LIMIT_MAX: "30" });
  const app = createApp({ config, db });
  const request = (path: string, init?: RequestInit) => app.request(`https://app.example.com${path}`, init);
  const login = (password = normalPassword, email = "root") => request("/api/v1/auth/login", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  const change = (cookie: string, input = { newPassword, confirmPassword: newPassword, fallbackPassword }, headers = {}) => request("/api/v1/admin/root/password", {
    method: "PATCH", headers: { "content-type": "application/json", cookie, ...headers }, body: JSON.stringify(input),
  });
  return { app, db, config, login, change, request, family: () => family };
}

test("root can sign in using either its normal password or the Render fallback", async () => {
  const f = await fixture();
  for (const password of [normalPassword, fallbackPassword]) {
    const response = await f.login(password);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.user.isRoot, true);
    assert.equal(JSON.stringify(payload).includes(password), false);
    assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
    const cookie = response.headers.get("set-cookie")!.split(";")[0]!;
    assert.equal((await f.request("/api/v1/admin/session", { headers: { cookie } })).status, 200);
  }
  assert.equal((await f.login("incorrect password")).status, 401);
  assert.equal((await f.login(normalPassword, ROOT_ACCOUNT_EMAIL)).status, 200);
});

test("fallback never authenticates a different admin, a family, or an inactive root", async () => {
  for (const account of [
    { id: "other-admin", email: "admin@example.test" },
    { id: "other-family", email: "family@example.test", role: "family" },
    { isActive: false },
    { id: "root", role: "family" },
  ]) {
    const f = await fixture(account);
    assert.equal((await f.login(fallbackPassword, f.family().email)).status, 401);
  }
});

test("root alias cannot authenticate an account squatting on the reserved email", async () => {
  const f = await fixture({ id: "other-admin" });
  assert.equal((await f.login(normalPassword)).status, 401);
});

test("fallback is disabled when unset and bounded by the login password limit", async () => {
  const f = await fixture({}, null);
  assert.equal((await f.login(fallbackPassword)).status, 401);
  const env = { DATABASE_URL: "postgresql://test:test@localhost/root_test" };
  assert.throws(() => loadConfig({ ...env, ROOT_FALLBACK_PASSWORD: "short" }));
  assert.throws(() => loadConfig({ ...env, ROOT_FALLBACK_PASSWORD: "x".repeat(257) }));
});

test("changing root password requires authentication, root identity, and the fallback", async () => {
  const f = await fixture();
  assert.equal((await f.change("")).status, 401);
  const cookie = (await f.login()).headers.get("set-cookie")!.split(";")[0]!;
  assert.equal((await f.change(cookie, { newPassword, confirmPassword: newPassword, fallbackPassword: normalPassword })).status, 403);
  assert.equal((await f.change(cookie, { newPassword, confirmPassword: "does not match", fallbackPassword })).status, 422);
  assert.equal((await f.change(cookie, { newPassword: "short", confirmPassword: "short", fallbackPassword })).status, 422);
  assert.equal((await f.change(cookie, { newPassword: fallbackPassword, confirmPassword: fallbackPassword, fallbackPassword })).status, 422);
  assert.equal((await f.change(cookie, undefined, { origin: "https://evil.example" })).status, 403);
  assert.equal(await verifyPassword(f.family().passwordHash, normalPassword), true);
  for (const role of ["family", "admin"]) {
    const other = await fixture({ id: "ordinary", email: "ordinary@example.test", role });
    const otherCookie = (await other.login(normalPassword, "ordinary@example.test")).headers.get("set-cookie")!.split(";")[0]!;
    assert.equal((await other.change(otherCookie)).status, 403);
  }
});

test("password update revokes every root session and leaves the fallback usable", async () => {
  const f = await fixture();
  const cookies = await Promise.all([f.login(), f.login(fallbackPassword)].map(async (r) => (await r).headers.get("set-cookie")!.split(";")[0]!));
  const response = await f.change(cookies[0]!);
  assert.equal(response.status, 204);
  assert.match(response.headers.get("set-cookie")!, /Max-Age=0/);
  for (const cookie of cookies) assert.deepEqual(await (await f.request("/api/v1/auth/session", { headers: { cookie } })).json(), { authenticated: false });
  assert.equal((await f.login(normalPassword)).status, 401);
  assert.equal((await f.login(newPassword)).status, 200);
  assert.equal((await f.login(fallbackPassword)).status, 200);
});

test("root password verification has an account-wide quota across clients", async () => {
  const f = await fixture();
  f.config.authRateLimitMax = 1;
  const app = createApp({ config: f.config, db: f.db, clientAddress: (c) => c.req.header("test-peer") });
  const cookie = (await f.login()).headers.get("set-cookie")!.split(";")[0]!;
  const attempt = (peer: string) => app.request("https://app.example.com/api/v1/admin/root/password", {
    method: "PATCH", headers: { cookie, "content-type": "application/json", "test-peer": peer },
    body: JSON.stringify({ newPassword, confirmPassword: newPassword, fallbackPassword: normalPassword }),
  });
  assert.equal((await attempt("192.0.2.1")).status, 403);
  const blocked = await attempt("192.0.2.2");
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get("retry-after"));
});

test("failed root logins cannot lock a valid root credential out across clients", async () => {
  const f = await fixture();
  f.config.authRateLimitMax = 1;
  const app = createApp({ config: f.config, db: f.db, clientAddress: (c) => c.req.header("test-peer") });
  const attempt = (peer: string, email: string, password: string) => app.request("https://app.example.com/api/v1/auth/login", {
    method: "POST", headers: { "content-type": "application/json", "test-peer": peer },
    body: JSON.stringify({ email, password }),
  });
  assert.equal((await attempt("192.0.2.1", "root", "wrong test password")).status, 401);
  assert.equal((await attempt("192.0.2.1", "root", fallbackPassword)).status, 429);
  assert.equal((await attempt("192.0.2.2", ROOT_ACCOUNT_EMAIL, fallbackPassword)).status, 200);
  assert.equal((await attempt("192.0.2.3", "root", normalPassword)).status, 200);
});

test("initialization creates root with a random hashed password and never rotates it on rerun", async () => {
  let family: FamilyRecord | null = null;
  let saved = "";
  const db = { auth: {
    async findFamilyByEmail() { return family; },
    async createRootIfMissing(passwordHash: string) {
      if (family) return false;
      family = { ...root, passwordHash };
      return true;
    },
  } } as unknown as AppDatabase;
  assert.equal(await initializeRoot(db, async (password) => { saved = password; }), true);
  assert.equal(saved.length, 43);
  assert.equal(family!.id, ROOT_ACCOUNT_ID);
  assert.equal(await verifyPassword(family!.passwordHash, saved), true);
  const originalHash = family!.passwordHash;
  assert.equal(await initializeRoot(db, async () => { throw new Error("must not write"); }), false);
  assert.equal(family!.passwordHash, originalHash);
});

test("initialization refuses to elevate a pre-existing family or admin email", async () => {
  const db = { auth: { async findFamilyByEmail() { return { ...root, id: "ordinary", passwordHash: "unchanged" }; } } } as unknown as AppDatabase;
  await assert.rejects(() => initializeRoot(db, async () => { throw new Error("must not write"); }), /reserved root account/);
});

test("initialization does not create root if saving the generated credential fails", async () => {
  let created = false;
  const db = { auth: { async findFamilyByEmail() { return null; }, async createRootIfMissing() { created = true; } } } as unknown as AppDatabase;
  await assert.rejects(() => initializeRoot(db, async () => { throw new Error("file exists"); }), /file exists/);
  assert.equal(created, false);
});
