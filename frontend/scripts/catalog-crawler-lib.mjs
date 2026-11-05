export const CATEGORIES = ["food", "monument", "landmark", "phenomenon", "animal"];

export const CATEGORY_LABELS = {
  food: { en: "food", vi: "món ăn" },
  monument: { en: "historic monument", vi: "di tích lịch sử" },
  landmark: { en: "natural or sightseeing landmark", vi: "địa danh tự nhiên hoặc điểm tham quan" },
  phenomenon: { en: "natural phenomenon", vi: "hiện tượng tự nhiên" },
  animal: { en: "animal", vi: "động vật" },
};

export function canonicalCategory(value) {
  const normalized = String(value ?? "").trim().toLowerCase().replaceAll("_", " ");
  if (["sightseeing", "sight seeing", "sight-seeing", "sight"].includes(normalized)) return "landmark";
  return CATEGORIES.includes(normalized) ? normalized : null;
}

export function normalizeTitle(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function itemKey(item) {
  const english = item.translations?.find((translation) => translation.lang === "en")?.title ?? item.title_en ?? "";
  return `${item.category}|${String(item.latitude)}|${String(item.longitude)}|${english}`;
}

export function extractEntityId(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/Q\d+$/i);
  return match ? match[0].toUpperCase() : null;
}

export function claimEntityIds(claims, property) {
  return (claims?.[property] ?? [])
    .map((claim) => claim?.mainsnak?.datavalue?.value?.id)
    .map(extractEntityId)
    .filter(Boolean);
}

export function claimCoordinate(claims, property = "P625") {
  const value = claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
  if (!value || typeof value.latitude !== "number" || typeof value.longitude !== "number") return null;
  if (value.latitude < -90 || value.latitude > 90 || value.longitude < -180 || value.longitude > 180) return null;
  return { latitude: value.latitude, longitude: value.longitude };
}

export function claimQuantity(claims, property) {
  const value = claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
  if (!value) return null;
  if (typeof value.amount === "string") {
    const amount = value.amount.replace(/^\+/, "");
    const unit = extractEntityId(value.unit);
    return unit ? `${amount} (${unit})` : amount;
  }
  return null;
}

export function claimYear(claims, properties = ["P571", "P577", "P580"]) {
  for (const property of properties) {
    const raw = claims?.[property]?.[0]?.mainsnak?.datavalue?.value?.time;
    if (typeof raw !== "string") continue;
    const match = raw.match(/^([+-]\d+)/);
    if (!match) continue;
    const year = Number(match[1]);
    if (Number.isInteger(year)) return year;
  }
  return null;
}

