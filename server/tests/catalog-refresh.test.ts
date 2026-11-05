import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  catalogContentHash,
  catalogItemId,
  type CatalogItem,
} from "../src/db/catalog-seed.js";
import { refreshCatalogDatabase, refreshCatalogFromRepo } from "../src/catalog-refresh.js";

function item(index: number): CatalogItem {
  return {
    category: "animal",
    latitude: index,
    longitude: index,
    country_code: "VN",
    icon_slug: "animal",
    is_published: true,
    translations: [{ lang: "en", title: `Animal ${index}`, description: `A real animal number ${index}.` }],
  };
}

test("catalog refresh compares hashes and writes changed records in batches of 100", async () => {
  const items = Array.from({ length: 201 }, (_, index) => item(index));
  const changed = items[137]!;
  const calls: string[] = [];
  const client = {
    async query(text: string, values?: readonly unknown[]) {
      calls.push(text);
      if (text.startsWith("SELECT")) {
        const ids = values?.[0] as string[];
        return {
          rows: ids.map((id) => ({
            id,
            source_type: "system",
            catalog_content_hash: id === catalogItemId(changed) ? "stale" : catalogContentHash(items.find((value) => catalogItemId(value) === id)! ),
          })),
        };
      }
      return { rows: [] };
    },
    release() {},
  };
  const result = await refreshCatalogDatabase({ async connect() { return client; } }, { items, imageOverrides: {} });

  assert.deepEqual(result, { updated_count: 1, skipped_count: 200, batches: 1 });
  assert.equal(calls.filter((call) => call === "BEGIN").length, 1);
  assert.equal(calls.filter((call) => call.startsWith("SELECT")).length, 3);
});

test("catalog refresh researches checked-in fixtures before migrating them", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "plg-catalog-refresh-"));
  const dataDir = join(repoRoot, "frontend", "data");
  const scriptsDir = join(repoRoot, "frontend", "scripts");
  await mkdir(dataDir, { recursive: true });
  await mkdir(scriptsDir, { recursive: true });
  const fixture = [item(1)];
  for (const filename of ["legacy-catalog.json", "generated-catalog.json", "expanded-catalog.json"]) {
    await writeFile(join(dataDir, filename), JSON.stringify(filename === "legacy-catalog.json" ? fixture : []));
  }
  await writeFile(join(dataDir, "image-overrides.json"), "{}");
  const markerPath = join(repoRoot, "research-ran.txt");
  await writeFile(join(scriptsDir, "refresh-item-content.mjs"), `
    import { writeFile } from "node:fs/promises";
    export async function refreshCatalogFiles(options) {
      if (!options.write) throw new Error("expected write mode");
      await writeFile(${JSON.stringify(markerPath)}, "yes");
    }
  `);

  const calls: string[] = [];
  const client = {
    async query(text: string) {
      calls.push(text);
      return { rows: [] };
    },
    release() {},
  };

  try {
    const result = await refreshCatalogFromRepo({ async connect() { return client; } }, repoRoot);
    assert.deepEqual(result, { updated_count: 1, skipped_count: 0, batches: 1 });
    assert.equal(calls.filter((call) => call === "BEGIN").length, 1);
    assert.equal(await readFile(markerPath, "utf8"), "yes");
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
