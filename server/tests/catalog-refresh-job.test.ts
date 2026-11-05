import assert from "node:assert/strict";
import test from "node:test";

import { CatalogRefreshJobManager } from "../src/catalog-refresh-job.js";

test("catalog refresh jobs run in the background and expose batch progress", async () => {
  const manager = new CatalogRefreshJobManager();
  let release!: () => void;
  const work = new Promise<void>((resolve) => { release = resolve; });

  const queued = manager.start(async (options) => {
    options?.onProgress?.({
      total_batches: 2,
      completed_batches: 1,
      updated_count: 100,
      skipped_count: 0,
    });
    await work;
    return { updated_count: 100, skipped_count: 100, batches: 1 };
  });

  assert.match(queued.job_id, /^[0-9a-f-]{36}$/);
  assert.equal(queued.status, "running");
  assert.deepEqual(manager.current(), {
    ...queued,
    total_batches: 2,
    completed_batches: 1,
    updated_count: 100,
    skipped_count: 0,
    batches: 0,
  });
  assert.equal(manager.start(async () => ({ updated_count: 0, skipped_count: 0, batches: 0 })).job_id, queued.job_id);

  release();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(manager.current(), {
    ...queued,
    status: "completed",
    total_batches: 2,
    completed_batches: 2,
    updated_count: 100,
    skipped_count: 100,
    batches: 1,
  });
});

test("catalog refresh jobs report failures without rejecting the request", async () => {
  const errors: string[] = [];
  const manager = new CatalogRefreshJobManager({
    error(message) { errors.push(message); },
    info() {},
    warn() {},
  });

  manager.start(async () => { throw new Error("database schema is stale"); });
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(manager.current()?.status, "failed");
  assert.equal(manager.current()?.error, "Catalog refresh failed.");
  assert.deepEqual(errors, ["catalog refresh failed"]);
});
