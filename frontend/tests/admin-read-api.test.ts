import assert from "node:assert/strict";
import test from "node:test";
import { adminCreateFamily, adminFetchFamilies, adminFetchFamilyReports, adminFetchTestDetail, adminFetchTests, adminFetchProfile, adminFetchProfileActivities, adminFetchProfileJourney, adminSetFamilyPassword } from "../src/api/admin.ts";

test('admin family learning reads are scoped, abortable and reject invalid report envelopes', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = (async (path, init) => {
    assert.equal(path, '/api/v1/admin/families/family%2Fone/reports');
    assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.signal, controller.signal);
    assert.equal(init?.method, undefined); assert.equal(init?.body, undefined);
    assert.equal(new Headers(init?.headers).has('Authorization'), false);
    return Response.json({ children: [], totals: { children: 0, exploring_completed: 0, quiz_attempts: 0,
      quiz_passes: 0, earned_badges: 0, study_sessions: 0, drink_completions: 0 }, generated_at: '2026-10-14T12:00:00Z' });
  }) as typeof fetch;
  try {
    assert.deepEqual((await adminFetchFamilyReports('family/one', controller.signal)).children, []);
    for (const invalid of [[], null, {}, { children: [], totals: {}, generated_at: '2026-10-14T12:00:00Z' }, { children: [{}], totals: {}, generated_at: 'now' }]) {
      globalThis.fetch = async () => Response.json(invalid);
      await assert.rejects(adminFetchFamilyReports('family/one'), /invalid/);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("admin password change sends only the secret and reason to the scoped same-origin route", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = (async (path, init) => {
    assert.equal(path, "/api/v1/admin/families/family%2Fone/password");
    assert.equal(init?.method, "PUT");
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.signal, controller.signal);
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    assert.deepEqual(JSON.parse(String(init?.body)), { new_password: " secret password ", reason: "Support request" });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  try { await adminSetFamilyPassword("family/one", " secret password ", " Support request ", controller.signal); }
  finally { globalThis.fetch = originalFetch; }
});

test("root provisioning uses a same-origin POST without client identity or password trimming", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = (async (path, init) => {
    assert.equal(path, "/api/v1/admin/families");
    assert.equal(init?.method, "POST");
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.signal, controller.signal);
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    assert.deepEqual(JSON.parse(String(init?.body)), { name: "Family", email: "family@example.test", password: " initial password " });
    return Response.json({ id: "family-new", display_name: "Family", email: "family@example.test" }, { status: 201 });
  }) as typeof fetch;
  try { assert.equal((await adminCreateFamily({ name: " Family ", email: " family@example.test ", password: " initial password " }, controller.signal)).id, "family-new"); }
  finally { globalThis.fetch = originalFetch; }
});

test("administrator family and assessment reads use same-origin Render routes", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ path: String(input), init });
    return Response.json(String(input).includes("/tests/") ? { id: "assessment-1", questions: [], performance: [] } : []);
  }) as typeof fetch;
  try {
    assert.deepEqual(await adminFetchFamilies(), []);
    assert.deepEqual(await adminFetchTests(), []);
    assert.deepEqual(await adminFetchTestDetail("item 1"), { id: "assessment-1", questions: [], performance: [] });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(calls.map(({ path, init }) => ({ path, credentials: init?.credentials })), [
    { path: "/api/v1/admin/families", credentials: "same-origin" },
    { path: "/api/v1/admin/tests", credentials: "same-origin" },
    { path: "/api/v1/admin/tests/item%201", credentials: "same-origin" },
  ]);
  assert.equal(calls.some(({ init }) => new Headers(init?.headers).has("Authorization")), false);
});

test("admin learner inspection uses scoped read-only routes and forwards abort signals", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => { calls.push({ path: String(input), init }); return Response.json({}); }) as typeof fetch;
  const controller = new AbortController();
  try {
    await adminFetchProfile("family one", "kid/one", controller.signal);
    await adminFetchProfileActivities("family one", "kid/one", { page: 2, page_size: 20, type: "quiz" }, controller.signal);
    await adminFetchProfileJourney("family one", "kid/one", { page: 1, page_size: 100, period: "all" }, controller.signal);
  } finally { globalThis.fetch = originalFetch; }
  assert.deepEqual(calls.map((call) => call.path), [
    "/api/v1/admin/families/family%20one/profiles/kid%2Fone",
    "/api/v1/admin/families/family%20one/profiles/kid%2Fone/activities?page=2&page_size=20&type=quiz",
    "/api/v1/admin/families/family%20one/profiles/kid%2Fone/journey?period=all&page=1&page_size=100",
  ]);
  assert.ok(calls.every(({ init }) => init?.credentials === "same-origin" && init.signal === controller.signal && !init.method));
});
