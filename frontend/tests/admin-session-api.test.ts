import assert from "node:assert/strict";
import test from "node:test";
import { fetchAdminAccess } from "../src/api/adminSession.ts";
import { useAdminStore } from "../src/stores/adminStore.ts";
import { useFamilyStore } from "../src/stores/familyStore.ts";

test("admin access is checked by the same-origin cookie session", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ path: String(input), init });
    return Response.json({ is_admin: true });
  }) as typeof fetch;
  try {
    assert.equal(await fetchAdminAccess(), "admin");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls[0]?.path, "/api/v1/admin/session");
  assert.equal(calls[0]?.init?.credentials, "same-origin");
  assert.equal(calls[0]?.init?.cache, "no-store");
  assert.equal(new Headers(calls[0]?.init?.headers).has("Authorization"), false);
});

test("admin access fails closed for non-admin and malformed responses", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(null, { status: 403 })) as typeof fetch;
    assert.equal(await fetchAdminAccess(), "forbidden");
    globalThis.fetch = (async () => new Response(null, { status: 401 })) as typeof fetch;
    assert.equal(await fetchAdminAccess(), "signed-out");
    globalThis.fetch = (async () => Response.json({ is_admin: false })) as typeof fetch;
    assert.equal(await fetchAdminAccess(), "forbidden");
    globalThis.fetch = (async () => Response.json({ unexpected: true })) as typeof fetch;
    assert.equal(await fetchAdminAccess(), "forbidden");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a late admin access check cannot restore access after logout", async () => {
  const originalFetch = globalThis.fetch;
  let resolveResponse: ((response: Response) => void) | undefined;
  globalThis.fetch = (async () => new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  })) as typeof fetch;
  try {
    const check = useAdminStore.getState().refresh();
    useAdminStore.getState().logout();
    resolveResponse?.(Response.json({ is_admin: true }));
    await check;
    assert.equal(useAdminStore.getState().access, "signed-out");
  } finally {
    globalThis.fetch = originalFetch;
    useAdminStore.getState().logout();
  }
});

test("an admin access check belongs only to the family session that started it", async () => {
  const originalFetch = globalThis.fetch;
  const originalGeneration = useFamilyStore.getState().sessionGeneration;
  let resolveResponse: ((response: Response) => void) | undefined;
  globalThis.fetch = (async () => new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  })) as typeof fetch;
  try {
    const check = useAdminStore.getState().refresh();
    useFamilyStore.setState({ sessionGeneration: originalGeneration + 1 });
    resolveResponse?.(Response.json({ is_admin: true }));
    await check;
    assert.notEqual(useAdminStore.getState().access, "admin");
    assert.notEqual(useAdminStore.getState().verifiedSessionGeneration, originalGeneration + 1);
  } finally {
    globalThis.fetch = originalFetch;
    useFamilyStore.setState({ sessionGeneration: originalGeneration });
    useAdminStore.getState().logout();
  }
});
