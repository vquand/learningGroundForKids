import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildCatalogSeed,
  catalogContentHash,
  catalogItemId,
  type CatalogItem,
  type ImageOverride,
} from "./db/catalog-seed.js";
import { runSeedTransaction } from "./db/seed-runner.js";
import type { CatalogRefreshJobOptions } from "./catalog-refresh-job.js";

export const CATALOG_REFRESH_BATCH_SIZE = 100;

interface QueryResult<Row> {
  rows: Row[];
}

interface CatalogRefreshClient {
  query(text: string, values?: readonly unknown[]): Promise<QueryResult<Record<string, unknown>>>;
  release(): void;
}

export interface CatalogRefreshPool {
  connect(): Promise<CatalogRefreshClient>;
}

export interface CatalogFixtures {
  items: CatalogItem[];
  imageOverrides: Record<string, ImageOverride>;
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let offset = 0; offset < values.length; offset += size) chunks.push(values.slice(offset, offset + size));
  return chunks;
}

async function readJson(path: string, fallback: unknown): Promise<any> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

export function defaultCatalogRepoRoot(): string {
  const configured = process.env.CATALOG_REPO_ROOT?.trim();
  if (configured) return resolve(configured);
  const current = resolve(process.cwd());
  return current.endsWith("/server") ? resolve(current, "..") : current;
}

export async function readCatalogFixtures(repoRoot = defaultCatalogRepoRoot()): Promise<CatalogFixtures> {
  const dataDir = resolve(repoRoot, "frontend", "data");
  const fixturePaths = [
    resolve(dataDir, "legacy-catalog.json"),
    resolve(dataDir, "generated-catalog.json"),
    resolve(dataDir, "expanded-catalog.json"),
  ];
  const rows: CatalogItem[] = [];
  for (const path of fixturePaths) rows.push(...await readJson(path, []));
  const unique = new Map<string, CatalogItem>();
  for (const item of rows) unique.set(catalogItemId(item), item);
  return {
    items: [...unique.values()].sort((left, right) => catalogItemId(left).localeCompare(catalogItemId(right))),
    imageOverrides: await readJson(resolve(dataDir, "image-overrides.json"), {}),
  };
}

export async function refreshCatalogFromRepo(
  pool: CatalogRefreshPool,
  repoRoot = defaultCatalogRepoRoot(),
  options?: CatalogRefreshJobOptions,
): Promise<{ updated_count: number; skipped_count: number; batches: number }> {
  if (options?.research !== false) await refreshCatalogFilesFromRepo(repoRoot);
  return refreshCatalogDatabase(pool, await readCatalogFixtures(repoRoot), CATALOG_REFRESH_BATCH_SIZE, options);
}

export async function refreshCatalogFilesFromRepo(repoRoot = defaultCatalogRepoRoot()): Promise<void> {
  const scriptPath = resolve(repoRoot, "frontend", "scripts", "refresh-item-content.mjs");
  const module = await import(pathToFileURL(scriptPath).href) as {
    refreshCatalogFiles?: (options: { write: boolean }) => Promise<unknown>;
  };
  if (typeof module.refreshCatalogFiles !== "function") {
    throw new Error(`Catalog content refresh script does not export refreshCatalogFiles: ${scriptPath}`);
  }
  await module.refreshCatalogFiles({ write: true });
}

export async function refreshCatalogDatabase(
  pool: CatalogRefreshPool,
  fixtures: CatalogFixtures,
  batchSize = CATALOG_REFRESH_BATCH_SIZE,
  options?: CatalogRefreshJobOptions,
): Promise<{ updated_count: number; skipped_count: number; batches: number }> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > CATALOG_REFRESH_BATCH_SIZE) {
    throw new Error(`Catalog refresh batch size must be between 1 and ${CATALOG_REFRESH_BATCH_SIZE}.`);
  }
  const client = await pool.connect();
  let updatedCount = 0;
  let skippedCount = 0;
  let batches = 0;
  let completedBatches = 0;
  const totalBatches = chunk(fixtures.items, batchSize).length;
  try {
    for (const items of chunk(fixtures.items, batchSize)) {
      const seed = buildCatalogSeed(items, fixtures.imageOverrides);
      const result = await client.query(
        "SELECT id, source_type, catalog_content_hash FROM items WHERE id = ANY($1::text[])",
        [seed.itemIds],
      );
      const existing = new Map(result.rows.map((row) => [String(row.id), row]));
      const changed = items.filter((item) => {
        const row = existing.get(catalogItemId(item));
        if (row?.source_type === "custom") return false;
        return row?.catalog_content_hash !== seedHashForItem(item);
      });
      skippedCount += items.length - changed.length;
      if (changed.length > 0) {
        await runSeedTransaction(client, buildCatalogSeed(changed, fixtures.imageOverrides).statements);
        updatedCount += changed.length;
        batches += 1;
      }
      completedBatches += 1;
      options?.onProgress?.({
        total_batches: totalBatches,
        completed_batches: completedBatches,
        updated_count: updatedCount,
        skipped_count: skippedCount,
      });
    }
  } finally {
    client.release();
  }
  return { updated_count: updatedCount, skipped_count: skippedCount, batches };
}

function seedHashForItem(item: CatalogItem): string {
  return catalogContentHash(item);
}
