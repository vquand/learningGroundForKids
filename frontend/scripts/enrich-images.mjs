import { loadCatalogSeeds } from "./catalog-seeds.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const frontendDir = resolve(dirname(new URL(import.meta.url).pathname), "..");
const generatedCatalogPath = join(frontendDir, "data", "generated-catalog.json");
const expandedCatalogPath = join(frontendDir, "data", "expanded-catalog.json");
const expandedProvenancePath = join(frontendDir, "data", "expanded-catalog-provenance.json");
const overridesPath = join(frontendDir, "data", "image-overrides.json");
const categories = ["food", "monument", "landmark", "music", "movie", "phenomenon", "animal"];
const endpoint = "https://commons.wikimedia.org/w/api.php";
const openverseEndpoint = "https://api.openverse.org/v1/images/";
const concurrency = Math.max(1, Number(process.env.IMAGE_CONCURRENCY ?? 1));
const requestDelayMs = Math.max(0, Number(process.env.IMAGE_REQUEST_DELAY_MS ?? 250));
const requestTimeoutMs = Math.max(1000, Number(process.env.IMAGE_REQUEST_TIMEOUT_MS ?? 8000));

function itemKey(item) {
  const title = item.translations?.find((translation) => translation.lang === "en")?.title ?? "";
  return `${item.category}|${item.latitude}|${item.longitude}|${title}`;
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "PersonalLearningGround/0.1 (educational catalog image enrichment)" },
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (response.ok) return await response.json();
      if (response.status !== 429 && response.status < 500) return null;
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000 * (attempt + 1));
      continue;
    } catch {
      // Retry transient DNS, connection, and timeout errors.
    }
    await sleep(1000 * (attempt + 1));
  }
  return null;
}

async function runConcurrent(values, worker, workerCount = concurrency) {
  let cursor = 0;
  const results = [];
  async function consume() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(workerCount, values.length) }, consume));
  return results;
}

function imageFromPage(page) {
  const info = page?.imageinfo?.[0];
  if (!info?.thumburl || !info?.descriptionurl) return null;
  const license = cleanText(info.extmetadata?.LicenseShortName?.value || "Wikimedia Commons");
  const artist = cleanText(info.extmetadata?.Artist?.value || info.extmetadata?.Credit?.value);
  return {
    url: info.thumburl,
    source_url: info.descriptionurl,
    license,
    attribution: artist || undefined,
    file_title: page.title,
  };
}

