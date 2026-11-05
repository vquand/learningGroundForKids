import assert from "node:assert/strict";
import test from "node:test";
import { adminCreateItem, adminDeleteItem, adminFetchItems, adminGetItem, adminGetRefreshStatus, adminRefreshItems, adminUpdateItem } from "../src/api/admin.ts";

test("admin item list and delete use protected Render routes without bearer identity", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const rows = [{ id: "item-1", category: "food", is_published: false, title_en: "Soup" }];
  globalThis.fetch = (async (input, init) => {
    calls.push({ path: String(input), init });
    return init?.method === "DELETE" ? new Response(null, { status: 204 }) : Response.json(rows);
  }) as typeof fetch;
  try {
    assert.deepEqual(await adminFetchItems(), rows);
    await adminDeleteItem("item-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(calls.map(({ path, init }) => ({ path, method: init?.method ?? "GET", credentials: init?.credentials })), [
    { path: "/api/v1/admin/items", method: "GET", credentials: "same-origin" },
    { path: "/api/v1/admin/items/item-1", method: "DELETE", credentials: "same-origin" },
  ]);
  assert.equal(calls.some(({ init }) => new Headers(init?.headers).has("Authorization")), false);
});

test("admin content refresh queues a protected background job", async () => {
  const originalFetch = globalThis.fetch;
  let path = "";
  let init: RequestInit | undefined;
  globalThis.fetch = (async (input, options) => {
    path = String(input);
    init = options;
    return Response.json({
      job_id: "job-1", status: "queued", total_batches: null,
      completed_batches: 0, updated_count: 0, skipped_count: 0, batches: 0,
    }, { status: 202 });
  }) as typeof fetch;
  try {
    assert.deepEqual(await adminRefreshItems(), {
      job_id: "job-1", status: "queued", total_batches: null,
      completed_batches: 0, updated_count: 0, skipped_count: 0, batches: 0,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(path, "/api/v1/admin/items/refresh");
  assert.equal(init?.method, "POST");
  assert.equal(init?.credentials, "same-origin");
  assert.equal(new Headers(init?.headers).has("Authorization"), false);
});

test("admin content refresh reads background job status", async () => {
  const originalFetch = globalThis.fetch;
  let path = "";
  globalThis.fetch = (async (input) => {
    path = String(input);
    return Response.json({
      job_id: "job-1", status: "completed", total_batches: 46,
      completed_batches: 46, updated_count: 4614, skipped_count: 0, batches: 46,
    });
  }) as typeof fetch;
  try {
    assert.equal((await adminGetRefreshStatus()).status, "completed");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(path, "/api/v1/admin/items/refresh/status");
});

test("admin item creation maps the flat form to the Render catalog contract", async () => {
  const originalFetch = globalThis.fetch;
  let path = "";
  let init: RequestInit | undefined;
  globalThis.fetch = (async (input, options) => {
    path = String(input);
    init = options;
    return Response.json({ id: "item-1", category: "food", is_published: false }, { status: 201 });
  }) as typeof fetch;
  try {
    await adminCreateItem({
      category: "food", latitude: 12, longitude: 34, title_en: "Soup", title_vi: "Súp",
      description_en: "Warm", is_published: false, quiz_required: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(path, "/api/v1/admin/items");
  assert.equal(init?.method, "POST");
  assert.equal(init?.credentials, "same-origin");
  assert.equal(new Headers(init?.headers).has("Authorization"), false);
  assert.deepEqual(JSON.parse(String(init?.body)), {
    category: "food", latitude: 12, longitude: 34, is_published: false,
    quiz_required: true,
    translations: [
      { lang: "en", title: "Soup", description: "Warm" },
      { lang: "vi", title: "Súp" },
    ],
  });
});

test("admin item detail reads the canonical Render response", async () => {
  const originalFetch = globalThis.fetch;
  let path = "";
  let init: RequestInit | undefined;
  const detail = {
    id: "item-1", category: "food", latitude: 12, longitude: 34,
    is_published: false, translations: [{ lang: "en", title: "Soup" }], media: [], quiz_questions: [],
  };
  globalThis.fetch = (async (input, options) => {
    path = String(input);
    init = options;
    return Response.json(detail);
  }) as typeof fetch;
  try {
    assert.deepEqual(await adminGetItem("item-1"), detail);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(path, "/api/v1/admin/items/item-1");
  assert.equal(init?.credentials, "same-origin");
  assert.equal(new Headers(init?.headers).has("Authorization"), false);
});

test("admin item update retains unedited translations and does not replace media or quiz", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; method: string; body?: unknown; init?: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => {
    const path = String(input);
    calls.push({ path, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined, init });
    if (!init?.method) {
      return Response.json({
        id: "item-1", category: "food", latitude: 12, longitude: 34, is_published: true,
        translations: [
          { id: "en-1", lang: "en", title: "Old", description: "Original" },
          { id: "fr-1", lang: "fr", title: "Bonjour" },
        ],
        media: [{ id: "media-1", media_type: "image", filename: "original.webp", sort_order: 0 }],
        quiz_questions: [{ id: "quiz-1", question: "Original quiz" }],
      });
    }
    return Response.json({ id: "item-1", category: "food", is_published: true });
  }) as typeof fetch;
  try {
    await adminUpdateItem("item-1", { title_en: "New", category: "food", is_published: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls[0]?.path, "/api/v1/admin/items/item-1");
  assert.equal(calls[1]?.method, "PUT");
  assert.equal(calls[1]?.init?.credentials, "same-origin");
  assert.deepEqual(calls[1]?.body, {
    item: {
      id: "item-1", category: "food", is_published: true,
      translations: [
        { lang: "en", title: "New", description: "Original" },
        { lang: "fr", title: "Bonjour" },
      ],
    },
  });
});

test("admin scalar-only update does not fetch or replace translated content", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; body: unknown }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ path: String(input), body: JSON.parse(String(init?.body)) });
    return Response.json({ id: "item-1", category: "food", is_published: true });
  }) as typeof fetch;
  try {
    await adminUpdateItem("item-1", { quiz_required: false });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(calls, [{ path: "/api/v1/admin/items/item-1", body: { item: { id: "item-1", quiz_required: false } } }]);
});

test("admin item update sends null for cleared optional fields and translations", async () => {
  const originalFetch = globalThis.fetch;
  let body: unknown;
  globalThis.fetch = (async (_input, init) => {
    if (init?.method === "PUT") {
      body = JSON.parse(String(init.body));
      return Response.json({ id: "item-1", category: "food", is_published: true });
    }
    return Response.json({
      id: "item-1", translations: [{ lang: "en", title: "Soup", description: "Old", history: "Old" }],
    });
  }) as typeof fetch;
  try {
    await adminUpdateItem("item-1", {
      country_code: null, start_year: null, icon_slug: null,
      description_en: null, history_en: null,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(body, {
    item: {
      id: "item-1", country_code: null, icon_slug: null, start_year: null,
      translations: [{ lang: "en", title: "Soup", description: null, history: null }],
    },
  });
});
