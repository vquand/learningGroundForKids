import { reviewedQuizQuestions } from '../../server/src/quiz-content-policy.mjs';
const CATEGORY_TERMS = {
  food: /\b(dish|food|cuisine|meal|soup|stew|bread|noodle|rice|dessert|beverage|drink|snack|cake|dumpling|sauce|cheese|confection|recipe|ingredient)\b/i,
  monument: /\b(monument|memorial|temple|palace|castle|fort|church|mosque|cathedral|shrine|archaeological|historic site|bridge|tower|tomb|pyramid|basilica|abbey|synagogue|citadel)\b/i,
  landmark: /\b(mountain|river|lake|waterfall|cave|island|desert|park|canyon|glacier|bay|forest|reef|volcano|valley|beach|isthmus|wetland|landform|natural feature|tourist attraction)\b/i,
  phenomenon: /\b(phenomenon|storm|wind|rain|cloud|optical|earthquake|volcan|flood|avalanche|drought|weather|aurora|tornado|cyclone|tsunami|hail|fog|lightning|fire|mirage|monsoon|snow|ice|dust|el ni[ñn]o)\b/i,
  animal: /\b(animal|mammal|bird|fish|insect|reptile|amphibian|dinosaur|fossil|species|genus|wildlife|butterfly|beetle|moth|shark|whale|dolphin|turtle|snake|lizard|frog|eagle|owl|penguin|extinct)\b/i,
  music: /\b(song|music|musical|singer|composer|band|album|orchestra|symphony|concert|aria|waltz|lullaby|rhyme)\b/i,
  movie: /\b(film|movie|animated film|motion picture|cinema|director|actor|screenplay)\b/i,
};

