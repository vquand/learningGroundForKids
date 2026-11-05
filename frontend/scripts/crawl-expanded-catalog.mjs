import { loadCatalogSeeds } from "./catalog-seeds.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  buildCatalogItem,
  canonicalCategory,
  claimCoordinate,
  claimEntityIds,
  claimQuantity,
  claimYear,
  itemKey,
  makeProvenance,
  normalizeTitle,
} from "./catalog-crawler-lib.mjs";

const frontendDir = resolve(dirname(new URL(import.meta.url).pathname), "..");
// Keep output configurable so a category can be crawled and reviewed in
// isolation before the combined catalog is replaced.  The default remains
// the checked-in frontend/data directory used by the normal content command.
const outputDir = resolve(process.env.CRAWL_OUTPUT_DIR || join(frontendDir, "data"));
const pageApi = "https://en.wikipedia.org/w/api.php";
const wikidataApi = "https://www.wikidata.org/w/api.php";
const userAgent = process.env.CRAWL_USER_AGENT || "PersonalLearningGround/0.2 (educational catalog; contact repository owner)";
const delayMs = Math.max(250, Number(process.env.CRAWL_DELAY_MS || 500));
const requestTimeoutMs = Math.max(5000, Number(process.env.CRAWL_TIMEOUT_MS || 30000));
const targets = {
  food: Number(process.env.CRAWL_FOOD || 1000),
  monument: Number(process.env.CRAWL_MONUMENT || 500),
  landmark: Number(process.env.CRAWL_LANDMARK || process.env.CRAWL_SIGHTSEEING || 500),
  phenomenon: Number(process.env.CRAWL_PHENOMENON || 100),
  animal: Number(process.env.CRAWL_ANIMAL || 0),
};
const vietnamMinimums = Object.fromEntries(Object.entries(targets).map(([category, count]) => [category, Math.ceil(count * 0.1)]));
const accessedAt = process.env.CRAWL_DATE || new Date().toISOString().slice(0, 10);
const discoveryLimit = Math.max(20, Number(process.env.CRAWL_DISCOVERY_LIMIT || 0));
const categoryDepthLimit = Math.max(0, Number(process.env.CRAWL_CATEGORY_DEPTH ?? 1));
const maxCategoryPages = Math.max(1, Number(process.env.CRAWL_MAX_CATEGORY_PAGES ?? 1));
const discoveryMode = process.env.CRAWL_DISCOVERY_MODE || "search";

const categorySeeds = {
  food: [
    "Category:National dishes",
    "Category:Cuisine by country",
    "Category:Dishes by country",
    "Category:Food by country",
    "Category:Vietnamese cuisine",
    "Category:Food and drink in Vietnam",
  ],
  monument: [
    "Category:Monuments and memorials by country",
    "Category:World Heritage Sites by country",
    "Category:Archaeological sites by country",
    "Category:Castles by country",
    "Category:Temples by country",
    "Category:Monuments and memorials in Vietnam",
    "Category:World Heritage Sites in Vietnam",
    "Category:Buildings and structures in Vietnam",
  ],
  landmark: [
    "Category:Natural monuments by country",
    "Category:Landforms by country",
    "Category:National parks by country",
    "Category:Waterfalls by country",
    "Category:Caves by country",
    "Category:Tourist attractions by country",
    "Category:Landforms of Vietnam",
    "Category:National parks of Vietnam",
    "Category:Waterfalls of Vietnam",
    "Category:Tourist attractions in Vietnam",
  ],
  phenomenon: [
    "Category:Atmospheric optical phenomena",
    "Category:Natural phenomena",
    "Category:Natural hazards",
    "Category:Geological phenomena",
    "Category:Weather events",
    "Category:Clouds",
    "Category:Weather phenomena in Vietnam",
    "Category:Natural disasters in Vietnam",
    "Category:Typhoons in Vietnam",
    "Category:Floods in Vietnam",
  ],
  animal: [
    "Category:Animals by country",
    "Category:Mammals by country",
    "Category:Birds by country",
    "Category:Fish by country",
    "Category:Insects by country",
    "Category:Reptiles by country",
    "Category:Amphibians by country",
    "Category:Dinosaurs",
    "Category:Extinct animals",
    "Category:Fossils",
    "Category:Animals of Vietnam",
    "Category:Mammals of Vietnam",
    "Category:Birds of Vietnam",
    "Category:Fish of Vietnam",
    "Category:Insects of Vietnam",
  ],
};