function normalizePageTitle(value) {
  return String(value ?? "").replaceAll("_", " ").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function imageFromSpecialFilePath(imageUrl, relatedWikidataId) {
  const fileTitle = decodeURIComponent(imageUrl.split("/Special:FilePath/")[1] ?? "").replaceAll("_", " ");
  return {
    url: imageUrl,
    source_url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileTitle)}`,
    license: "Wikimedia Commons",
    file_title: `File:${fileTitle}`,
    related_wikidata_id: relatedWikidataId,
  };
}

async function enrichFromWikidata(items, overrides) {
  let provenance;
  try {
    provenance = JSON.parse(await readFile(expandedProvenancePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }
  const provenanceByKey = new Map(provenance.map((entry) => [entry.item_key, entry]));
  const pending = items
    .filter((item) => !overrides[itemKey(item)])
    .map((item) => ({ item, entry: provenanceByKey.get(itemKey(item)) }))
    .filter(({ entry }) => entry?.wikidata_id);
  const wikidataIds = [...new Set(pending.map(({ entry }) => entry.wikidata_id))];
  const batchConcurrency = Math.max(1, Number(process.env.IMAGE_BATCH_CONCURRENCY ?? 2));
  const idChunks = [];
  for (let index = 0; index < wikidataIds.length; index += 50) idChunks.push(wikidataIds.slice(index, index + 50));

  const imageClaims = await runConcurrent(idChunks, async (ids) => {
    const query = [
      "PREFIX wd: <http://www.wikidata.org/entity/>",
      "PREFIX wdt: <http://www.wikidata.org/prop/direct/>",
      `SELECT ?item ?image WHERE { VALUES ?item { ${ids.map((id) => `wd:${id}`).join(" ")} } ?item wdt:P18 ?image }`,
    ].join(" ");
    const url = new URL("https://qlever.cs.uni-freiburg.de/api/wikidata");
    url.searchParams.set("query", query);
    url.searchParams.set("format", "json");
    const body = await fetchJson(url);
    await sleep(requestDelayMs);
    return body?.results?.bindings ?? [];
  }, batchConcurrency);
  const fileByWikidataId = new Map();
  for (const bindings of imageClaims) {
    for (const binding of bindings) {
      const wikidataId = binding.item?.value?.match(/Q\d+$/i)?.[0]?.toUpperCase();
      const imageUrl = binding.image?.value;
      if (wikidataId && imageUrl?.includes("Special:FilePath/")) fileByWikidataId.set(wikidataId, imageUrl.replace(/^http:/i, "https:"));
    }
  }
  const fileByItemKey = new Map();
  for (const { item, entry } of pending) {
    const imageUrl = fileByWikidataId.get(entry.wikidata_id);
    if (imageUrl) fileByItemKey.set(itemKey(item), imageUrl);
  }
  let found = 0;
  for (const [key, imageUrl] of fileByItemKey) {
    overrides[key] = imageFromSpecialFilePath(imageUrl, entryForItemKey(key, pending));
    found += 1;
  }

  const missingWithIds = pending.filter(({ item, entry }) => !overrides[itemKey(item)] && entry.wikidata_id);
  const ancestorChunks = [];
  for (let index = 0; index < missingWithIds.length; index += 50) ancestorChunks.push(missingWithIds.slice(index, index + 50));
  for (const path of ["wdt:P171", "wdt:P171/wdt:P171"]) {
    if (!ancestorChunks.length) break;
    const ancestorBodies = await runConcurrent(ancestorChunks, async (batch) => {
      const query = [
        "PREFIX wd: <http://www.wikidata.org/entity/>",
        "PREFIX wdt: <http://www.wikidata.org/prop/direct/>",
        `SELECT ?item ?ancestor ?image WHERE { VALUES ?item { ${batch.map(({ entry }) => `wd:${entry.wikidata_id}`).join(" ")} } ?item ${path} ?ancestor . ?ancestor wdt:P18 ?image }`,
      ].join(" ");
      const url = new URL("https://qlever.cs.uni-freiburg.de/api/wikidata");
      url.searchParams.set("query", query);
      url.searchParams.set("format", "json");
      const body = await fetchJson(url);
      await sleep(requestDelayMs);
      return body?.results?.bindings ?? [];
    }, batchConcurrency);
    const ancestorImages = new Map();
    for (const bindings of ancestorBodies) {
      for (const binding of bindings) {
        const itemId = binding.item?.value?.match(/Q\d+$/i)?.[0]?.toUpperCase();
        const ancestorId = binding.ancestor?.value?.match(/Q\d+$/i)?.[0]?.toUpperCase();
        const imageUrl = binding.image?.value?.replace(/^http:/i, "https:");
        if (itemId && ancestorId && imageUrl?.includes("Special:FilePath/") && !ancestorImages.has(itemId)) {
          ancestorImages.set(itemId, { imageUrl, ancestorId });
        }
      }
    }
    for (const { item, entry } of missingWithIds) {
      if (overrides[itemKey(item)]) continue;
      const match = ancestorImages.get(entry.wikidata_id);
      if (!match) continue;
      overrides[itemKey(item)] = imageFromSpecialFilePath(match.imageUrl, match.ancestorId);
      found += 1;
    }
  }

  const missingPending = pending.filter(({ item }) => !overrides[itemKey(item)]);
  const wikipediaTitles = [...new Set(missingPending.map(({ entry }) => entry.title_en).filter(Boolean))];
  const wikipediaChunks = [];
  for (let index = 0; index < wikipediaTitles.length; index += 20) wikipediaChunks.push(wikipediaTitles.slice(index, index + 20));
  const wikipediaBodies = await runConcurrent(wikipediaChunks, async (titles) => {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("titles", titles.join("|"));
    url.searchParams.set("prop", "pageimages|info");
    url.searchParams.set("inprop", "url");
    url.searchParams.set("pithumbsize", "1000");
    url.searchParams.set("redirects", "1");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    const body = await fetchJson(url);
    await sleep(requestDelayMs);
    return body ?? {};
  }, batchConcurrency);
  const pageByTitle = new Map();
  for (const body of wikipediaBodies) {
    for (const page of Object.values(body.query?.pages ?? {})) {
      if (page?.title) pageByTitle.set(normalizePageTitle(page.title), page);
    }
    for (const alias of [...(body.query?.normalized ?? []), ...(body.query?.redirects ?? [])]) {
      const page = pageByTitle.get(normalizePageTitle(alias.to));
      if (page) pageByTitle.set(normalizePageTitle(alias.from), page);
    }
  }
  for (const { item, entry } of missingPending) {
    const page = pageByTitle.get(normalizePageTitle(entry.title_en));
    const imageUrl = page?.thumbnail?.source;
    if (!imageUrl || !page?.fullurl) continue;
    overrides[itemKey(item)] = {
      url: imageUrl,
      source_url: page.fullurl,
      license: "Wikimedia Commons via English Wikipedia",
      file_title: page.pageimage ? `File:${page.pageimage}` : undefined,
    };
    found += 1;
  }
  return found;
}

function entryForItemKey(key, pending) {
  return pending.find(({ item }) => itemKey(item) === key)?.entry?.wikidata_id;
}

async function loadItems() {
  const legacy = await loadCatalogSeeds(categories);
  let generated = [];
  try {
    generated = JSON.parse(await readFile(generatedCatalogPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  let expanded = [];
  try {
    expanded = JSON.parse(await readFile(expandedCatalogPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return [...legacy, ...generated, ...expanded];
}

async function findImage(item) {
  const title = item.translations?.find((translation) => translation.lang === "en")?.title;
  if (!title) return null;
  // Start with an exact bitmap search, then fall back to a broader Commons
  // title search. The fallback catches pages whose file titles include a
  // location, spelling, or alternate name in addition to the catalog title.
  for (const search of [`${title} filetype:bitmap`, title]) {
    const url = new URL(endpoint);
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", search);
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "1");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|extmetadata");
    url.searchParams.set("iiurlwidth", "1000");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    try {
      const body = await fetchJson(url);
      await sleep(requestDelayMs);
      const page = Object.values(body.query?.pages ?? {})[0];
      const image = imageFromPage(page);
      if (image) return image;
    } catch {
      // Try the next search form rather than dropping the item immediately.
    }
  }
  return null;
}

async function findOpenverseImageByQuery(title) {
  const url = new URL(openverseEndpoint);
  url.searchParams.set("q", title);
  url.searchParams.set("page_size", "1");
  const body = await fetchJson(url);
  const result = body?.results?.[0];
  if (!result?.url || !result?.foreign_landing_url || !/^https:\/\//i.test(result.url)) return null;
  const license = [result.license, result.license_version].filter(Boolean).join(" ").toUpperCase() || "Openverse licensed image";
  return {
    url: result.url,
    source_url: result.foreign_landing_url,
    license,
    license_url: result.license_url,
    attribution: result.attribution || result.creator || undefined,
    file_title: result.title,
  };
}

async function findOpenverseImage(item) {
  const title = item.translations?.find((translation) => translation.lang === "en")?.title;
  return title ? findOpenverseImageByQuery(title) : null;
}

const items = await loadItems();
let overrides = {};
try {
  overrides = JSON.parse(await readFile(overridesPath, "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const generatedItems = JSON.parse(await readFile(generatedCatalogPath, "utf8"));
let expandedItems = [];
try { expandedItems = JSON.parse(await readFile(expandedCatalogPath, "utf8")); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const scope = process.env.IMAGE_SCOPE ?? "all";
const scopedItems = scope === "generated" ? generatedItems : scope === "expanded" ? expandedItems : items;
const category = process.env.IMAGE_CATEGORY?.trim().toLowerCase();
const selected = category ? scopedItems.filter((item) => item.category === category) : scopedItems;
let found = 0;
if (!category && (scope === "all" || scope === "expanded") && process.env.IMAGE_SKIP_BATCH !== "1") {
  found += await enrichFromWikidata(expandedItems, overrides);
  console.log(`Added ${found} Wikimedia Commons mappings from batched Wikidata image claims.`);
}
const limit = Number(process.env.IMAGE_LIMIT ?? selected.length);
const offset = Math.max(0, Number(process.env.IMAGE_OFFSET ?? 0));
const workItems = selected
  .filter((item) => !overrides[itemKey(item)])
  .slice(offset, offset + (Number.isFinite(limit) ? limit : selected.length));
let cursor = 0;
async function worker() {
  while (cursor < workItems.length) {
    const item = workItems[cursor++];
    const image = process.env.IMAGE_PROVIDER === "openverse"
      ? await findOpenverseImage(item)
      : await findImage(item) || (process.env.IMAGE_PROVIDER === "commons" ? null : await findOpenverseImage(item));
    if (image) {
      overrides[itemKey(item)] = image;
      found += 1;
    }
    if ((cursor % 25) === 0 || cursor === workItems.length) {
      console.log(`Reviewed ${cursor}/${workItems.length} selected items (${found} reusable images found).`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
if (process.env.IMAGE_CATEGORY_FALLBACK === "1") {
  const fallbackQueries = {
    food: "traditional food dish",
    monument: "historic monument architecture",
    landmark: "natural landscape landmark",
    music: "musical instruments performance",
    movie: "film camera cinema",
    phenomenon: "natural weather phenomenon",
    animal: "wildlife animal",
  };
  const fallbackImages = {};
  for (const [category, query] of Object.entries(fallbackQueries)) {
    const image = await findOpenverseImageByQuery(query);
    if (image) fallbackImages[category] = { ...image, fallback: true, fallback_category: category };
  }
  let fallbackCount = 0;
  for (const item of scopedItems) {
    const key = itemKey(item);
    const fallback = fallbackImages[item.category];
    if (overrides[key] || !fallback) continue;
    overrides[key] = { ...fallback, file_title: `Category fallback: ${item.category}` };
    fallbackCount += 1;
  }
  console.log(`Added ${fallbackCount} category fallback images for items with no specific image match.`);
}
await writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`);
console.log(`Wrote ${found} Wikimedia Commons image mappings to ${overridesPath}.`);