export function timePrecision(year) {
  if (year == null) return null;
  const absolute = Math.abs(year);
  // Wikidata's signed time values use negative years for BCE.  A modern CE
  // year such as 2021 is not “2 kya”; only negative deep-time values use the
  // kya/mya display buckets.
  if (year < 0 && absolute >= 1_000_000) return "mya";
  if (year < 0 && absolute >= 1_000) return "kya";
  if (absolute % 100 === 0) return "century";
  if (absolute % 10 === 0) return "decade";
  return "year";
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function trimSentence(value, fallback) {
  const text = cleanText(value);
  if (!text) return fallback;
  const sentence = text.split(/(?<=[.!?])\s+/)[0]?.trim() ?? text;
  return sentence.length > 320 ? `${sentence.slice(0, 317)}...` : sentence;
}

/** Metadata and map placement alone do not justify an authored quiz. */
export function buildQuizQuestions() {
  return [];
}

function coordinateDescription(metadata) {
  if (metadata.coordinateBasis === "direct") return metadata.placeNameEn || metadata.countryNameEn;
  if (metadata.coordinateBasis === "country") return `${metadata.countryNameEn} (representative origin point)`;
  return `${metadata.placeNameEn || metadata.countryNameEn} (representative learning point)`;
}

function categoryRichFields(category, metadata) {
  if (category === "food" && metadata.ingredients?.length >= 2) {
    return {
      ingredients: metadata.ingredients.slice(0, 12).map((name) => ({ name, quantity: "varies by regional recipe" })),
      recipe_steps: [
        "With adult help, prepare the ingredients using a trusted regional recipe.",
        "Cook and serve according to the cited culinary source; methods vary by household and region.",
      ],
    };
  }
  if (category === "monument" && metadata.constructionDate && (metadata.height || metadata.width || metadata.area)) {
    return {
      ...(metadata.constructionDate ? { construction_date: metadata.constructionDate } : {}),
      dimensions: Object.fromEntries(Object.entries({ height: metadata.height, width: metadata.width, area: metadata.area }).filter(([, value]) => value)),
    };
  }
  if (category === "landmark" && (metadata.height || metadata.width || metadata.depth || metadata.area)) {
    return {
      key_stats: Object.fromEntries(Object.entries({ height: metadata.height, width: metadata.width, depth: metadata.depth, area: metadata.area }).filter(([, value]) => value)),
    };
  }
  if (category === "animal" && (metadata.classification || metadata.population || metadata.endangeredStatus)) {
    return Object.fromEntries(Object.entries({
      classification: metadata.classification,
      population: metadata.population,
      endangered_status: metadata.endangeredStatus,
    }).filter(([, value]) => value));
  }
  if (category === "phenomenon" && metadata.metric) return { kid_metrics: { [metadata.metric.key]: metadata.metric.value } };
  return undefined;
}

export function buildCatalogItem(category, metadata, countryPoolEn, countryPoolVi) {
  const titleEn = cleanText(metadata.titleEn);
  const titleVi = cleanText(metadata.titleVi) || titleEn;
  const label = CATEGORY_LABELS[category];
  const placeEn = coordinateDescription(metadata);
  const placeVi = metadata.placeNameVi || metadata.countryNameVi || metadata.countryNameEn;
  const sourceDescription = trimSentence(metadata.descriptionEn, `${titleEn} is a ${label.en}.`);
  const sourceDescriptionVi = trimSentence(metadata.descriptionVi, `${titleVi} là ${label.vi}.`);
  const descriptionEn = `${sourceDescription} It is associated with ${placeEn}. Its recorded location gives the topic a clear geographic context.`;
  const descriptionVi = `${sourceDescriptionVi} Nội dung này gắn với ${placeVi}. Vị trí được ghi nhận giúp người học hiểu rõ bối cảnh địa lý của chủ đề.`;
  const historyEn = metadata.startYear != null
    ? `The record of ${titleEn} begins around ${metadata.startYear < 0 ? `${Math.abs(metadata.startYear)} BCE` : metadata.startYear}. Its recorded location is ${placeEn}, while the topic may also have a wider geographic or historical context.`
    : `${titleEn} is a ${label.en} associated with ${placeEn}. Its story may extend beyond the recorded point through wider geographic or historical context.`;
  const historyVi = metadata.startYear != null
    ? `Hồ sơ của ${titleVi} bắt đầu vào khoảng ${metadata.startYear < 0 ? `${Math.abs(metadata.startYear)} trước Công nguyên` : metadata.startYear}. Vị trí được ghi nhận là ${placeVi}, còn chủ đề có thể có bối cảnh địa lý hoặc lịch sử rộng hơn.`
    : `${titleVi} là ${label.vi} gắn với ${placeVi}. Câu chuyện của chủ đề có thể rộng hơn về địa lý hoặc lịch sử so với điểm được ghi nhận.`;
  const item = {
    category,
    latitude: metadata.latitude,
    longitude: metadata.longitude,
    country_code: metadata.countryCode,
    icon_slug: category,
    is_published: true,
    ...(category === "food" ? {
      recipe: `With adult help, use a trusted regional recipe for ${titleEn}. Ingredients and methods can vary between families and places; never assume this guidance covers allergies or food safety.`,
    } : {}),
    ...(category === "monument" || category === "landmark" || category === "animal" ? { location_desc: `${titleEn} is associated with ${placeEn}.` } : {}),
    fun_facts: [
      `${titleEn} is associated with ${placeEn}.`,
      `It is described as a ${label.en}.`,
      `Its recorded location gives the topic a geographic context.`,
    ],
    media: [{ media_type: "image", label: titleEn, filename: `placeholder-${category}.jpg` }],
    translations: [
      { lang: "en", title: titleEn, description: descriptionEn, history: historyEn },
      { lang: "vi", title: titleVi, description: descriptionVi, history: historyVi },
    ],
    ...(metadata.startYear != null ? { start_year: metadata.startYear, time_precision: timePrecision(metadata.startYear) } : {}),
    ...(metadata.endYear != null ? { end_year: metadata.endYear } : {}),
    ...(categoryRichFields(category, metadata) ? { rich_fields: categoryRichFields(category, metadata) } : {}),
    quiz_questions: buildQuizQuestions({
      category,
      titleEn,
      titleVi,
      countryNameEn: metadata.countryNameEn,
      countryNameVi: metadata.countryNameVi || metadata.countryNameEn,
      countryPoolEn,
      countryPoolVi,
    }),
  };
  return item;
}

export function makeProvenance(category, metadata, item) {
  const key = itemKey(item);
  const sources = [
    {
      url: metadata.pageUrl,
      publisher: "English Wikipedia",
      source_type: "reference",
      accessed_at: metadata.accessedAt,
      supports: ["/translations/0/title", "/translations/0/description", "/translations/0/history"],
    },
    {
      url: metadata.wikidataUrl,
      publisher: "Wikidata",
      source_type: "reference",
      accessed_at: metadata.accessedAt,
      supports: ["/category", "/latitude", "/longitude", "/country_code", "/start_year"],
    },
  ];
  if (metadata.viPageUrl) {
    sources.push({
      url: metadata.viPageUrl,
      publisher: "Vietnamese Wikipedia",
      source_type: "reference",
      accessed_at: metadata.accessedAt,
      supports: ["/translations/1/title", "/translations/1/description", "/translations/1/history"],
    });
  }
  return {
    item_key: key,
    category,
    title_en: item.translations[0].title,
    wikidata_id: metadata.wikidataId,
    coordinate_basis: metadata.coordinateBasis,
    researched_at: metadata.accessedAt,
    status: "ready_for_human_review",
    sources,
    uncertainties: metadata.uncertainties ?? [],
  };
}