const searchSeeds = {
  food: [
    "Vietnamese cuisine", "Vietnamese dish", "food in Vietnam",
    "dish food", "cuisine dish", "national dish", "traditional food", "noodle dish", "soup dish", "rice dish", "dessert", "beverage",
  ],
  monument: [
    "monument in Vietnam", "temple in Vietnam", "historic building in Vietnam",
    "monument", "memorial", "temple", "palace", "castle", "fortress", "cathedral", "mosque", "shrine", "archaeological site", "historic building",
  ],
  landmark: [
    "mountain in Vietnam", "waterfall in Vietnam", "national park in Vietnam", "tourist attraction in Vietnam",
    "mountain landmark", "waterfall", "national park", "cave", "lake landmark", "island landmark", "river landmark", "bay landmark", "beach landmark", "canyon", "tourist attraction",
  ],
  phenomenon: [
    // Vietnam-specific queries come first.  Discovery is bounded, so putting
    // these after broad global searches can consume the whole candidate window
    // before the required Vietnam quota is even represented.
    "weather phenomenon in Vietnam", "typhoon in Vietnam", "flood in Vietnam", "natural disaster in Vietnam", "storm in Vietnam", "earthquake in Vietnam", "drought in Vietnam", "tornado in Vietnam", "landslide in Vietnam", "volcanic eruption in Vietnam",
    "natural phenomenon", "atmospheric phenomenon", "weather phenomenon", "storm", "earthquake", "volcanic phenomenon", "avalanche", "aurora", "flood", "tornado", "cyclone", "tsunami", "drought", "hail", "fog", "lightning", "monsoon", "wildfire",
  ],
  animal: [
    "animal in Vietnam", "mammal in Vietnam", "bird in Vietnam", "fish in Vietnam", "insect in Vietnam", "reptile in Vietnam", "amphibian in Vietnam",
    "mammal", "bird", "fish", "insect", "reptile", "amphibian", "dinosaur", "prehistoric animal", "extinct animal", "fossil", "animal species",
  ],
};

const vietnamAnchors = [
  [21.0285, 105.8542, "Hanoi", "Hà Nội"],
  [10.8231, 106.6297, "Ho Chi Minh City", "Thành phố Hồ Chí Minh"],
  [16.0544, 108.2022, "Da Nang", "Đà Nẵng"],
  [20.9101, 107.1839, "Ha Long Bay", "Vịnh Hạ Long"],
  [22.3364, 103.8438, "Sa Pa", "Sa Pa"],
  [18.6796, 105.6813, "Nghe An", "Nghệ An"],
  [16.4637, 107.5909, "Hue", "Huế"],
  [12.2388, 109.1967, "Nha Trang", "Nha Trang"],
  [11.9404, 108.4583, "Da Lat", "Đà Lạt"],
  [9.7579, 105.6413, "Mekong Delta", "Đồng bằng sông Cửu Long"],
  [10.2899, 103.9840, "Phu Quoc", "Phú Quốc"],
];

const globalAnchors = [
  [40.7128, -74.006, "New York", "New York", "US"],
  [51.5074, -0.1278, "London", "Luân Đôn", "GB"],
  [48.8566, 2.3522, "Paris", "Paris", "FR"],
  [35.6762, 139.6503, "Tokyo", "Tokyo", "JP"],
  [31.2304, 121.4737, "Shanghai", "Thượng Hải", "CN"],
  [-33.8688, 151.2093, "Sydney", "Sydney", "AU"],
  [-23.5505, -46.6333, "São Paulo", "São Paulo", "BR"],
  [30.0444, 31.2357, "Cairo", "Cairo", "EG"],
  [55.7558, 37.6173, "Moscow", "Mát-xcơ-va", "RU"],
  [19.4326, -99.1332, "Mexico City", "Thành phố Mexico", "MX"],
  [28.6139, 77.209, "Delhi", "Delhi", "IN"],
  [-1.2921, 36.8219, "Nairobi", "Nairobi", "KE"],
];

