import { reviewedQuizQuestions } from '../quiz-content-policy.mjs';
import { createHash } from "node:crypto";
import { quizContentValidationError } from "../quiz.js";

const UUID_NAMESPACE = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");

export interface CatalogTranslation {
  lang: string;
  title: string;
  description?: string | null;
  history?: string | null;
}

export interface CatalogMedia {
  media_type: string;
  label?: string | null;
  lang?: string | null;
  filename: string;
}

export interface CatalogQuestion {
  seed_index?: number;
  key?: string;
  lang: string;
  question: string;
  question_type: string;
  options: unknown;
  correct_answers: unknown;
  sort_order?: number;
}

export interface CatalogFlashcard {
  key: string;
  lang: string;
  front: string;
  back: string;
  sort_order?: number;
}

export interface CatalogItem {
  category: string;
  latitude: number;
  longitude: number;
  country_code?: string | null;
  icon_slug?: string | null;
  is_published?: boolean;
  recipe?: string | null;
  location_desc?: string | null;
  fun_facts?: unknown;
  audio_urls?: unknown;
  youtube_url?: string | null;
  trailer_url?: string | null;
  characters?: unknown;
  start_year?: number | null;
  end_year?: number | null;
  time_precision?: string | null;
  released_date?: string | null;
  rich_fields?: unknown;
  franchise_id?: string | null;
  translations?: CatalogTranslation[];
  media?: CatalogMedia[];
  quiz_questions?: CatalogQuestion[];
  flashcards?: CatalogFlashcard[];
  content_review?: { batch: string; approved_at: string };
}

export interface ImageOverride {
  url?: string;
}

export interface SeedStatement {
  text: string;
  values: unknown[];
}

export interface CatalogSeed {
  version: 1;
  itemIds: string[];
  statements: SeedStatement[];
}

