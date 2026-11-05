import assert from "node:assert/strict";
import test from "node:test";

import { runSeedTransaction } from "../../src/db/seed-runner.js";

test("runSeedTransaction wraps every parameterized statement in one transaction", async () => {
  const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
  await runSeedTransaction({
    async query(text, values) {
      calls.push({ text, ...(values ? { values } : {}) });
    },
  }, [
    { text: "INSERT INTO items (id) VALUES ($1)", values: ["item-1"] },
    { text: "INSERT INTO item_media (id) VALUES ($1)", values: ["media-1"] },
  ]);

  assert.deepEqual(calls, [
    { text: "BEGIN" },
    { text: "INSERT INTO items (id) VALUES ($1)", values: ["item-1"] },
    { text: "INSERT INTO item_media (id) VALUES ($1)", values: ["media-1"] },
    { text: "COMMIT" },
  ]);
});

test("runSeedTransaction rolls back and rethrows when a statement fails", async () => {
  const calls: string[] = [];
  await assert.rejects(
    runSeedTransaction({
      async query(text) {
        calls.push(text);
        if (text.startsWith("INSERT")) throw new Error("seed failed");
      },
    }, [{ text: "INSERT INTO items (id) VALUES ($1)", values: ["item-1"] }]),
    /seed failed/,
  );
  assert.deepEqual(calls, ["BEGIN", "INSERT INTO items (id) VALUES ($1)", "ROLLBACK"]);
});