const unitLabels = new Map([
  ["Q11573", "m"],
  ["Q174728", "km"],
  ["Q25343", "cm"],
  ["Q828224", "mm"],
  ["Q35852", "km²"],
  ["Q25357", "m²"],
  ["Q712226", "hectares"],
]);

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function hash(value) {
  let result = 0;
  for (const character of String(value)) result = ((result * 31) + character.charCodeAt(0)) >>> 0;
  return result;
}

function pageUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
}

function entityUrl(id) {
  return `https://www.wikidata.org/wiki/${id}`;
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function apiJson(endpoint, params) {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": userAgent },
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (response.ok) {
        await sleep(delayMs);
        return await response.json();
      }
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      await sleep(Math.min(30000, Math.max(1000 * (attempt + 1), retryAfter * 1000)));
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(1000 * (attempt + 1));
    }
  }
  throw lastError || new Error(`Request failed: ${url}`);
}

async function categoryMembers(seed, maxPages = maxCategoryPages) {
  const members = [];
  let continuation;
  for (let page = 0; page < maxPages; page += 1) {
    const body = await apiJson(pageApi, {
      action: "query",
      list: "categorymembers",
      cmtitle: seed,
      cmtype: "page|subcat",
      cmlimit: 500,
      cmprop: "ids|title|type",
      format: "json",
      formatversion: 2,
      ...(continuation ? { cmcontinue: continuation } : {}),
    });
    for (const member of body.query?.categorymembers ?? []) members.push({ ...member, sourceCategory: seed });
    continuation = body.continue?.cmcontinue;
    if (!continuation) break;
  }
  return members;
}

async function searchPages(query, maxResults = 500) {
  const results = [];
  let offset = 0;
  while (results.length < maxResults) {
    const body = await apiJson(pageApi, {
      action: "query",
      list: "search",
      srsearch: query,
      srnamespace: 0,
      srlimit: Math.min(500, maxResults - results.length),
      sroffset: offset,
      srprop: "snippet|titlesnippet",
      format: "json",
      formatversion: 2,
    });
    const batch = body.query?.search ?? [];
    results.push(...batch);
    if (!batch.length || !body.continue?.sroffset) break;
    offset = body.continue.sroffset;
  }
  return results;
}

