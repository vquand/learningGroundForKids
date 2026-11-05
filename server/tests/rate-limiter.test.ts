import assert from "node:assert/strict";
import { test } from "node:test";
import { AuthRateLimiter } from "../src/app.js";

test("auth limiter evicts the least-recently-seen key at its capacity", () => {
  const limiter = new AuthRateLimiter(1, 60_000, 2);
  assert.equal(limiter.check("client-a", 1).allowed, true);
  assert.equal(limiter.check("client-b", 2).allowed, true);
  assert.equal(limiter.check("client-c", 3).allowed, true);
  assert.equal(limiter.entryCount, 2);
  assert.equal(limiter.check("client-a", 4).allowed, true);
});

test("auth limiter prunes expired keys", () => {
  const limiter = new AuthRateLimiter(1, 100, 10);
  limiter.check("expired", 1);
  limiter.check("current", 102);
  assert.equal(limiter.entryCount, 1);
  assert.equal(limiter.check("expired", 103).allowed, true);
});
