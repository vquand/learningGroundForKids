import { loadCatalogSeeds } from "./catalog-seeds.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildCatalogItem, itemKey, makeProvenance, normalizeTitle } from "./catalog-crawler-lib.mjs";

// Build only the landmark/sightseeing slice from QLever's public Wikidata index.
// The query snapshots are intentionally kept outside the repository; this script
// is a deterministic formatter/validator, not a second unbounded crawler.
const repoDir = resolve(new URL("../..", import.meta.url).pathname);
const generatedPath = join(repoDir, "frontend", "data", "generated-catalog.json");
const globalSnapshot = process.env.LANDMARK_GLOBAL_SNAPSHOT || "/tmp/landmarks-all-opt.json";
const vietnamSnapshot = process.env.LANDMARK_VIETNAM_SNAPSHOT || "/tmp/landmarks-vn2.json";
const outputPath = process.env.LANDMARK_OUTPUT || "/tmp/expanded-landmark.json";
const provenancePath = process.env.LANDMARK_PROVENANCE_OUTPUT || "/tmp/expanded-landmark-provenance.json";
const reportPath = process.env.LANDMARK_REPORT_OUTPUT || "/tmp/expanded-landmark-report.json";
const target = Number(process.env.LANDMARK_TARGET || 500);
const vietnamMinimum = Math.ceil(target * 0.1);
const accessedAt = process.env.CRAWL_DATE || new Date().toISOString().slice(0, 10);

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function value(binding, name) {
  return clean(binding?.[name]?.value);
}

function qid(binding) {
  const raw = value(binding, "item");
  const match = raw.match(/Q\d+$/i);
  return match ? match[0].toUpperCase() : null;
}

function parsePoint(binding) {
  const raw = value(binding, "coord");
  const match = raw.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
  if (!match) return null;
  const longitude = Number(match[1]);
  const latitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function articleTitle(url, fallback) {
  try {
    const parsed = new URL(url);
    const raw = decodeURIComponent(parsed.pathname.split("/wiki/")[1] || "");
    return raw.replaceAll("_", " ") || fallback;
  } catch {
    return fallback;
  }
}

async function readSnapshot(path) {
  const snapshot = JSON.parse(await readFile(path, "utf8"));
  return snapshot.results?.bindings ?? [];
}

async function loadExistingItems() {
  const items = await loadCatalogSeeds();
  try {
    items.push(...JSON.parse(await readFile(generatedPath, "utf8")));
  } catch {
    // Generated catalog is optional in a clean checkout.
  }
  return items;
}

function toMetadata(binding, isVietnam) {
  const id = qid(binding);
  const article = value(binding, "article");
  const title = value(binding, "label") || articleTitle(article, id || "Unnamed landmark");
  const coord = parsePoint(binding);
  const countryCode = value(binding, "countryCode").toUpperCase();
  const countryName = value(binding, "countryLabel");
  if (!id || !article || !coord || !/^[A-Z]{2}$/.test(countryCode) || !countryName) return null;
  return {
    titleEn: title,
    titleVi: value(binding, "labelVi") || title,
    descriptionEn: value(binding, "descEn") || `${title} is a natural or sightseeing landmark.`,
    descriptionVi: value(binding, "descVi") || "Đây là một địa danh tự nhiên hoặc điểm tham quan.",
    wikidataId: id,
    wikidataUrl: `https://www.wikidata.org/wiki/${id}`,
    pageUrl: article,
    countryCode,
    countryNameEn: countryName,
    countryNameVi: countryCode === "VN" ? "Việt Nam" : countryName,
    latitude: coord.latitude,
    longitude: coord.longitude,
    coordinateBasis: "direct",
    placeNameEn: title,
    placeNameVi: value(binding, "labelVi") || title,
    accessedAt,
    sourceCategory: "Wikidata landmark description query",
    uncertainties: [
      "Landmark category is inferred from a Wikidata description keyword and geospatial record.",
      ...(isVietnam ? [] : ["Country is the Wikidata P17 country claim; disputed or transboundary geography may need review."]),
    ],
  };
}

const [globalRows, vietnamRows, existingItems] = await Promise.all([
  readSnapshot(globalSnapshot),
  readSnapshot(vietnamSnapshot),
  loadExistingItems(),
]);

const existingKeys = new Set(existingItems.map(itemKey));
const existingTitles = new Set(existingItems.map((item) => `landmark|${normalizeTitle(item.translations?.find((translation) => translation.lang === "en")?.title)}`));
const seenQids = new Set();
const candidates = [];
for (const [rows, isVietnam] of [[vietnamRows, true], [globalRows, false]]) {
  for (const row of rows) {
    const entry = toMetadata(row, isVietnam);
    if (!entry || seenQids.has(entry.wikidataId) || (isVietnam && entry.countryCode !== "VN") || (!isVietnam && entry.countryCode === "VN")) continue;
    seenQids.add(entry.wikidataId);
    candidates.push(entry);
  }
}

const vietnam = candidates.filter((entry) => entry.countryCode === "VN").sort((a, b) => normalizeTitle(a.titleEn).localeCompare(normalizeTitle(b.titleEn)));
const global = candidates.filter((entry) => entry.countryCode !== "VN").sort((a, b) => normalizeTitle(a.titleEn).localeCompare(normalizeTitle(b.titleEn)));
const selected = [];
const selectedKeys = new Set(existingKeys);
const selectedTitles = new Set(existingTitles);
for (const entry of [...vietnam, ...global]) {
  if (selected.length >= target) break;
  const item = buildCatalogItem("landmark", entry, [entry.countryNameEn], [entry.countryNameVi]);
  const key = itemKey(item);
  const titleKey = `landmark|${normalizeTitle(entry.titleEn)}`;
  if (selectedKeys.has(key) || selectedTitles.has(titleKey)) continue;
  selected.push(entry);
  selectedKeys.add(key);
  selectedTitles.add(titleKey);
}

const vietnamCount = selected.filter((entry) => entry.countryCode === "VN").length;
if (selected.length !== target || vietnamCount < vietnamMinimum) {
  throw new Error(`landmark: selected ${selected.length}/${target}; Vietnam ${vietnamCount}/${vietnamMinimum}`);
}

const countryPairs = new Map(selected.map((entry) => [entry.countryNameEn, entry.countryNameVi]));
const poolEn = [...countryPairs.keys()].sort();
const poolVi = poolEn.map((name) => countryPairs.get(name) || name);
const items = selected.map((entry) => buildCatalogItem("landmark", entry, poolEn, poolVi));
const provenance = items.map((item, index) => makeProvenance("landmark", selected[index], item));
items.sort((a, b) => itemKey(a).localeCompare(itemKey(b)));
provenance.sort((a, b) => a.item_key.localeCompare(b.item_key));

await writeFile(outputPath, `${JSON.stringify(items, null, 2)}\n`);
await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify({
  accessed_at: accessedAt,
  category: "landmark",
  target,
  vietnam_minimum: vietnamMinimum,
  selected: items.length,
  vietnam: vietnamCount,
  source: "QLever public Wikidata index; English Wikipedia article URLs and Wikidata entity URLs retained per item",
  snapshots: { global: globalSnapshot, vietnam: vietnamSnapshot },
  candidate_counts: { global: global.length, vietnam: vietnam.length },
}, null, 2)}\n`);
console.log(`Wrote ${items.length} landmark items (${vietnamCount} Vietnam) to ${outputPath}`);
