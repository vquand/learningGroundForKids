import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("hosting metadata contains only Sites-managed identifiers and bindings", async () => {
  const source = await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8");
  const hosting = JSON.parse(source) as Record<string, unknown>;
  const allowedKeys = new Set(["project_id", "d1", "r2"]);

  assert.equal(
    Object.keys(hosting).every((key) => allowedKeys.has(key)),
    true,
  );
  assert.equal("API_ORIGIN" in hosting, false);
  assert.equal(hosting.d1, "DB");
  assert.equal(hosting.r2, "MEDIA");
});