async function discoverCategory(category) {
  if (discoveryMode === "search") {
    const pages = new Map();
    const limit = discoveryLimit || Math.max(targets[category] * 3, 900);
    // Reserve a bounded slice for Vietnam before filling the remaining
    // candidate window globally.  A single broad Vietnam search can return
    // hundreds of results, otherwise it starves the worldwide pool and the
    // final quota becomes an accidental Vietnam-only catalog.
    const vietnamQueries = searchSeeds[category].filter((query) => /vietnam/i.test(query));
    const globalQueries = searchSeeds[category].filter((query) => !/vietnam/i.test(query));
    const vietnamReserve = Math.min(Math.max(vietnamMinimums[category] * 4, 50), Math.max(0, limit - 1));
    let vietnamAdded = 0;
    const collect = async (query, vietnamHint) => {
      let results = [];
      try {
        results = await searchPages(query, Math.min(500, limit));
      } catch (error) {
        console.warn(`Skipping unavailable search ${query}: ${error.message}`);
        return;
      }
      console.log(`${category}: search ${query} returned ${results.length}`);
      for (const result of results) {
        const title = clean(result.title);
        if (!title || /^(list of|index of|outline of|glossary of)/i.test(title) || /\(disambiguation\)$/i.test(title)) continue;
        const actualVietnam = /vietnam/i.test(title) || (vietnamHint && /vietnam/i.test(result.snippet || ""));
        if (!pages.has(title)) {
          pages.set(title, { title, categoryHint: category, sourceCategory: `search:${query}`, vietnamHint: actualVietnam });
          if (actualVietnam) vietnamAdded += 1;
        } else if (actualVietnam) {
          pages.get(title).vietnamHint = true;
        }
        if (vietnamHint && vietnamAdded >= vietnamReserve) break;
        if (pages.size >= limit) break;
      }
    };
    for (const query of vietnamQueries) {
      if (vietnamAdded >= vietnamReserve) break;
      await collect(query, true);
    }
    for (const query of globalQueries) {
      if (pages.size >= limit) break;
      await collect(query, false);
    }
    return [...pages.values()];
  }
  const pages = new Map();
  const visitedCategories = new Set();
  const queue = categorySeeds[category].map((title) => ({ title, depth: 0 }));
  const limit = discoveryLimit || Math.max(targets[category] * 4, 1200);
  while (queue.length && pages.size < limit) {
    const current = queue.shift();
    if (!current || visitedCategories.has(current.title) || current.depth > categoryDepthLimit) continue;
    visitedCategories.add(current.title);
    let members;
    try {
      members = await categoryMembers(current.title);
    } catch (error) {
      console.warn(`Skipping unavailable category ${current.title}: ${error.message}`);
      continue;
    }
    for (const member of members) {
      if (member.ns === 14 || member.type === "subcat") {
        if (current.depth < categoryDepthLimit) queue.push({ title: member.title, depth: current.depth + 1 });
        continue;
      }
      if (member.ns !== 0 && member.type !== "page") continue;
      const title = clean(member.title);
      if (!title || /^(list of|index of|outline of|glossary of)/i.test(title) || /\(disambiguation\)$/i.test(title)) continue;
      const existing = pages.get(title);
      pages.set(title, { title, categoryHint: category, sourceCategory: existing?.sourceCategory || member.sourceCategory, vietnamHint: /vietnam/i.test(member.sourceCategory || "") || existing?.vietnamHint === true });
    }
  }
  return [...pages.values()];
}

async function fetchPages(titles) {
  const pages = [];
  for (let offset = 0; offset < titles.length; offset += 50) {
    const batch = titles.slice(offset, offset + 50);
    const body = await apiJson(pageApi, {
      action: "query",
      titles: batch.join("|"),
      prop: "pageprops|coordinates|extracts|langlinks|info",
      ppprop: "wikibase_item",
      coprop: "type|name|dim",
      exintro: 1,
      explaintext: 1,
      exchars: 1000,
      lllang: "vi",
      llprop: "url",
      inprop: "url",
      redirects: 1,
      format: "json",
      formatversion: 2,
    });
    pages.push(...(body.query?.pages ?? []));
    console.log(`Fetched page metadata ${Math.min(offset + batch.length, titles.length)}/${titles.length}`);
  }
  return pages;
}

async function fetchEntities(ids) {
  const entities = new Map();
  const unique = [...new Set(ids.filter(Boolean))];
  for (let offset = 0; offset < unique.length; offset += 50) {
    const batch = unique.slice(offset, offset + 50);
    const body = await apiJson(wikidataApi, {
      action: "wbgetentities",
      ids: batch.join("|"),
      props: "labels|descriptions|claims|sitelinks",
      languages: "en|vi",
      sitefilter: "enwiki|viwiki",
      format: "json",
      formatversion: 2,
    });
    for (const entity of Object.values(body.entities ?? {})) entities.set(entity.id, entity);
    console.log(`Fetched Wikidata entities ${Math.min(offset + batch.length, unique.length)}/${unique.length}`);
  }
  return entities;
}

function entityLabel(entity, language) {
  return clean(entity?.labels?.[language]?.value);
}

function entityDescription(entity, language) {
  return clean(entity?.descriptions?.[language]?.value);
}

function countryCode(entity) {
  const value = entity?.claims?.P297?.[0]?.mainsnak?.datavalue?.value;
  return typeof value === "string" && /^[A-Z]{2}$/.test(value) ? value : null;
}

