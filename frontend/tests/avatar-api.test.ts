import assert from "node:assert/strict";
import test from "node:test";

import { createProfileWithAvatar, updateProfile, uploadProfileAvatar } from "../src/api/profiles.ts";

test("profile edits send the selected avatar and nullable frame through the same-origin API", async () => {
  const originalFetch = globalThis.fetch;
  let request: { path: string; init: RequestInit } | undefined;
  globalThis.fetch = (async (input, init) => {
    request = { path: String(input), init: init ?? {} };
    return Response.json({ id: "profile-1", avatar_type: "default", avatar_url: "capybara-calm" });
  }) as typeof fetch;
  try {
    await updateProfile("profile-1", {
      avatar_type: "default",
      avatar_url: "capybara-calm",
      avatar_frame: null,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(request?.path, "/api/v1/profiles/profile-1");
  assert.equal(request?.init.method, "PUT");
  assert.equal(request?.init.credentials, "same-origin");
  assert.deepEqual(JSON.parse(String(request?.init.body)), {
    avatar_type: "default",
    avatar_url: "capybara-calm",
    avatar_frame: null,
  });
});

test("avatar upload uses an owner-scoped same-origin route with cookie credentials and multipart content", async () => {
  const originalFetch = globalThis.fetch;
  const file = new File([new Uint8Array([0x89, 0x50])], "child.png", { type: "image/png" });
  let request: { path: string; init: RequestInit } | undefined;
  globalThis.fetch = (async (input, init) => {
    request = { path: String(input), init: init ?? {} };
    return Response.json({ id: "profile/one", avatar_type: "custom", avatar_url: "/media/profile-avatars/one.png" });
  }) as typeof fetch;
  try {
    const result = await uploadProfileAvatar("profile/one", file);
    assert.equal(result.avatar_type, "custom");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(request?.path, "/api/v1/profiles/profile%2Fone/avatar");
  assert.equal(request?.init.method, "POST");
  assert.equal(request?.init.credentials, "same-origin");
  assert.ok(request?.init.body instanceof FormData);
  assert.equal((request?.init.body as FormData).get("file"), file);
  assert.equal(new Headers(request?.init.headers).has("Content-Type"), false);
  assert.equal(new Headers(request?.init.headers).get("Accept"), "application/json");
});

test("avatar upload preserves the Render error message", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ error: { code: "INVALID_AVATAR", message: "Unsupported image." } }, { status: 400 })) as typeof fetch;
  try {
    await assert.rejects(() => uploadProfileAvatar("profile-1", new File(["x"], "x.txt")), /Unsupported image/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("profile creation retains the created profile when avatar upload fails", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input) => {
    calls.push(String(input));
    if (calls.length === 1) return Response.json({ id: "profile-1", name: "Kid", avatar_type: "default", avatar_url: "lion" }, { status: 201 });
    return Response.json({ error: { code: "MEDIA_UNAVAILABLE", message: "Upload is unavailable." } }, { status: 503 });
  }) as typeof fetch;
  try {
    const result = await createProfileWithAvatar({ name: "Kid", emoji: "⭐", color: "blue", avatar_type: "default", avatar_url: "lion" }, new File(["x"], "x.png"));
    assert.equal(result.profile.id, "profile-1");
    assert.equal(result.avatarUploadError, "Upload is unavailable.");
    assert.deepEqual(calls, ["/api/v1/profiles", "/api/v1/profiles/profile-1/avatar"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("profile creation sends the selected avatar frame", async () => {
  const originalFetch = globalThis.fetch;
  let request: { path: string; init: RequestInit } | undefined;
  globalThis.fetch = (async (input, init) => {
    request = { path: String(input), init: init ?? {} };
    return Response.json({ id: "profile-2", avatar_type: "default", avatar_url: "lion", avatar_frame: "space" }, { status: 201 });
  }) as typeof fetch;
  try {
    await createProfileWithAvatar({
      name: "Kid",
      emoji: "⭐",
      color: "#3B82F6",
      avatar_type: "default",
      avatar_url: "lion",
      avatar_frame: "space",
    }, null);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(request?.path, "/api/v1/profiles");
  assert.deepEqual(JSON.parse(String(request?.init.body)), {
    name: "Kid",
    emoji: "⭐",
    color: "#3B82F6",
    avatar_type: "default",
    avatar_url: "lion",
    avatar_frame: "space",
  });
});
