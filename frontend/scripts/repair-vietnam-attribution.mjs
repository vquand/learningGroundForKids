import { readFile, writeFile } from "node:fs/promises";
import { timePrecision } from "./catalog-crawler-lib.mjs";

const catalogPath = process.env.CATALOG_PATH || "data/expanded-catalog.json";
const provenancePath = process.env.PROVENANCE_PATH || "data/expanded-catalog-provenance.json";
const delayMs = Math.max(250, Number(process.env.CRAWL_DELAY_MS || 500));
const userAgent = process.env.CRAWL_USER_AGENT || "PersonalLearningGround/0.2 (educational catalog; contact repository owner)";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const entityId = (value) => {
  const match = String(value ?? "").match(/Q\d+$/i);
  return match ? match[0].toUpperCase() : null;
};
const idsFor = (claims, properties) => properties.flatMap((property) => (claims?.[property] ?? []).map((claim) => entityId(claim?.mainsnak?.datavalue?.value?.id)).filter(Boolean));
const countryCode = (entity) => {
  const code = entity?.claims?.P297?.[0]?.mainsnak?.datavalue?.value;
  return typeof code === "string" && /^[A-Z]{2}$/.test(code) ? code : null;
};
const label = (entity, lang) => clean(entity?.labels?.[lang]?.value);
const description = (entity, lang) => clean(entity?.descriptions?.[lang]?.value);

async function getJson(ids) {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", ids.join("|"));
  url.searchParams.set("props", "labels|descriptions|claims");
  url.searchParams.set("languages", "en|vi");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": userAgent }, signal: AbortSignal.timeout(30000) });
      if (response.ok) { const body = await response.json(); await sleep(delayMs); return body; }
      await sleep(Math.max(1000 * (attempt + 1), Number(response.headers.get("retry-after") || 0) * 1000));
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(1000 * (attempt + 1));
    }
  }
  return { entities: {} };
}

const items = JSON.parse(await readFile(catalogPath, "utf8"));
const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
for (const item of items) {
  if (item.start_year != null) item.time_precision = timePrecision(item.start_year);
}
if (process.env.SKIP_NETWORK === "1") {
  await writeFile(catalogPath, `${JSON.stringify(items, null, 2)}\n`);
  console.log("Recomputed catalog time precision without network access.");
  process.exit(0);
}
const byKey = new Map(provenance.map((entry) => [entry.item_key, entry]));
const qids = items.filter((item) => item.country_code === "VN").map((item) => byKey.get(`${item.category}|${item.latitude}|${item.longitude}|${item.translations?.find((translation) => translation.lang === "en")?.title}`)?.wikidata_id).map(entityId).filter(Boolean);
const entities = new Map();
for (let offset = 0; offset < qids.length; offset += 50) {
  const batch = [...new Set(qids.slice(offset, offset + 50))];
  const body = await getJson(batch);
  for (const entity of Object.values(body.entities ?? {})) entities.set(entity.id, entity);
}
const relationIds = [...entities.values()].flatMap((entity) => idsFor(entity.claims, ["P495", "P17", "P131", "P276"]));
for (let offset = 0; offset < relationIds.length; offset += 50) {
  const batch = [...new Set(relationIds.slice(offset, offset + 50))].filter((id) => !entities.has(id));
  if (!batch.length) continue;
  const body = await getJson(batch);
  for (const entity of Object.values(body.entities ?? {})) entities.set(entity.id, entity);
}

let corrected = 0;
for (const item of items) {
  if (item.country_code !== "VN") continue;
  const englishTitle = item.translations?.find((translation) => translation.lang === "en")?.title;
  const key = `${item.category}|${item.latitude}|${item.longitude}|${englishTitle}`;
  const qid = entityId(byKey.get(key)?.wikidata_id);
  const entity = qid ? entities.get(qid) : null;
  const properties = item.category === "food" ? ["P495", "P17", "P131", "P276"] : ["P17", "P131", "P276"];
  const country = idsFor(entity?.claims, properties).map((id) => entities.get(id)).find((candidate) => countryCode(candidate));
  const resolvedCode = countryCode(country);
  if (!resolvedCode || resolvedCode === "VN") continue;
  item.country_code = resolvedCode;
  const en = label(country, "en") || resolvedCode;
  const vi = label(country, "vi") || en;
  for (const question of item.quiz_questions ?? []) {
    if (question.group !== 0) continue;
    question.options[0] = question.lang === "vi" ? vi : en;
  }
  corrected += 1;
}

await writeFile(catalogPath, `${JSON.stringify(items, null, 2)}\n`);
console.log(`Corrected ${corrected} Vietnam country assignments from Wikidata claims.`);
