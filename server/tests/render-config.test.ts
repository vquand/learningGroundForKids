import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("Render uses database readiness for its health check", async () => {
  const blueprint = await readFile(new URL("../../render.yaml", import.meta.url), "utf8");
  assert.match(blueprint, /^\s*healthCheckPath:\s*\/api\/v1\/health\/ready\s*$/m);
  assert.doesNotMatch(blueprint, /^\s*healthCheckPath:\s*\/api\/v1\/health\/live\s*$/m);
});

test("root recovery is a Render runtime secret, never a checked-in default", async () => {
  const blueprint = await readFile(new URL("../../render.yaml", import.meta.url), "utf8");
  assert.match(blueprint, /key: ROOT_FALLBACK_PASSWORD\n\s+sync: false/);
  assert.doesNotMatch(blueprint, /key: ROOT_FALLBACK_PASSWORD\n\s+value:/);
});

test("Render builds from the repository root so catalog refresh can access frontend fixtures", async () => {
  const blueprint = await readFile(new URL("../../render.yaml", import.meta.url), "utf8");
  assert.match(blueprint, /^\s*rootDir:\s+\.\s*$/m);
  assert.match(blueprint, /^\s*buildCommand:\s+npm ci --prefix server && npm run build --prefix server\s*$/m);
  assert.match(blueprint, /^\s*startCommand:\s+npm start --prefix server\s*$/m);
});
