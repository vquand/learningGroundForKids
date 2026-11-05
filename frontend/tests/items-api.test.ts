import assert from "node:assert/strict";
import test from "node:test";

import { fetchItem, fetchItems } from "../src/api/items.ts";

test("map item loading requests the complete bounded UAT catalog", async () => {
  const originalFetch = globalThis.fetch;
  let requestedPath = "";
  globalThis.fetch = (async (input) => {
    requestedPath = typeof input === "string" ? input : input.toString();
    return Response.json([]);
  }) as typeof fetch;

  try {
    await fetchItems();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requestedPath, "/api/v1/items?limit=5000");
});

test("profile-scoped catalog and detail include only the selected profile identifier", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = (async (input) => {
    paths.push(String(input));
    return Response.json([]);
  }) as typeof fetch;
  try {
    await fetchItems("child-1");
    await fetchItem("item/1", "vi", "child-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(paths, [
    "/api/v1/items?limit=5000&profile_id=child-1",
    "/api/v1/items/item%2F1?lang=vi&profile_id=child-1",
  ]);
});
