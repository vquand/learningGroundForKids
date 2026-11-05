import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchSession,
  login,
  logout,
  parseSessionResponse,
} from "../src/api/auth.ts";
import { getParentRequestHeaders } from "../src/api/parent.ts";

test("portable auth session responses require a complete sanitized user", () => {
  assert.deepEqual(
    parseSessionResponse({
      authenticated: true,
      user: {
        id: "family-123",
        email: "mai@example.com",
        name: "Mai Nguyen",
      },
    }),
    {
      user: {
        id: "family-123",
        email: "mai@example.com",
        name: "Mai Nguyen",
      },
    },
  );

  assert.equal(
    parseSessionResponse({
      authenticated: true,
      user: { id: "family-123", email: "", name: "Mai" },
    }),
    null,
  );
});

test("the new-family tutorial hint accepts only the server's boolean opt-in", () => {
  const session = { authenticated: true, user: { id: 'family-a', email: 'a@test.local', name: 'Family A' } };
  assert.equal(parseSessionResponse({ ...session, onboarding: true })?.onboarding, true);
  assert.equal(parseSessionResponse({ ...session, onboarding: 'true' })?.onboarding, undefined);
  assert.equal(parseSessionResponse({ ...session, onboarding: false })?.onboarding, undefined);
});

test("anonymous session responses parse as signed out", () => {
  assert.equal(
    parseSessionResponse({
      authenticated: false,
    }),
    null,
  );
});

test("portable auth uses same-origin HttpOnly-cookie requests", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === "/api/v1/auth/login" || url === "/api/v1/auth/logout") {
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify({
      authenticated: true,
      user: { id: "family-123", email: "mai@example.com", name: "Mai Nguyen" },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await fetchSession();
    await login("mai@example.com", "correct horse battery staple");
    await logout();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(
    calls.map(({ url, init }) => ({
      url,
      method: init?.method ?? "GET",
      credentials: init?.credentials,
      cache: init?.cache,
      body: init?.body,
    })),
    [
      {
        url: "/api/v1/auth/session",
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        body: undefined,
      },
      {
        url: "/api/v1/auth/login",
        method: "POST",
        credentials: "same-origin",
        cache: undefined,
        body: JSON.stringify({ email: "mai@example.com", password: "correct horse battery staple" }),
      },
      {
        url: "/api/v1/auth/logout",
        method: "POST",
        credentials: "same-origin",
        cache: undefined,
        body: undefined,
      },
    ],
  );
});

test("family API requests rely on same-origin session cookies instead of bearer tokens", () => {
  assert.deepEqual(getParentRequestHeaders(), {
    "Content-Type": "application/json",
  });
});

test('session country hints accept only a two-letter country and do not change identity',()=>{
 const base={authenticated:true,user:{id:'family',email:'parent@example.com',name:'Parent'}};
 assert.equal(parseSessionResponse({...base,visitorCountry:'VN'})?.visitorCountry,'VN');
 assert.equal(parseSessionResponse({...base,visitorCountry:'Vietnam'})?.visitorCountry,undefined);
 assert.deepEqual(parseSessionResponse({...base,visitorCountry:'VN'})?.user,base.user);
});
