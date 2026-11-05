import assert from "node:assert/strict";
import test from "node:test";
import { createParentLesson, disableSystemLessons, fetchParentLesson, fetchParentLessonCatalog, fetchParentShareTargets, shareParentLesson, updateParentLesson } from "../src/api/parent.ts";

test("parent share targets use the authenticated Render route", async () => {
  const originalFetch = globalThis.fetch;
  let path = "";
  let credentials: RequestCredentials | undefined;
  globalThis.fetch = (async (input, init) => {
    path = String(input);
    credentials = init?.credentials;
    return Response.json([]);
  }) as typeof fetch;
  try {
    assert.deepEqual(await fetchParentShareTargets(), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(path, "/api/v1/parent/share-targets");
  assert.equal(credentials, "same-origin");
});

test("parent system-disable posts only item IDs and the desired state to Render", async () => {
  const originalFetch = globalThis.fetch;
  let path = "";
  let body: BodyInit | null | undefined;
  globalThis.fetch = (async (input, init) => {
    path = String(input);
    body = init?.body;
    return Response.json({ updated_count: 1 });
  }) as typeof fetch;
  try {
    await disableSystemLessons(["item-1"], true);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(path, "/api/v1/parent/lessons/system/disable");
  assert.equal(body, JSON.stringify({ item_ids: ["item-1"], disabled: true }));
});

test("parent lesson catalog uses the authenticated Render route", async () => {
  const originalFetch = globalThis.fetch;
  let path = "";
  globalThis.fetch = (async (input) => {
    path = String(input);
    return Response.json({ system_lessons: [], custom_lessons: [] });
  }) as typeof fetch;
  try {
    assert.deepEqual(await fetchParentLessonCatalog(), { system_lessons: [], custom_lessons: [] });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(path, "/api/v1/parent/lessons");
});

test("parent lesson creation sends a canonical item without client ownership", async () => {
  const originalFetch = globalThis.fetch;
  let path = "";
  let body: unknown;
  globalThis.fetch = (async (input, init) => {
    path = String(input);
    body = JSON.parse(String(init?.body));
    return Response.json({ id: "created-1" }, { status: 201 });
  }) as typeof fetch;
  try {
    assert.deepEqual(await createParentLesson({
      category: "food", latitude: 12, longitude: 34, is_published: false,
      title_en: "Soup", description_en: "Warm", title_vi: "Súp",
      target_scope: "profile", target_profile_id: "child-1",
    }), { id: "created-1" });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(path, "/api/v1/parent/lessons");
  assert.deepEqual(body, {
    item: {
      category: "food", latitude: 12, longitude: 34, is_published: false,
      translations: [
        { lang: "en", title: "Soup", description: "Warm" },
        { lang: "vi", title: "Súp" },
      ],
    },
    target_scope: "profile", target_profile_id: "child-1",
  });
});

test("parent lesson detail and update use owner-scoped Render routes and retain other languages", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { path: string; method: string; body?: unknown }[] = [];
  const detail = {
    id: "item-1", category: "food", latitude: 1, longitude: 2,
    translations: [
      { lang: "en", title: "Old" },
      { lang: "fr", title: "Bonjour" },
    ],
    media: [], quiz_questions: [],
  };
  globalThis.fetch = (async (input, init) => {
    const method = init?.method ?? "GET";
    requests.push({ path: String(input), method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return Response.json(method === "GET" ? detail : { id: "item-1" });
  }) as typeof fetch;
  try {
    assert.deepEqual(await fetchParentLesson("item-1"), detail);
    await updateParentLesson("item-1", {
      category: "food", latitude: 1, longitude: 2, is_published: true,
      title_en: "New",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(requests[0]?.path, "/api/v1/parent/lessons/item-1");
  assert.equal(requests[1]?.path, "/api/v1/parent/lessons/item-1");
  assert.equal(requests[2]?.method, "PUT");
  assert.deepEqual(requests[2]?.body, {
    item: {
      id: "item-1", category: "food", latitude: 1, longitude: 2, is_published: true,
      translations: [{ lang: "en", title: "New" }, { lang: "fr", title: "Bonjour" }],
    },
  });
});

test("parent lesson sharing sends only target identifiers", async () => {
  const originalFetch = globalThis.fetch;
  let path = "";
  let body: unknown;
  globalThis.fetch = (async (input, init) => {
    path = String(input);
    body = JSON.parse(String(init?.body));
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  try {
    await shareParentLesson("item-1", "family", "family-2");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(path, "/api/v1/parent/lessons/item-1/share");
  assert.deepEqual(body, { target_scope: "family", target_family_id: "family-2" });
});

test("parent lesson update clears optional values and translated text", async () => {
  const originalFetch = globalThis.fetch;
  let body: unknown;
  globalThis.fetch = (async (_input, init) => {
    if (init?.method === "PUT") {
      body = JSON.parse(String(init.body));
      return Response.json({ id: "item-1" });
    }
    return Response.json({
      id: "item-1", translations: [
        { lang: "en", title: "Old", description: "Old description" },
        { lang: "fr", title: "Bonjour" },
      ],
    });
  }) as typeof fetch;
  try {
    await updateParentLesson("item-1", {
      country_code: null, end_year: null, description_en: null,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(body, {
    item: {
      id: "item-1", country_code: null, end_year: null,
      translations: [
        { lang: "en", title: "Old", description: null },
        { lang: "fr", title: "Bonjour" },
      ],
    },
  });
});
