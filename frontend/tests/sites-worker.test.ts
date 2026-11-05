import assert from "node:assert/strict";
import test from "node:test";

import {
  getChatGPTUser,
  handleWorkerRequest,
  isProxyPath,
  proxyRequest,
  resolveUpstreamUrl,
} from "../worker/index.ts";

function authenticatedRequest(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("oai-authenticated-user-id", "chatgpt-user-123");
  headers.set("oai-authenticated-user-email", "mai@example.com");
  headers.set("oai-authenticated-user-full-name", "Mai%20Nguyen");
  headers.set("oai-authenticated-user-full-name-encoding", "percent-encoded-utf-8");
  return new Request(url, { ...init, headers });
}

test("only API and media paths are sent to the application backend", () => {
  assert.equal(isProxyPath("/api/v1/health/live"), true);
  assert.equal(isProxyPath("/api/admin/items"), true);
  assert.equal(isProxyPath("/media/avatar.png"), true);
  assert.equal(isProxyPath("/assets/api/example.js"), false);
  assert.equal(isProxyPath("/apiary"), false);
  assert.equal(isProxyPath("/"), false);
});

test("upstream URLs preserve the request path and query string", () => {
  const target = resolveUpstreamUrl(
    "https://learning.example/api/v1/items?page=2&lang=vi",
    "https://api.example",
  );

  assert.equal(target.href, "https://api.example/api/v1/items?page=2&lang=vi");
});

test("upstream configuration rejects insecure public and path-based origins", () => {
  assert.throws(
    () => resolveUpstreamUrl("https://learning.example/api/v1/items", "http://api.example"),
    /HTTPS/,
  );
  assert.throws(
    () => resolveUpstreamUrl("https://learning.example/api/v1/items", "https://api.example/base"),
    /origin only/,
  );
});

test("ChatGPT identity is decoded only when Sites supplies the expected encoding", () => {
  const authenticated = getChatGPTUser(authenticatedRequest("https://learning.example/"));
  assert.deepEqual(authenticated, {
    id: "chatgpt-user-123",
    email: "mai@example.com",
    name: "Mai Nguyen",
  });

  const malformed = new Request("https://learning.example/", {
    headers: {
      "oai-authenticated-user-id": "chatgpt-user-123",
      "oai-authenticated-user-email": "mai@example.com",
      "oai-authenticated-user-full-name": "%E0%A4%A",
      "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
    },
  });
  assert.deepEqual(getChatGPTUser(malformed), {
    id: "chatgpt-user-123",
    email: "mai@example.com",
    name: "mai@example.com",
  });
});

test("the session endpoint reports anonymous visitors without contacting Go", async () => {
  const response = await handleWorkerRequest(
    new Request("https://learning.example/api/v1/auth/session"),
    {},
    () => Promise.reject(new Error("fetch must not be called")),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    authenticated: false,
    signInUrl: "/signin-with-chatgpt?return_to=/",
  });
});

test("the session endpoint returns a sanitized ChatGPT user", async () => {
  const response = await handleWorkerRequest(
    authenticatedRequest("https://learning.example/api/v1/auth/session"),
    {},
    () => Promise.reject(new Error("fetch must not be called")),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    authenticated: true,
    user: {
      id: "chatgpt-user-123",
      email: "mai@example.com",
      name: "Mai Nguyen",
    },
    signOutUrl: "/signout-with-chatgpt?return_to=/",
  });
});

test("the native Worker health route does not require an upstream API", async () => {
  const response = await handleWorkerRequest(
    new Request("https://learning.example/api/v1/health/live"),
    {},
    () => Promise.reject(new Error("fetch must not be called")),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("native core routes require ChatGPT identity before touching D1", async () => {
  const response = await handleWorkerRequest(
    new Request("https://learning.example/api/v1/profiles"),
    {},
    () => Promise.reject(new Error("fetch must not be called")),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: {
      code: "AUTHENTICATION_REQUIRED",
      message: "Sign in with ChatGPT to continue.",
    },
  });
});

test("native readiness reports a missing D1 binding", async () => {
  const response = await handleWorkerRequest(
    new Request("https://learning.example/api/v1/health/ready"),
    {},
    () => Promise.reject(new Error("fetch must not be called")),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: {
      code: "DATABASE_NOT_CONFIGURED",
      message: "The learning database is not configured.",
    },
  });
});

test("native media routes require ChatGPT identity before touching R2", async () => {
  const response = await handleWorkerRequest(
    new Request("https://learning.example/media/profile-avatars/example.png"),
    {},
    () => Promise.reject(new Error("fetch must not be called")),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: {
      code: "AUTHENTICATION_REQUIRED",
      message: "Sign in with ChatGPT to continue.",
    },
  });
});

test("protected API requests reject anonymous visitors", async () => {
  const response = await proxyRequest(
    new Request("https://learning.example/api/v1/items"),
    { API_ORIGIN: "https://api.example" },
    () => Promise.reject(new Error("fetch must not be called")),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: {
      code: "AUTHENTICATION_REQUIRED",
      message: "Sign in with ChatGPT to continue.",
    },
  });
});

test("the Worker fails closed when API_ORIGIN is absent", async () => {
  const response = await proxyRequest(
    authenticatedRequest("https://learning.example/api/v1/items"),
    {},
    () => Promise.reject(new Error("fetch must not be called")),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: {
      code: "UPSTREAM_NOT_CONFIGURED",
      message: "The learning service is not configured.",
    },
  });
});

test("the Worker forwards request semantics to the configured Go service", async () => {
  let forwarded: Request | undefined;
  const request = authenticatedRequest("https://learning.example/api/v1/profiles?limit=20", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "session=example",
      "x-plg-user-id": "attacker-controlled",
    },
    body: JSON.stringify({ displayName: "Mai" }),
  });

  const response = await proxyRequest(
    request,
    { API_ORIGIN: "https://api.example" },
    async (nextRequest) => {
      forwarded = nextRequest;
      return Response.json({ ok: true }, { status: 201 });
    },
  );

  assert.equal(response.status, 201);
  assert.ok(forwarded);
  assert.equal(forwarded.url, "https://api.example/api/v1/profiles?limit=20");
  assert.equal(forwarded.method, "POST");
  assert.equal(forwarded.headers.get("cookie"), "session=example");
  assert.equal(forwarded.headers.get("x-forwarded-host"), "learning.example");
  assert.equal(forwarded.headers.get("x-plg-user-id"), "chatgpt-user-123");
  assert.equal(forwarded.headers.get("x-plg-user-email"), "mai@example.com");
  assert.equal(forwarded.headers.get("x-plg-user-name"), "Mai Nguyen");
  assert.equal(await forwarded.text(), JSON.stringify({ displayName: "Mai" }));
});

test("the Worker returns a structured error when the Go service cannot be reached", async () => {
  const response = await proxyRequest(
    authenticatedRequest("https://learning.example/api/v1/items"),
    { API_ORIGIN: "https://api.example" },
    () => Promise.reject(new Error("connection refused")),
  );

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: {
      code: "UPSTREAM_UNAVAILABLE",
      message: "The learning service is temporarily unavailable.",
    },
  });
});
