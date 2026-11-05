import assert from "node:assert/strict";
import test from "node:test";
import * as auth from "../src/api/auth.ts";

const user = { id: "root-user", email: "root@system.local", name: "Root" };

test("session parsing preserves only literal true for the server root flag", () => {
  assert.deepEqual(auth.parseSessionResponse({ authenticated: true, user: { ...user, isRoot: true } }), {
    user: { ...user, isRoot: true },
  });
  for (const isRoot of [undefined, false, "true", 1, null, {}, []]) {
    const session = auth.parseSessionResponse({ authenticated: true, user: { ...user, isRoot } });
    assert.deepEqual(session, { user });
    assert.equal(Object.hasOwn(session!.user, "isRoot"), false);
  }
});

test("root password updates use the same-origin PATCH contract without trimming", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ path: String(input), init });
    return new Response(null, { status: 204 });
  };
  try {
    const passwords = { newPassword: " new password with spaces ", confirmPassword: " new password with spaces ", fallbackPassword: " exact fallback password with spaces " };
    assert.equal(typeof auth.updateRootPassword, "function");
    assert.equal(await auth.updateRootPassword(passwords), undefined);
    assert.equal(calls[0]?.path, "/api/v1/admin/root/password");
    assert.equal(calls[0]?.init?.method, "PATCH");
    assert.equal(calls[0]?.init?.credentials, "same-origin");
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), passwords);
    const headers = new Headers(calls[0]?.init?.headers);
    assert.equal(headers.get("Content-Type"), "application/json");
    assert.equal(headers.has("Authorization"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("root password updates preserve safe server errors and support cancellation", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.signal, controller.signal);
    return Response.json({ error: { message: "The fallback password is incorrect." } }, { status: 403 });
  };
  try {
    assert.equal(typeof auth.updateRootPassword, "function");
    await assert.rejects(auth.updateRootPassword({ newPassword: "new-password-123", confirmPassword: "new-password-123", fallbackPassword: "fallback-password-12345" }, controller.signal), /fallback password is incorrect/);
  } finally { globalThis.fetch = originalFetch; }
});