function formatQuantity(entityMap, claims, property) {
  const claim = claims?.[property]?.[0];
  const value = claim?.mainsnak?.datavalue?.value;
  if (!value || typeof value.amount !== "string") return null;
  const amount = value.amount.replace(/^\+/, "");
  const unitId = String(value.unit || "").split("/").pop();
  const unit = unitLabels.get(unitId) || entityLabel(entityMap.get(unitId), "en");
  return unit ? `${amount} ${unit}` : amount;
}

function likelyMatch(category, page, entity) {
  const title = clean(page.title).toLowerCase();
  const description = entityDescription(entity, "en").toLowerCase();
  // Event pages frequently have no useful Wikidata description.  Their
  // short Wikipedia lead is still source-backed evidence for classification.
  const extract = clean(page.extract).toLowerCase();
  const evidence = `${title} ${description} ${extract}`.trim();
  if (!evidence || evidence.length < 8) return false;
  if (/^(list|index|outline) of\b/.test(title) || /\b(disambiguation|surname|family name)\b/.test(`${description} ${extract}`)) return false;
  if (category === "phenomenon" && /\b(system|level|risk|camp|photography|atlas|society|advisory|modeling|biocontainment|biosafety|detection|cinema|commission|aeromedical|carbon monoxide|act of god|missing in action|bridgewater|cielobuio|cloud top|cloudscape|cloud base|cloud height|cloud cover|travel disruption|boardwalk bridge|air basin|ash pit|aurorasaurus|air mass \(astronomy\)|anana|biorisk|beach at|administration|institute|agency|association|battle of|baku|both sides, now|abu fanous|contrail incident|arkstorm|escuminac disaster|sundsvall fire)\b/i.test(title) || /atmospheric and oceanic optics/i.test(title)) return false;
  if (category === "animal" && /\b(human|person|people|case|film|movie|album|song|ship|building|company|organization|institute|list of|species list|fictional|character|myth|deity|politician|actor|singer|football|aircraft|vehicle)\b/i.test(`${title} ${description}`)) return false;
  const patterns = {
    food: /dish|food|cuisine|meal|soup|stew|bread|noodle|rice|dessert|beverage|drink|snack|cake|dumpling|sauce|cheese|confection|meat|fish|seafood|wine|beer|tea|coffee/,
    monument: /monument|memorial|temple|palace|castle|fort|church|mosque|cathedral|shrine|archaeological|historic site|bridge|tower|tomb|pyramid|basilica|abbey|synagogue|citadel|building/,
    landmark: /mountain|river|lake|waterfall|cave|island|desert|park|canyon|glacier|bay|forest|reef|volcano|valley|beach|isthmus|wetland|geographic|landform|natural feature|tourist attraction/,
    phenomenon: /phenomenon|storm|wind|rain|cloud|optical|earthquake|volcan|flood|avalanche|drought|weather|aurora|tornado|cyclone|tsunami|hail|fog|lightning|fire|mirage|monsoon|snow|ice|dust|el ni\u00f1o/,
    animal: /animal|mammal|bird|fish|insect|reptile|amphibian|dinosaur|fossil|species|genus|wildlife|butterfly|beetle|moth|shark|whale|dolphin|turtle|snake|lizard|frog|eagle|owl|penguin|extinct/,
  };
  return patterns[category].test(evidence) || (category === "food" && /cuisine|dish|food/i.test(title));
}

function chooseCountry(page, entity, entities, category) {
  const properties = category === "food"
    ? ["P495", "P17", "P131", "P276"]
    : category === "animal"
      ? ["P183", "P17", "P131", "P276"]
      : ["P17", "P131", "P276"];
  const candidateIds = properties.flatMap((property) => claimEntityIds(entity?.claims, property));
  for (const id of candidateIds) {
    const country = entities.get(id);
    const code = countryCode(country);
    if (code) return { id, entity: country, code };
  }
  return null;
}