const PLACEHOLDER_TERMS = [
  /this map item/i,
  /reference data (documents|places)/i,
  /is associated with .*\(representative/i,
  /(?:is|are) (?:an? |the )?(?:animal|dish|food|song|movie|film|landmark|monument|phenomenon) associated with the recorded location/i,
  /(?:is|are) (?:an? |the )?(?:animal|dish|food|song|movie|film|landmark|monument|phenomenon) associated with (?:the )?(?:recorded location|[^.!?]+)\. (?:Its|Its recorded|The) recorded/i,
  /it is catalogued as/i,
  /recorded (?:location|classification) (?:gives|provides|identifies)/i,
  /provide(?:s)? context for learning about it/i,
  /identifies the place represented in this learning catalog/i,
  /recorded learning entry/i,
  /explore its place in the long story/i,
  /the map point is representative/i,
  /no reliable reference summary/i,
  /this is one of the gentlest and most soothing songs ever written/i,
  /reference catalog/i,
  /reference databases/i,
  /linked references/i,
  /representative reference point/i,
  /catalog point represents/i,
  /recipes vary by region/i,
  /documented as .* linked reference sources/i,
  /nội dung này gắn với/i,
  /(?:là|là một) (?:động vật|món ăn|bài hát|bộ phim|địa danh|di tích|hiện tượng tự nhiên) gắn với địa điểm được ghi nhận/i,
  /vị trí và phân loại được ghi nhận/i,
  /các nguồn tham khảo/i,
];

const GENERIC_DESCRIPTION = /^(?:a|an|the)?\s*(?:[\p{L}\d'’-]+\s+){0,4}(?:dish|food|noodle dish|song|movie|film|animal|landmark|monument|phenomenon)\.?$/iu;

const QUIZ_CATEGORY_OPTIONS = {
  en: {
    animal: ["animal", "food", "landmark", "historic monument"],
    food: ["food", "animal", "landmark", "historic monument"],
    landmark: ["landmark", "food", "animal", "historic monument"],
    monument: ["historic monument", "landmark", "food", "animal"],
    phenomenon: ["natural phenomenon", "animal", "food", "landmark"],
    music: ["music", "movie", "food", "animal"],
    movie: ["movie", "music", "food", "animal"],
  },
  vi: {
    animal: ["động vật", "món ăn", "địa danh", "di tích lịch sử"],
    food: ["món ăn", "động vật", "địa danh", "di tích lịch sử"],
    landmark: ["địa danh", "món ăn", "động vật", "di tích lịch sử"],
    monument: ["di tích lịch sử", "địa danh", "món ăn", "động vật"],
    phenomenon: ["hiện tượng tự nhiên", "động vật", "món ăn", "địa danh"],
    music: ["âm nhạc", "phim", "món ăn", "động vật"],
    movie: ["phim", "âm nhạc", "món ăn", "động vật"],
  },
};

function cleanText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(value) {
  const normalized = cleanText(value);
  return normalized ? normalized.split(/\s+/u).length : 0;
}

const VIETNAMESE_WORDS = /(?<!\p{L})(?:là|một|và|của|trong|được|với|từ|cho|các|này|nơi|khi|trên|đến|bằng|những|hoặc|gồm|có|đã|tại|người|loài|món|nước|khu|vùng|thành|phố)(?!\p{L})/iu;
const ENGLISH_LIKE_WORDS = /\b(?:the|is|are|a|an|and|of|from|with|in|on|to|for|this|that|its|it|was|were|has|have|as|by|into|one|known|called|dish|food|cuisine|soup|hotpot|style|blood|tripe|region|country|city|river|mountain|species|genus|film|song|music|located|born|died|during|between|often|usually|including|consists|served|made|used|history|historical|recorded|associated|landmark|monument|natural|phenomenon|animal|mammal|bird|plant|tree|island|lake|park|temple|palace|castle|church|bridge|hill|valley|world|earth|people|government|language|name|title|meaning)\b/iu;

export function isLikelyVietnamese(value) {
  const normalized = cleanText(value);
  if (!normalized) return false;
  const diacriticCount = (normalized.match(/[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/giu) || []).length;
  const wordMatches = normalized.match(new RegExp(VIETNAMESE_WORDS.source, "giu")) || [];
  const englishMatches = normalized.match(new RegExp(ENGLISH_LIKE_WORDS.source, "giu")) || [];
  if (wordMatches.length === 0 && englishMatches.length >= 2) return false;
  return diacriticCount >= 2 || wordMatches.length >= 2;
}

export function isQualityDescription(value, { language = "en" } = {}) {
  const normalized = cleanText(value);
  if (isInsufficientContent(normalized) || countWords(normalized) < 8) return false;
  return language !== "vi" || isLikelyVietnamese(normalized);
}

export function truncateWords(value, maximum = 150) {
  const normalized = cleanText(value);
  const words = normalized ? normalized.split(/\s+/u) : [];
  if (words.length <= maximum) return normalized;
  return words.slice(0, maximum).join(" ");
}

export function isPlaceholderText(value) {
  const normalized = cleanText(value);
  return !normalized || PLACEHOLDER_TERMS.some((pattern) => pattern.test(normalized));
}

export function isInsufficientContent(value) {
  const normalized = cleanText(value);
  return isPlaceholderText(normalized) || GENERIC_DESCRIPTION.test(normalized);
}

export function normalizeCatalogItem(item) {
  const questions = Array.isArray(item.quiz_questions)
    ? reviewedQuizQuestions(item.quiz_questions).map((question) => {
      const normalizedQuestion = { ...question };
      const options = Array.isArray(normalizedQuestion.options)
        ? normalizedQuestion.options.map((option) => /^option\s+\d+$/iu.test(option) ? null : option)
        : normalizedQuestion.options;
      if (!Array.isArray(options) || !options.some((option) => option === null)) return normalizedQuestion;
      const labels = QUIZ_CATEGORY_OPTIONS[normalizedQuestion.lang === "vi" ? "vi" : "en"][item.category] || [];
      const replacement = labels.find((label) => !options.includes(label))
        || (normalizedQuestion.lang === "vi" ? "một nội dung khác" : "another learning item");
      return { ...normalizedQuestion, options: options.map((option) => option ?? replacement) };
    })
    : item.quiz_questions;
  return questions === item.quiz_questions ? item : { ...item, quiz_questions: questions };
}

export function classifyCatalogCategory(value) {
  const text = cleanText(value);
  const matches = Object.entries(CATEGORY_TERMS)
    .map(([category, pattern]) => ({ category, score: text.match(pattern)?.length ?? 0 }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);
  return matches[0]?.category ?? null;
}

function existingTranslation(item, lang) {
  return item.translations?.find((translation) => translation.lang === lang) ?? { lang, title: "" };
}

function reviewedText(sourceText, fallback, { language = "en", minimumWords = 8, alternative = "" } = {}) {
  const isUsable = (value) => {
    const normalized = cleanText(value);
    return Boolean(normalized)
      && !isInsufficientContent(normalized)
      && countWords(normalized) >= minimumWords
      && (language !== "vi" || isLikelyVietnamese(normalized));
  };
  const source = cleanText(sourceText);
  if (isUsable(source)) return truncateWords(source);
  const current = cleanText(fallback);
  if (isUsable(current)) return truncateWords(current);
  const alternate = cleanText(alternative);
  if (isUsable(alternate)) return truncateWords(alternate);
  return language === "vi" ? "" : "No reliable reference summary was available during this content review.";
}

export function buildReviewedItem(item, source) {
  // A human-approved lesson and its retrieval practice are one authored unit.
  if (item.content_review?.approved_at && Array.isArray(item.flashcards)) return item;
  const en = existingTranslation(item, "en");
  const vi = existingTranslation(item, "vi");
  const richFields = item.rich_fields && typeof item.rich_fields === "object" ? { ...item.rich_fields } : {};
  // Never fall back to English for Vietnamese fields. A missing translation is
  // a data-quality problem that must remain visible to the review pipeline;
  // copying English here makes the bilingual catalog look complete while
  // producing the exact defect the refresh job is meant to remove.
  const reviewed = {
    ...normalizeCatalogItem(item),
    translations: [
      {
        ...en,
        title: en.title || source.titleEn,
        description: reviewedText(source.descriptionEn, en.description),
        history: reviewedText(source.historyEn, en.history, { alternative: source.descriptionEn }),
      },
      {
        ...vi,
        title: vi.title || source.titleVi || source.titleEn || en.title,
        description: reviewedText(source.descriptionVi, vi.description, { language: "vi" }),
        history: reviewedText(source.historyVi, vi.history, { language: "vi", alternative: source.descriptionVi }),
      },
    ],
    rich_fields: {
      ...richFields,
      ...(source.sources?.length ? { sources: source.sources } : {}),
    },
  };

  if (source.category === "food" && source.ingredients?.length) {
    reviewed.rich_fields.ingredients = source.ingredients.slice(0, 12).map((name) => ({
      name: cleanText(name),
      quantity: "varies by regional recipe",
    }));
  }
  if (source.category === "music") {
    reviewed.rich_fields = {
      ...reviewed.rich_fields,
      ...(source.composer ? { composer: source.composer } : {}),
      ...(source.vocalists?.length ? { vocalists: source.vocalists } : {}),
      ...(source.releaseYear ? { release_year: source.releaseYear } : {}),
    };
    if (source.youtubeUrl) reviewed.youtube_url = source.youtubeUrl;
  }
  if (source.funFacts?.length) reviewed.fun_facts = source.funFacts.slice(0, 3).map((fact) => truncateWords(fact, 40));
  if (source.locationDescription && ["animal", "landmark", "monument"].includes(source.category)) {
    reviewed.location_desc = truncateWords(source.locationDescription, 80);
  }
  return reviewed;
}