function uuidV5(...parts: string[]): string {
  const hash = createHash("sha1").update(UUID_NAMESPACE).update(Buffer.from(parts.join("|"))).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function englishTitle(item: CatalogItem): string {
  return item.translations?.find((translation) => translation.lang === "en")?.title
    ?? item.translations?.[0]?.title
    ?? "";
}

export function catalogItemId(item: CatalogItem): string {
  return uuidV5(item.category, String(item.latitude), String(item.longitude), englishTitle(item));
}

function itemKey(item: CatalogItem): string {
  return `${item.category}|${item.latitude}|${item.longitude}|${englishTitle(item)}`;
}

function statement(text: string, values: unknown[]): SeedStatement {
  return { text, values };
}

function jsonParameter(value: unknown): string | null {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

export function catalogContentHash(item: CatalogItem): string {
  const content = {
    category: item.category,
    latitude: item.latitude,
    longitude: item.longitude,
    country_code: item.country_code ?? null,
    icon_slug: item.icon_slug ?? null,
    is_published: item.is_published ?? false,
    recipe: item.recipe ?? null,
    location_desc: item.location_desc ?? null,
    fun_facts: item.fun_facts ?? null,
    audio_urls: item.audio_urls ?? null,
    youtube_url: item.youtube_url ?? null,
    trailer_url: item.trailer_url ?? null,
    characters: item.characters ?? null,
    start_year: item.start_year ?? null,
    end_year: item.end_year ?? null,
    time_precision: item.time_precision ?? null,
    released_date: item.released_date ?? null,
    rich_fields: item.rich_fields ?? null,
    franchise_id: item.franchise_id ?? null,
    translations: item.translations ?? [],
    media: item.media ?? [],
    quiz_questions: reviewedQuizQuestions(item.quiz_questions ?? []),
    ...(item.flashcards === undefined ? {} : { flashcards: item.flashcards }),
    ...(item.content_review === undefined ? {} : { content_review: item.content_review }),
  };
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

interface GeneratedFlashcard {
  key: string;
  lang: string;
  front: string;
  back: string;
  sourceType: "catalog_description" | "catalog_history" | "catalog_quiz" | "catalog_authored";
  sortOrder?: number;
}

function boundedText(value: string, maximum: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length <= maximum ? normalized : `${normalized.slice(0, maximum - 1).trimEnd()}…`;
}

function generatedFlashcards(item: CatalogItem): GeneratedFlashcard[] {
  if (item.flashcards !== undefined) {
    const seen = new Set<string>();
    const languages = new Set(item.translations?.map(value => value.lang));
    if (!Array.isArray(item.flashcards) || item.flashcards.length === 0) throw new Error('Invalid authored flashcards: expected a nonempty array.');
    return item.flashcards.map(card => {
      if (!card || typeof card !== 'object') throw new Error('Invalid authored flashcard: expected an object.');
      const signature = `${card.lang}:${card.key}`;
      if (typeof card.key !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(card.key) || seen.has(signature)
        || !languages.has(card.lang) || typeof card.front !== 'string' || !card.front.trim() || card.front.length > 500
        || typeof card.back !== 'string' || !card.back.trim() || card.back.length > 4000
        || (card.sort_order !== undefined && (!Number.isInteger(card.sort_order) || card.sort_order < 0))) {
        throw new Error('Invalid authored flashcard: key, language, text or ordering.');
      }
      seen.add(signature);
      return { key: card.key, lang: card.lang, front: card.front.trim(), back: card.back.trim(), ...(card.sort_order === undefined ? {} : { sortOrder: card.sort_order }), sourceType: 'catalog_authored' };
    });
  }
  const questions = reviewedQuizQuestions(Array.isArray(item.quiz_questions) ? item.quiz_questions : []);
  const output: GeneratedFlashcard[] = [];
  for (const translation of item.translations ?? []) {
    const title = boundedText(translation.title, 240);
    if (translation.description?.trim()) output.push({
      key: "description",
      lang: translation.lang,
      front: boundedText(`What is ${title}?`, 500),
      back: boundedText(translation.description, 4_000),
      sourceType: "catalog_description",
    });
    if (translation.history?.trim()) output.push({
      key: "history",
      lang: translation.lang,
      front: boundedText(`What is the story of ${title}?`, 500),
      back: boundedText(translation.history, 4_000),
      sourceType: "catalog_history",
    });
    const languageQuestions = questions
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => question.lang === translation.lang)
      .sort((left, right) => (left.question.sort_order ?? 0) - (right.question.sort_order ?? 0) || left.index - right.index)
      .slice(0, 3);
    for (const { question, index } of languageQuestions) {
      const options = question.options as string[];
      const answers = question.correct_answers as number[];
      output.push({
        key: `quiz-${question.seed_index ?? index}`,
        lang: translation.lang,
        front: boundedText(question.question, 500),
        back: boundedText(answers.map((answer) => options[answer]!).join(" / "), 4_000),
        sourceType: "catalog_quiz",
      });
    }
  }
  const seen = new Set<string>();
  return output.filter((value) => {
    const signature = `${value.lang}\0${value.front.toLocaleLowerCase()}\0${value.back.toLocaleLowerCase()}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function itemStatements(item: CatalogItem, imageOverrides: Record<string, ImageOverride>): SeedStatement[] {
  const id = catalogItemId(item);
  const questions = reviewedQuizQuestions(Array.isArray(item.quiz_questions) ? item.quiz_questions : []);
  const authored = item.flashcards !== undefined;
  const questionKeys = new Set<string>();
  for (const [index, question] of questions.entries()) {
    if (authored) {
      const signature = `${question.lang}:${question.key}`;
      if (typeof question.key !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(question.key) || questionKeys.has(signature)
        || !item.translations?.some(value => value.lang === question.lang)) throw new Error('Invalid authored quiz key or language.');
      questionKeys.add(signature);
    }
    if (!Array.isArray(question.options) || !Array.isArray(question.correct_answers)) {
      throw new Error(`Catalog item has invalid quiz question at index ${index}: options and answers must be arrays.`);
    }
    const validationError = quizContentValidationError({
      question: question.question,
      questionType: question.question_type,
      options: question.options,
      correctAnswers: question.correct_answers,
    });
    if (validationError) throw new Error(`Catalog item has invalid quiz question at index ${index}: ${validationError}.`);
  }
  const cards = generatedFlashcards(item);
  const questionId = (question: CatalogQuestion, index: number) => uuidV5(id, 'quiz', authored ? question.key! : String(question.seed_index ?? index), question.lang);
  const override = imageOverrides[itemKey(item)];
  const media = override?.url
    ? [{ media_type: "image", label: englishTitle(item) || "Image", filename: override.url }]
    : (Array.isArray(item.media) ? item.media : []);
  const values = [
    id,
    item.category,
    item.latitude,
    item.longitude,
    item.country_code?.trim().toUpperCase() ?? null,
    item.icon_slug ?? null,
    item.is_published === true,
    "system",
    item.recipe ?? null,
    item.location_desc ?? null,
    jsonParameter(item.fun_facts),
    jsonParameter(item.audio_urls),
    item.youtube_url ?? null,
    item.trailer_url ?? null,
    jsonParameter(item.characters),
    item.start_year ?? null,
    item.end_year ?? null,
    item.time_precision ?? null,
    item.released_date ?? null,
    jsonParameter(item.rich_fields),
    item.franchise_id ?? null,
    questions.length > 0,
    catalogContentHash(item),
  ];
  const statements = [statement(
    `INSERT INTO items (id, category, latitude, longitude, country_code, icon_slug, is_published, source_type, recipe, location_desc, fun_facts, audio_urls, youtube_url, trailer_url, characters, start_year, end_year, time_precision, released_date, rich_fields, franchise_id, quiz_required, catalog_content_hash) VALUES (${values.map((_, index) => `$${index + 1}`).join(", ")}) ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, country_code = EXCLUDED.country_code, icon_slug = EXCLUDED.icon_slug, is_published = EXCLUDED.is_published, recipe = EXCLUDED.recipe, location_desc = EXCLUDED.location_desc, fun_facts = EXCLUDED.fun_facts, audio_urls = EXCLUDED.audio_urls, youtube_url = EXCLUDED.youtube_url, trailer_url = EXCLUDED.trailer_url, characters = EXCLUDED.characters, start_year = EXCLUDED.start_year, end_year = EXCLUDED.end_year, time_precision = EXCLUDED.time_precision, released_date = EXCLUDED.released_date, rich_fields = EXCLUDED.rich_fields, franchise_id = EXCLUDED.franchise_id, quiz_required = EXCLUDED.quiz_required, catalog_content_hash = EXCLUDED.catalog_content_hash, updated_at = CURRENT_TIMESTAMP WHERE items.source_type = 'system'`,
    values,
  )];

  for (const translation of item.translations ?? []) {
    const translationValues = [
      uuidV5(id, translation.lang),
      id,
      translation.lang,
      translation.title,
      translation.description ?? null,
      translation.history ?? null,
    ];
    statements.push(statement(
      `INSERT INTO item_translations (id, item_id, lang, title, description, history) VALUES (${translationValues.map((_, index) => `$${index + 1}`).join(", ")}) ON CONFLICT (item_id, lang) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, history = EXCLUDED.history`,
      translationValues,
    ));
  }

  for (const [index, value] of media.entries()) {
    const mediaValues = [uuidV5(id, "media", String(index)), id, value.media_type, value.label ?? null, value.lang ?? null, value.filename, index];
    statements.push(statement(
      `INSERT INTO item_media (id, item_id, media_type, label, lang, filename, sort_order) VALUES (${mediaValues.map((_, valueIndex) => `$${valueIndex + 1}`).join(", ")}) ON CONFLICT (id) DO UPDATE SET media_type = EXCLUDED.media_type, label = EXCLUDED.label, lang = EXCLUDED.lang, filename = EXCLUDED.filename, sort_order = EXCLUDED.sort_order`,
      mediaValues,
    ));
  }

  if (authored) {
    // Retire obsolete definitions; retain IDs and rows referenced by historical study data.
    statements.push(statement(
      `UPDATE flashcards SET is_published = false, updated_at = CURRENT_TIMESTAMP WHERE item_id = $1 AND is_published = true AND source_type IN ('catalog_description', 'catalog_history', 'catalog_quiz', 'catalog_authored') AND id <> ALL($2::text[])`,
      [id, cards.map(card => uuidV5(id, 'flashcard', card.lang, card.key))],
    ));
    statements.push(statement(
      `UPDATE quiz_questions SET is_active = false WHERE item_id = $1 AND is_active = true AND id <> ALL($2::text[])`,
      [id, questions.map(questionId)],
    ));
  }

  for (const [index, flashcard] of cards.entries()) {
    const flashcardValues = [
      uuidV5(id, "flashcard", flashcard.lang, flashcard.key),
      id,
      flashcard.lang,
      flashcard.front,
      flashcard.back,
      null,
      flashcard.sortOrder ?? index,
      true,
      flashcard.sourceType,
    ];
    statements.push(statement(
      `INSERT INTO flashcards (id, item_id, lang, front, back, media_hint, sort_order, is_published, source_type) VALUES (${flashcardValues.map((_, valueIndex) => `$${valueIndex + 1}`).join(", ")}) ON CONFLICT (id) DO UPDATE SET lang = EXCLUDED.lang, front = EXCLUDED.front, back = EXCLUDED.back, media_hint = EXCLUDED.media_hint, sort_order = EXCLUDED.sort_order, is_published = EXCLUDED.is_published, source_type = EXCLUDED.source_type, updated_at = CURRENT_TIMESTAMP`,
      flashcardValues,
    ));
  }

  for (const [index, question] of questions.entries()) {
    const questionValues = [
      questionId(question, index),
      id,
      question.lang,
      question.question,
      question.question_type,
      jsonParameter(question.options),
      jsonParameter(question.correct_answers),
      question.sort_order ?? 0,
      true,
      ...(authored ? [uuidV5(id, 'quiz-group', question.key!)] : []),
    ];
    statements.push(statement(
      `INSERT INTO quiz_questions (id, item_id, lang, question, question_type, options, correct_answers, sort_order, is_active${authored ? ', question_group_id' : ''}) VALUES (${questionValues.map((_, valueIndex) => `$${valueIndex + 1}`).join(", ")}) ON CONFLICT (id) DO UPDATE SET lang = EXCLUDED.lang, question = EXCLUDED.question, question_type = EXCLUDED.question_type, options = EXCLUDED.options, correct_answers = EXCLUDED.correct_answers, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active${authored ? ', question_group_id = EXCLUDED.question_group_id' : ''}`,
      questionValues,
    ));
  }

  if (!authored) return statements;
  return statements.map(value => ({ ...value, text: value.text.startsWith('UPDATE ')
    ? `${value.text} AND EXISTS (SELECT 1 FROM items WHERE id = $1 AND source_type = 'system')`
    : value.text.startsWith('INSERT INTO items') ? value.text
    : value.text.replace(/ VALUES \(([^)]+)\)/, (_match, placeholders: string) => ` SELECT ${placeholders} WHERE EXISTS (SELECT 1 FROM items WHERE id = $2 AND source_type = 'system')`) }));
}

export function buildCatalogSeed(items: CatalogItem[], imageOverrides: Record<string, ImageOverride>): CatalogSeed {
  const uniqueItems = new Map<string, CatalogItem>();
  for (const item of items) uniqueItems.set(catalogItemId(item), item);
  const orderedItems = [...uniqueItems.values()].sort((left, right) => catalogItemId(left).localeCompare(catalogItemId(right)));
  return {
    version: 1,
    itemIds: orderedItems.map(catalogItemId),
    statements: orderedItems.flatMap((item) => itemStatements(item, imageOverrides)),
  };
}