function chooseCoordinate(page, entity, country) {
  const pageCoordinate = page.coordinates?.[0];
  if (pageCoordinate && Number.isFinite(pageCoordinate.lat) && Number.isFinite(pageCoordinate.lon)) return { latitude: pageCoordinate.lat, longitude: pageCoordinate.lon, basis: "direct" };
  const entityCoordinate = claimCoordinate(entity?.claims);
  if (entityCoordinate) return { ...entityCoordinate, basis: "direct" };
  const countryCoordinate = claimCoordinate(country?.claims);
  if (countryCoordinate) return { ...countryCoordinate, basis: "country" };
  return null;
}

function anchorFor(category, candidate) {
  if (candidate.vietnamHint) {
    const anchor = vietnamAnchors[hash(candidate.title) % vietnamAnchors.length];
    return { latitude: anchor[0], longitude: anchor[1], placeNameEn: anchor[2], placeNameVi: anchor[3], countryCode: "VN", countryNameEn: "Vietnam", countryNameVi: "Việt Nam", basis: "representative" };
  }
  if (category !== "phenomenon") return null;
  const anchor = globalAnchors[hash(candidate.title) % globalAnchors.length];
  return { latitude: anchor[0], longitude: anchor[1], placeNameEn: anchor[2], placeNameVi: anchor[3], countryCode: anchor[4], countryNameEn: anchor[2], countryNameVi: anchor[3], basis: "representative" };
}

function pageMetadata(candidate, page, entity, entities) {
  const category = candidate.categoryHint;
  const country = chooseCountry(page, entity, entities, category);
  // Search terms are only a discovery hint.  Never overwrite a Wikidata
  // country claim (for example, a dish from Malaysia returned by a broad
  // “Vietnamese cuisine” search); use the hint only when no country claim was
  // available or when the claim already resolves to Vietnam.
  const sourceText = `${entityDescription(entity, "en")} ${page.extract || ""} ${page.title}`;
  const hasVietnamText = /\bvietnam(?:ese)?\b/i.test(sourceText);
  const forcedVietnam = candidate.vietnamHint === true
    && (!country?.code || country.code === "VN")
    && (country?.code === "VN" || hasVietnamText);
  const representative = anchorFor(category, { ...candidate, vietnamHint: forcedVietnam });
  const countryNameEn = forcedVietnam ? "Vietnam" : (entityLabel(country?.entity, "en") || representative?.countryNameEn);
  const countryNameVi = forcedVietnam ? "Việt Nam" : (entityLabel(country?.entity, "vi") || representative?.countryNameVi || countryNameEn);
  const coordinate = chooseCoordinate(page, entity, country?.entity) || representative;
  if (!coordinate || !countryNameEn || !country?.code && !forcedVietnam && category !== "phenomenon") return null;
  const fallbackAnchor = coordinate.basis === "representative" ? coordinate : null;
  const code = forcedVietnam ? "VN" : (country?.code || fallbackAnchor?.countryCode || representative?.countryCode);
  const startYear = claimYear(entity?.claims, category === "food" ? ["P571"] : ["P571", "P580"]);
  const dimensions = {
    height: formatQuantity(entities, entity?.claims, "P2048"),
    width: formatQuantity(entities, entity?.claims, "P2049"),
    area: formatQuantity(entities, entity?.claims, "P2046"),
    depth: formatQuantity(entities, entity?.claims, "P4511"),
  };
  const viLink = page.langlinks?.find((link) => link.lang === "vi");
  const entityId = entity?.id;
  return {
    titleEn: clean(page.title),
    titleVi: entityLabel(entity, "vi") || clean(viLink?.title) || clean(page.title),
    descriptionEn: entityDescription(entity, "en") || page.extract,
    descriptionVi: entityDescription(entity, "vi"),
    wikidataId: entityId,
    pageUrl: page.fullurl || pageUrl(page.title),
    viPageUrl: viLink?.url || (viLink?.title ? `https://vi.wikipedia.org/wiki/${encodeURIComponent(viLink.title.replaceAll(" ", "_"))}` : undefined),
    wikidataUrl: entityUrl(entityId),
    countryCode: code,
    countryNameEn: countryNameEn || fallbackAnchor.countryNameEn,
    countryNameVi: countryNameVi || fallbackAnchor.countryNameVi,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    coordinateBasis: coordinate.basis,
    placeNameEn: coordinate.basis === "direct" ? clean(page.title) : coordinate.placeNameEn,
    placeNameVi: coordinate.basis === "direct" ? clean(viLink?.title) || clean(page.title) : coordinate.placeNameVi,
    startYear,
    constructionDate: startYear == null ? undefined : (startYear < 0 ? `${Math.abs(startYear)} BCE` : String(startYear)),
    height: dimensions.height,
    width: dimensions.width,
    depth: dimensions.depth,
    area: dimensions.area,
    classification: category === "animal" ? (entityDescription(entity, "en") || undefined) : undefined,
    population: category === "animal" ? formatQuantity(entities, entity?.claims, "P1098") : undefined,
    endangeredStatus: category === "animal" ? entityLabel(entities.get(claimEntityIds(entity?.claims, "P141")[0]), "en") || undefined : undefined,
    accessedAt,
    sourceCategory: candidate.sourceCategory,
    uncertainties: coordinate.basis === "representative" ? [{ field: "/latitude,/longitude", note: category === "phenomenon" ? "The phenomenon is not confined to one place." : "The animal has a wider range than this point.", resolution: "A representative educational map point was selected." }] : [],
  };
}

