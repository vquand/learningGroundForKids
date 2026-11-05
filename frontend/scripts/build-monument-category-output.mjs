import { loadCatalogSeeds } from "./catalog-seeds.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildCatalogItem, itemKey, makeProvenance, normalizeTitle } from "./catalog-crawler-lib.mjs";

const repoDir = resolve(new URL("../..", import.meta.url).pathname);
const frontendDir = join(repoDir, "frontend");
const globalSnapshot = process.env.MONUMENT_GLOBAL_SNAPSHOT || "/tmp/monuments-global.json";
const vietnamSnapshot = process.env.MONUMENT_VIETNAM_SNAPSHOT || "/tmp/monuments-vn.json";
const outputPath = process.env.MONUMENT_OUTPUT || "/tmp/expanded-monument.json";
const provenancePath = process.env.MONUMENT_PROVENANCE_OUTPUT || "/tmp/expanded-monument-provenance.json";
const reportPath = process.env.MONUMENT_REPORT_OUTPUT || "/tmp/expanded-monument-report.json";
const target = Number(process.env.MONUMENT_TARGET || 500);
const vietnamMinimum = Math.ceil(target * 0.1);
const accessedAt = process.env.CRAWL_DATE || new Date().toISOString().slice(0, 10);

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const bindingValue = (binding, name) => clean(binding?.[name]?.value);
const qid = (binding) => (bindingValue(binding, "item").match(/Q\d+$/i)?.[0] || "").toUpperCase() || null;
function point(binding) {
  const value = bindingValue(binding, "coord").match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
  if (!value) return null;
  const longitude = Number(value[1]);
  const latitude = Number(value[2]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 ? { latitude, longitude } : null;
}
const articleTitle = (url, fallback) => { try { return decodeURIComponent(new URL(url).pathname.split("/wiki/")[1] || "").replaceAll("_", " ") || fallback; } catch { return fallback; } };
const readRows = async (path) => (JSON.parse(await readFile(path, "utf8"))).results?.bindings ?? [];

async function existingItems() {
  const result = [...JSON.parse(await readFile(join(frontendDir, "data", "generated-catalog.json"), "utf8"))];
  result.push(...await loadCatalogSeeds());
  return result;
}

function metadata(binding, vietnam) {
  const id = qid(binding);
  const article = bindingValue(binding, "article");
  const coordinate = point(binding);
  const code = bindingValue(binding, "countryCode").toUpperCase();
  const country = bindingValue(binding, "countryLabel");
  if (!id || !article || !coordinate || !/^[A-Z]{2}$/.test(code) || !country) return null;
  return {
    titleEn: bindingValue(binding, "label") || articleTitle(article, id),
    titleVi: bindingValue(binding, "labelVi") || bindingValue(binding, "label") || articleTitle(article, id),
    descriptionEn: bindingValue(binding, "descEn") || `${bindingValue(binding, "label")} is a historic monument or site.`,
    descriptionVi: bindingValue(binding, "descVi") || "Đây là một di tích hoặc địa điểm lịch sử.",
    wikidataId: id,
    wikidataUrl: `https://www.wikidata.org/wiki/${id}`,
    pageUrl: article,
    viPageUrl: undefined,
    countryCode: code,
    countryNameEn: country,
    countryNameVi: code === "VN" ? "Việt Nam" : country,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    coordinateBasis: "direct",
    placeNameEn: bindingValue(binding, "label") || articleTitle(article, id),
    placeNameVi: bindingValue(binding, "labelVi") || bindingValue(binding, "label") || articleTitle(article, id),
    accessedAt,
    sourceCategory: vietnam ? "QLever Wikidata monument query (Vietnam)" : "QLever Wikidata monument query",
    uncertainties: ["Monument category is inferred from Wikidata type and description; human review is required before publication."],
  };
}

const [globalRows, vietnamRows, existing] = await Promise.all([readRows(globalSnapshot), readRows(vietnamSnapshot), existingItems()]);
const existingKeys = new Set(existing.map(itemKey));
const existingTitles = new Set(existing.map((item) => `monument|${normalizeTitle(item.translations?.find((translation) => translation.lang === "en")?.title)}`));
const seenIds = new Set();
const candidates = [];
for (const [rows, vietnam] of [[vietnamRows, true], [globalRows, false]]) {
  for (const row of rows) {
    const entry = metadata(row, vietnam);
    if (!entry || seenIds.has(entry.wikidataId) || (vietnam && entry.countryCode !== "VN") || (!vietnam && entry.countryCode === "VN")) continue;
    seenIds.add(entry.wikidataId);
    candidates.push(entry);
  }
}
const vietnam = candidates.filter((entry) => entry.countryCode === "VN").sort((a, b) => normalizeTitle(a.titleEn).localeCompare(normalizeTitle(b.titleEn)));
const global = candidates.filter((entry) => entry.countryCode !== "VN").sort((a, b) => normalizeTitle(a.titleEn).localeCompare(normalizeTitle(b.titleEn)));
const selected = [];
const keys = new Set(existingKeys);
const titles = new Set(existingTitles);
for (const entry of [...vietnam, ...global]) {
  if (selected.length >= target) break;
  const item = buildCatalogItem("monument", entry, [entry.countryNameEn], [entry.countryNameVi]);
  const key = itemKey(item);
  const title = `monument|${normalizeTitle(entry.titleEn)}`;
  if (keys.has(key) || titles.has(title)) continue;
  selected.push(entry);
  keys.add(key);
  titles.add(title);
}
const vietnamCount = selected.filter((entry) => entry.countryCode === "VN").length;
if (selected.length !== target || vietnamCount < vietnamMinimum) throw new Error(`monument: selected ${selected.length}/${target}; Vietnam ${vietnamCount}/${vietnamMinimum}`);
const countryVi = new Map(selected.map((entry) => [entry.countryNameEn, entry.countryNameVi]));
const poolEn = [...countryVi.keys()].sort();
const poolVi = poolEn.map((country) => countryVi.get(country) || country);
const items = selected.map((entry) => buildCatalogItem("monument", entry, poolEn, poolVi));
const provenance = items.map((item, index) => makeProvenance("monument", selected[index], item));
items.sort((a, b) => itemKey(a).localeCompare(itemKey(b)));
provenance.sort((a, b) => a.item_key.localeCompare(b.item_key));
await writeFile(outputPath, `${JSON.stringify(items, null, 2)}\n`);
await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify({ accessed_at: accessedAt, category: "monument", target, vietnam_minimum: vietnamMinimum, selected: items.length, vietnam: vietnamCount, source: "QLever public Wikidata index; English Wikipedia article URLs and Wikidata entity URLs retained", candidate_counts: { global: global.length, vietnam: vietnam.length } }, null, 2)}\n`);
console.log(`Wrote ${items.length} monument items (${vietnamCount} Vietnam) to ${outputPath}`);
