import { loadCatalogSeeds } from "./catalog-seeds.mjs";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { itemKey, normalizeTitle } from "./catalog-crawler-lib.mjs";

const frontendDir = resolve(new URL("..", import.meta.url).pathname);
const target = Number(process.env.ANIMAL_TARGET || 2000);
const vietnamMinimum = Math.ceil(target * 0.1);
const accessedAt = process.env.CRAWL_DATE || new Date().toISOString().slice(0, 10);
const resolveBatchPath = (explicit, flatPath, directoryPath) => {
  if (explicit) return explicit;
  if (existsSync(flatPath)) return flatPath;
  if (existsSync(directoryPath)) return directoryPath;
  return flatPath;
};
const sources = [
  { name: "mammals", path: resolveBatchPath(process.env.ANIMAL_MAMMALS_CATALOG, "/tmp/expanded-animal-mammals-all.json", "/tmp/expanded-animal-mammals/expanded-catalog.json"), target: 870 },
  { name: "dinosaurs", path: resolveBatchPath(process.env.ANIMAL_DINOSAURS_CATALOG, "/tmp/expanded-animal-dinosaurs-all2.json", "/tmp/expanded-animal-dinosaurs/expanded-catalog.json"), target: 930 },
  { name: "mixed", path: resolveBatchPath(process.env.ANIMAL_MIXED_CATALOG, "/tmp/expanded-animal-mixed.json", "/tmp/expanded-animal-mixed/expanded-catalog.json"), target: 230 },
];
const outputPath = process.env.ANIMAL_OUTPUT || "/tmp/expanded-animal-merged.json";
const provenancePath = process.env.ANIMAL_PROVENANCE_OUTPUT || "/tmp/expanded-animal-merged-provenance.json";
const reportPath = process.env.ANIMAL_REPORT_OUTPUT || "/tmp/expanded-animal-merged-report.json";
const rejectedPath = process.env.ANIMAL_REJECTED_OUTPUT || "/tmp/expanded-animal-merged-rejected.json";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const titleKey = (item) => `${item.category}|${normalizeTitle(item.translations?.find((translation) => translation.lang === "en")?.title ?? "")}`;

async function loadExistingItems() {
  const result = [];
  const generatedPath = join(frontendDir, "data", "generated-catalog.json");
  result.push(...await readJson(generatedPath));
  result.push(...await loadCatalogSeeds());
  try {
    result.push(...await readJson(join(frontendDir, "data", "expanded-catalog.json")));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return result;
}

const [existing, ...batchRows] = await Promise.all([
  loadExistingItems(),
  ...sources.map(async (source) => ({ source, rows: (await readJson(source.path)).filter((row) => row.category === "animal") })),
]);
const existingKeys = new Set(existing.map(itemKey));
const existingTitles = new Set(existing.map(titleKey));
const selected = [];
const selectedKeys = new Set(existingKeys);
const selectedTitles = new Set(existingTitles);
const provenanceByKey = new Map();
const rejected = [];

for (const { source, rows } of batchRows) {
  const sourceProvenancePath = source.path.replace(/\.json$/i, "-provenance.json");
  let provenanceRows = [];
  try {
    provenanceRows = await readJson(sourceProvenancePath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const sourceProvenance = new Map(provenanceRows.map((entry) => [entry.item_key, entry]));
  const ordered = [...rows].sort((a, b) => {
    const vietnam = Number(b.country_code === "VN") - Number(a.country_code === "VN");
    return vietnam || itemKey(a).localeCompare(itemKey(b));
  });
  let accepted = 0;
  for (const item of ordered) {
    const key = itemKey(item);
    const title = titleKey(item);
    const provenance = sourceProvenance.get(key);
    if (!provenance) {
      rejected.push({ title: item.translations?.find((translation) => translation.lang === "en")?.title, source: source.name, reason: "missing provenance" });
      continue;
    }
    if (selected.length >= target || accepted >= source.target) break;
    if (selectedKeys.has(key) || selectedTitles.has(title)) {
      rejected.push({ title: item.translations?.find((translation) => translation.lang === "en")?.title, source: source.name, reason: "identity collision with existing or earlier batch" });
      continue;
    }
    selected.push(item);
    selectedKeys.add(key);
    selectedTitles.add(title);
    provenanceByKey.set(key, provenance);
    accepted += 1;
  }
  if (accepted < source.target) {
    console.warn(`${source.name}: selected ${accepted}/${source.target}; the merge will top up from remaining batches`);
  }
}

// If a batch contributed duplicates, top up from any remaining source rows.
if (selected.length < target) {
  for (const { source, rows } of batchRows) {
    for (const item of rows) {
      if (selected.length >= target) break;
      const key = itemKey(item);
      const title = titleKey(item);
      if (selectedKeys.has(key) || selectedTitles.has(title)) continue;
      const sourceProvenancePath = source.path.replace(/\.json$/i, "-provenance.json");
      const provenanceRows = await readJson(sourceProvenancePath);
      const provenance = provenanceRows.find((entry) => entry.item_key === key);
      if (!provenance) continue;
      selected.push(item);
      selectedKeys.add(key);
      selectedTitles.add(title);
      provenanceByKey.set(key, provenance);
    }
  }
}

const vietnamCount = selected.filter((item) => item.country_code === "VN").length;
if (selected.length !== target) throw new Error(`animal: selected ${selected.length}/${target}`);
if (vietnamCount < vietnamMinimum) throw new Error(`animal: Vietnam count ${vietnamCount}/${vietnamMinimum}`);

selected.sort((a, b) => itemKey(a).localeCompare(itemKey(b)));
const provenance = selected.map((item) => provenanceByKey.get(itemKey(item))).sort((a, b) => a.item_key.localeCompare(b.item_key));
await writeFile(outputPath, `${JSON.stringify(selected, null, 2)}\n`);
await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
await writeFile(rejectedPath, `${JSON.stringify(rejected, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify({
  accessed_at: accessedAt,
  category: "animal",
  target,
  vietnam_minimum: vietnamMinimum,
  selected: selected.length,
  vietnam: vietnamCount,
  batches: Object.fromEntries(batchRows.map(({ source, rows }) => [source.name, { discovered: rows.length, target: source.target, selected: selected.filter((item) => itemKey(item) && rows.some((row) => itemKey(row) === itemKey(item))).length }])),
  source: "Wikimedia/Wikidata source-backed animal batches",
}, null, 2)}\n`);
console.log(`Merged ${selected.length} animals (${vietnamCount} Vietnam) to ${outputPath}`);