async function loadExistingItems() {
  const items = await loadCatalogSeeds();
  try {
    items.push(...JSON.parse(await readFile(join(frontendDir, "data", "generated-catalog.json"), "utf8")));
  } catch {
    // The generated catalog is optional in a clean checkout.
  }
  return items;
}

function buildCountryPools(metadata) {
  const names = [...new Set(metadata.map((entry) => entry.countryNameEn).filter(Boolean))].sort();
  const namesVi = metadata.map((entry) => [entry.countryNameEn, entry.countryNameVi]).filter(([en]) => en);
  const viByEn = new Map(namesVi);
  return { en: names, vi: names.map((name) => viByEn.get(name) || name) };
}

async function researchCategory(category, existingKeys, existingTitles) {
  const candidates = await discoverCategory(category);
  console.log(`${category}: discovered ${candidates.length} candidate pages`);
  const pages = await fetchPages(candidates.map((candidate) => candidate.title));
  const pageByTitle = new Map(pages.map((page) => [page.title, page]));
  const entityIds = pages.map((page) => page.pageprops?.wikibase_item).filter(Boolean);
  const entities = await fetchEntities(entityIds);
  const relationIds = [];
  for (const entity of entities.values()) {
    for (const property of ["P17", "P495", "P183", "P131", "P276", "P141"]) relationIds.push(...claimEntityIds(entity.claims, property));
  }
  const related = await fetchEntities(relationIds);
  for (const [id, entity] of related) entities.set(id, entity);

  const metadata = [];
  const rejected = [];
  for (const candidate of candidates) {
    const page = pageByTitle.get(candidate.title);
    const entityId = page?.pageprops?.wikibase_item;
    const entity = entityId ? entities.get(entityId) : null;
    if (!page || !entity || !likelyMatch(category, page, entity)) {
      rejected.push({ title: candidate.title, reason: "missing Wikidata entity or category evidence" });
      continue;
    }
    const entry = pageMetadata(candidate, page, entity, entities);
    if (!entry || !entry.countryCode) {
      rejected.push({ title: candidate.title, reason: "missing country or coordinate" });
      continue;
    }
    const titleIdentity = `${category}|${normalizeTitle(entry.titleEn)}`;
    const item = buildCatalogItem(category, entry, [entry.countryNameEn], [entry.countryNameVi]);
    if (existingKeys.has(itemKey(item)) || existingTitles.has(titleIdentity)) {
      rejected.push({ title: candidate.title, reason: "identity collision with existing or earlier catalog item" });
      continue;
    }
    metadata.push(entry);
  }
  return { metadata, rejected };
}

