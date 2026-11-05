import assert from "node:assert/strict";
import test from "node:test";
import { geocodeHome } from "../src/geocode.js";

test("geocoding falls back after malformed, empty or out-of-range provider coordinates", async () => {
  for (const invalid of [null, {}, [], [{ lat: null, lon: "1" }], [{ lat: "", lon: "1" }], [{ lat: "91", lon: "1" }], [{ lat: "1", lon: "181" }]]) {
    const calls: string[] = [];
    const result = await geocodeHome("Ho Chi Minh", "VN", {
      fetch: async (url) => {
        calls.push(String(url));
        return Response.json(calls.length === 1 ? invalid : [{ lat: "10.77", lon: "106.69" }]);
      },
    });
    assert.deepEqual(result, { latitude: 10.77, longitude: 106.69 });
    assert.equal(calls.length, 2);
    assert.match(calls[1]!, /q=Ho%20Chi%20Minh%2C%20VN/);
  }
});

test("one geocoding deadline aborts a stalled fetch without launching the fallback", async () => {
  let signal: AbortSignal | null | undefined;
  let calls = 0;
  const result = await geocodeHome("City", "VN", {
    timeoutMs: 15,
    fetch: async (_url, init) => {
      calls += 1;
      signal = init?.signal;
      return new Promise<Response>(() => {});
    },
  });
  assert.equal(result, null);
  assert.equal(signal?.aborted, true);
  assert.equal(calls, 1);
});

test("geocoding deadline also covers a stalled response body", async () => {
  let signal: AbortSignal | null | undefined;
  const result = await geocodeHome("City", "VN", {
    timeoutMs: 15,
    fetch: async (_url, init) => {
      signal = init?.signal;
      return new Response(new ReadableStream<Uint8Array>());
    },
  });
  assert.equal(result, null);
  assert.equal(signal?.aborted, true);
});

test("failed geocoding releases HTTP error bodies and preserves the null fallback", async () => {
  let cancelled = 0;
  const result = await geocodeHome("City", "VN", {
    fetch: async () => new Response(new ReadableStream<Uint8Array>({ cancel() { cancelled += 1; } }), { status: 503 }),
  });
  assert.equal(result, null);
  assert.equal(cancelled, 2);
});
