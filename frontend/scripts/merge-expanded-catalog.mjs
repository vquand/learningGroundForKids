import { loadCatalogSeeds } from "./catalog-seeds.mjs";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const frontendDir = resolve(new URL("..", import.meta.url).pathname);
const outputDir = join(frontendDir, "data");
const phenomenonDir = existsSync("/tmp/expanded-phenomenon5/expanded-catalog.json")
  ? "/tmp/expanded-phenomenon5"
  : "/tmp/expanded-phenomenon4";
const animalSource = existsSync("/tmp/expanded-animal-merged.json")
  ? "/tmp/expanded-animal-merged.json"
  : join(outputDir, "expanded-catalog.json");
const animalProvenance = existsSync("/tmp/expanded-animal-merged-provenance.json")
  ? "/tmp/expanded-animal-merged-provenance.json"
  : join(outputDir, "expanded-catalog-provenance.json");
const sourceFiles = {
  food: process.env.FOOD_CATALOG || join(outputDir, "expanded-catalog.json"),
  monument: process.env.MONUMENT_CATALOG || "/tmp/expanded-monument.json",
  landmark: process.env.LANDMARK_CATALOG || "/tmp/expanded-landmark.json",
  phenomenon: process.env.PHENOMENON_CATALOG || join(phenomenonDir, "expanded-catalog.json"),
  animal: process.env.ANIMAL_CATALOG || animalSource,
};
const provenanceFiles = {
  food: process.env.FOOD_PROVENANCE || join(outputDir, "expanded-catalog-provenance.json"),
  monument: process.env.MONUMENT_PROVENANCE || "/tmp/expanded-monument-provenance.json",
  landmark: process.env.LANDMARK_PROVENANCE || "/tmp/expanded-landmark-provenance.json",
  phenomenon: process.env.PHENOMENON_PROVENANCE || join(phenomenonDir, "expanded-catalog-provenance.json"),
  animal: process.env.ANIMAL_PROVENANCE || animalProvenance,
};
const rejectedFiles = {
  monument: "/tmp/expanded-monument-rejected.json",
  phenomenon: join(phenomenonDir, "expanded-catalog-rejected.json"),
  animal: "/tmp/expanded-animal-merged-rejected.json",
};
const expected = { food: 1000, monument: 500, landmark: 500, phenomenon: 100, animal: 2000 };
const minimumVietnam = { food: 100, monument: 50, landmark: 50, phenomenon: 10, animal: 200 };
const itemKey = (item) => `${item.category}|${String(item.latitude)}|${String(item.longitude)}|${item.translations?.find((translation) => translation.lang === "en")?.title ?? ""}`;
const titleKey = (item) => `${item.category}|${String(item.translations?.find((translation) => translation.lang === "en")?.title ?? "").normalize("NFKD").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase()}`;
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

async function existingItems() {
  const result = [...JSON.parse(await readFile(join(frontendDir, "data", "generated-catalog.json"), "utf8"))];
  result.push(...await loadCatalogSeeds(["food", "monument", "landmark", "phenomenon", "animal"]));
  return result;
}

const items = [];
const provenance = [];
const rejected = [];
for (const [category, expectedCount] of Object.entries(expected)) {
  const rawRows = await readJson(sourceFiles[category]);
  const rows = rawRows.filter((row) => row.category === category);
  const rowKeys = new Set(rows.map(itemKey));
  const refs = (await readJson(provenanceFiles[category])).filter((entry) => rowKeys.has(entry.item_key));
  if (rows.length !== expectedCount) throw new Error(`${category}: expected ${expectedCount}, found ${rows.length}`);
  if (refs.length !== rows.length) throw new Error(`${category}: provenance count does not match item count`);
  items.push(...rows);
  provenance.push(...refs);
  if (rejectedFiles[category]) {
    try { rejected.push(...await readJson(rejectedFiles[category])); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
}

const existing = await existingItems();
const existingKeys = new Set(existing.map(itemKey));
const existingTitles = new Set(existing.map(titleKey));
const keys = new Set();
const titles = new Set();
for (const item of items) {
  const key = itemKey(item);
  const title = titleKey(item);
  if (existingKeys.has(key) || keys.has(key)) throw new Error(`duplicate item key: ${key}`);
  if (existingTitles.has(title) || titles.has(title)) throw new Error(`duplicate item title: ${title}`);
  if (!/^[A-Z]{2}$/.test(item.country_code ?? "")) throw new Error(`invalid country code for ${key}`);
  keys.add(key);
  titles.add(title);
}
const provenanceKeys = new Set(provenance.map((entry) => entry.item_key));
for (const item of items) if (!provenanceKeys.has(itemKey(item))) throw new Error(`missing provenance: ${itemKey(item)}`);
for (const [category, minimum] of Object.entries(minimumVietnam)) {
  const count = items.filter((item) => item.category === category && item.country_code === "VN").length;
  if (count < minimum) throw new Error(`${category}: Vietnam count ${count} is below ${minimum}`);
}

items.sort((a, b) => itemKey(a).localeCompare(itemKey(b)));
provenance.sort((a, b) => a.item_key.localeCompare(b.item_key));
await writeFile(join(outputDir, "expanded-catalog.json"), `${JSON.stringify(items, null, 2)}\n`);
await writeFile(join(outputDir, "expanded-catalog-provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
await writeFile(join(outputDir, "expanded-catalog-rejected.json"), `${JSON.stringify(rejected, null, 2)}\n`);
await writeFile(join(outputDir, "expanded-catalog-report.json"), `${JSON.stringify({
  accessed_at: new Date().toISOString().slice(0, 10),
  source: "Wikimedia/Wikidata source-backed category crawls; monument and landmark slices via QLever Wikidata index",
  targets: expected,
  vietnam_minimums: minimumVietnam,
  categories: Object.fromEntries(Object.entries(expected).map(([category, count]) => [category, { accepted: count, vietnam: items.filter((item) => item.category === category && item.country_code === "VN").length }])),
  total: items.length,
}, null, 2)}\n`);
console.log(`Merged ${items.length} expanded catalog items (${provenance.length} provenance records).`);