function selectQuota(category, metadata, existingKeys, existingTitles) {
  const selected = [];
  const seenKeys = new Set(existingKeys);
  const seenTitles = new Set(existingTitles);
  const ordered = [...metadata].sort((a, b) => normalizeTitle(a.titleEn).localeCompare(normalizeTitle(b.titleEn)));
  const add = (entry) => {
    const item = buildCatalogItem(category, entry, [entry.countryNameEn], [entry.countryNameVi]);
    const key = itemKey(item);
    const titleKey = `${category}|${normalizeTitle(entry.titleEn)}`;
    if (seenKeys.has(key) || seenTitles.has(titleKey)) return false;
    seenKeys.add(key);
    seenTitles.add(titleKey);
    selected.push(entry);
    return true;
  };
  for (const entry of ordered.filter((value) => value.countryCode === "VN")) {
    if (selected.filter((value) => value.countryCode === "VN").length >= vietnamMinimums[category]) break;
    add(entry);
  }
  for (const entry of ordered) {
    if (selected.length >= targets[category]) break;
    add(entry);
  }
  const vietnamCount = selected.filter((entry) => entry.countryCode === "VN").length;
  if (selected.length < targets[category] || vietnamCount < vietnamMinimums[category]) {
    throw new Error(`${category}: only ${selected.length}/${targets[category]} selected, with ${vietnamCount}/${vietnamMinimums[category]} Vietnam items`);
  }
  return selected;
}

const existingItems = await loadExistingItems();
const existingKeys = new Set(existingItems.map(itemKey));
const existingTitles = new Set(existingItems.map((item) => `${canonicalCategory(item.category)}|${normalizeTitle(item.translations?.find((translation) => translation.lang === "en")?.title)}`));
const allItems = [];
const allProvenance = [];
const allRejected = [];
const categoryReports = {};

for (const category of Object.keys(targets)) {
  if (targets[category] <= 0) continue;
  if (process.env.CRAWL_DISCOVER_ONLY === "1") {
    const discovered = await discoverCategory(category);
    console.log(`${category}: discovered ${discovered.length} candidate pages`);
    continue;
  }
  const { metadata, rejected } = await researchCategory(category, existingKeys, existingTitles);
  const selected = selectQuota(category, metadata, existingKeys, existingTitles);
  const pool = buildCountryPools(selected);
  for (const entry of selected) {
    const item = buildCatalogItem(category, entry, pool.en, pool.vi);
    allItems.push(item);
    allProvenance.push(makeProvenance(category, entry, item));
    existingKeys.add(itemKey(item));
    existingTitles.add(`${category}|${normalizeTitle(entry.titleEn)}`);
  }
  allRejected.push(...rejected.map((value) => ({ ...value, category })));
  categoryReports[category] = {
    discovered: metadata.length + rejected.length,
    accepted: selected.length,
    vietnam: selected.filter((entry) => entry.countryCode === "VN").length,
    rejected: rejected.length,
  };
  console.log(`${category}: accepted ${selected.length}, Vietnam ${categoryReports[category].vietnam}`);
}

allItems.sort((a, b) => itemKey(a).localeCompare(itemKey(b)));
allProvenance.sort((a, b) => a.item_key.localeCompare(b.item_key));
await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, "expanded-catalog.json"), `${JSON.stringify(allItems, null, 2)}\n`);
await writeFile(join(outputDir, "expanded-catalog-provenance.json"), `${JSON.stringify(allProvenance, null, 2)}\n`);
await writeFile(join(outputDir, "expanded-catalog-rejected.json"), `${JSON.stringify(allRejected, null, 2)}\n`);
await writeFile(join(outputDir, "expanded-catalog-report.json"), `${JSON.stringify({ accessed_at: accessedAt, source: "Wikimedia MediaWiki Action API and Wikidata API", targets, vietnam_minimums: vietnamMinimums, categories: categoryReports, total: allItems.length }, null, 2)}\n`);
console.log(`Wrote ${allItems.length} expanded catalog items to ${outputDir}.`);
