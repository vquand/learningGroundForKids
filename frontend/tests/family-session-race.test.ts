import assert from "node:assert/strict";
import test from "node:test";

import { useFamilyStore } from "../src/stores/familyStore.ts";
import { useProfileStore } from '../src/stores/profileStore.ts';

function sessionResponse(id: string): Response {
  return new Response(JSON.stringify({
    authenticated: true,
    user: { id, email: `${id}@example.com`, name: id },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

test("clearing a session discards an older pending session response", async () => {
  const originalFetch = globalThis.fetch;
  let resolveFetch: ((response: Response) => void) | undefined;
  globalThis.fetch = async () => new Promise<Response>((resolve) => { resolveFetch = resolve; });

  try {
    useFamilyStore.getState().clearSession();
    const pending = useFamilyStore.getState().initSession();
    assert.equal(useFamilyStore.getState().isInitializing, true);

    useFamilyStore.getState().clearSession();
    resolveFetch?.(sessionResponse("family-a"));
    await pending;

    const state = useFamilyStore.getState();
    assert.equal(state.session, null);
    assert.equal(state.familyId, null);
    assert.equal(state.isInitializing, false);
  } finally {
    globalThis.fetch = originalFetch;
    useFamilyStore.getState().clearSession();
  }
});

test('session clearing and a different authenticated family clear the prior child synchronously', async () => {
  const originalFetch = globalThis.fetch;
  try {
    useFamilyStore.setState({ familyId: 'family-a' });
    useProfileStore.getState().setActiveProfile('kid-a');
    useFamilyStore.getState().clearSession();
    assert.equal(useProfileStore.getState().activeProfileId, null);
    useFamilyStore.setState({ familyId: 'family-a' });
    useProfileStore.getState().setActiveProfile('kid-a');
    globalThis.fetch = async () => sessionResponse('family-b');
    await useFamilyStore.getState().initSession();
    assert.equal(useProfileStore.getState().activeProfileId, null);
    useProfileStore.getState().setActiveProfile('kid-b');
    await useFamilyStore.getState().initSession();
    assert.equal(useProfileStore.getState().activeProfileId, 'kid-b', 'ordinary same-family refresh preserves the active child');
  } finally { globalThis.fetch = originalFetch; useFamilyStore.getState().clearSession(); }
});

test("a newer session refresh wins over an older response", async () => {
  const originalFetch = globalThis.fetch;
  const resolvers: Array<(response: Response) => void> = [];
  globalThis.fetch = async () => new Promise<Response>((resolve) => { resolvers.push(resolve); });

  try {
    useFamilyStore.getState().clearSession();
    const older = useFamilyStore.getState().initSession();
    const newer = useFamilyStore.getState().initSession();
    resolvers[1]?.(sessionResponse("family-b"));
    await newer;
    resolvers[0]?.(sessionResponse("family-a"));
    await older;

    assert.equal(useFamilyStore.getState().familyId, "family-b");
  } finally {
    globalThis.fetch = originalFetch;
    useFamilyStore.getState().clearSession();
  }
});
