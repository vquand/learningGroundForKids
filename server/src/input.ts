import { z, type ZodType } from "zod";
import { AppError } from "./errors.js";
import { requireLegalVersion } from "./legal.js";
import {
  MAX_QUIZ_ANSWER_INDICES,
  MAX_QUIZ_OPTIONS,
  MAX_QUIZ_OPTION_LENGTH,
  MAX_QUIZ_QUESTION_LENGTH,
  MAX_QUIZ_QUESTIONS,
  quizContentValidationError,
} from "./quiz.js";

export const emailSchema = z.string().trim().toLowerCase().email().max(320);
export const idSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._~-]+$/);

export const loginSchema = z.object({
  email: z.union([emailSchema, z.string().trim().toLowerCase().pipe(z.literal("root"))]),
  password: z.string().min(1).max(256),
}).strict();

export const rootPasswordSchema = z.object({
  newPassword: z.string().min(12).max(256),
  confirmPassword: z.string().min(12).max(256),
  fallbackPassword: z.string().min(1).max(256),
}).strict().refine((value) => value.newPassword === value.confirmPassword, "Passwords must match.");

export const adminFamilyPasswordSchema = z.object({
  new_password: z.string().min(12).max(256),
  reason: z.string().trim().min(3).max(500),
}).strict();

export const adminRegisterSchema = z.object({
  email: emailSchema,
  password: z.string().min(12).max(256),
  name: z.string().trim().min(1).max(80),
}).strict();

export const registerSchema = adminRegisterSchema.extend({
  legalVersion: z.unknown().transform(requireLegalVersion),
}).strict();

const avatarFrameIdSchema = z.enum([
  "tet", "christmas", "flowers", "love", "explorer", "tank", "submarine", "space", "ufo", "car", "plane", "jet", "volcano", "helicopter",
]);

export const profileCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  emoji: z.string().trim().min(1).max(16),
  color: z.string().trim().min(1).max(32),
  avatar_type: z.enum(["emoji", "default"]).optional(),
  avatar_url: z.string().trim().regex(/^[a-z0-9-]{1,32}$/).optional(),
  avatar_frame: avatarFrameIdSchema.nullable().optional(),
  native_country_code: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()).optional(),
  native_city: z.string().trim().max(120).optional(),
}).strict();

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  emoji: z.string().trim().min(1).max(16).optional(),
  color: z.string().trim().min(1).max(32).optional(),
  avatar_type: z.enum(["emoji", "default"]).optional(),
  avatar_url: z.union([z.string().trim().regex(/^[a-z0-9-]{1,32}$/), z.null()]).optional(),
  avatar_frame: avatarFrameIdSchema.nullable().optional(),
  native_country_code: z.union([
    z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()),
    z.null(),
  ]).optional(),
  native_city: z.union([z.string().trim().max(120), z.null()]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one profile field is required");

export const categorySchema = z.enum(["food", "monument", "landmark", "music", "movie", "phenomenon", "animal"]);

const pageSchema = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(1_000_000));
const pageSizeSchema = (maximum: number) => z.string().regex(/^[1-9]\d*$/)
  .transform(Number).pipe(z.number().int().max(maximum));
export const adminActivityQuerySchema = z.object({
  page: pageSchema.default(1),
  page_size: pageSizeSchema(100).default(20),
  type: z.enum(["all", "completion", "quiz", "flashcard"]).default("all"),
}).strict();
export const adminProfileQuerySchema = z.object({}).strict();
export const adminJourneyQuerySchema = z.object({
  page: pageSchema.default(1),
  page_size: pageSizeSchema(500).default(100),
  period: z.enum(["today", "yesterday", "last3days", "last7days", "all"]).default("last7days"),
}).strict();

export function parseAdminQuery<T>(url: string, schema: ZodType<T>): T {
  const params = new URL(url).searchParams;
  const values: Record<string, string> = Object.create(null);
  for (const [key, value] of params) {
    if (Object.prototype.hasOwnProperty.call(values, key)) throw new AppError(422, "VALIDATION_ERROR", "Duplicate query parameters are not allowed.");
    values[key] = value;
  }
  const parsed = schema.safeParse(values);
  if (!parsed.success) throw new AppError(422, "VALIDATION_ERROR", "Invalid report query.");
  return parsed.data;
}

export const parentSystemDisabledSchema = z.object({
  item_ids: z.array(idSchema).max(500),
  disabled: z.boolean(),
}).strict();

export const languageSchema = z.string().trim().toLowerCase().regex(/^[a-z]{2,8}$/);

const optionalNullableText = (maximum: number) => z.union([
  z.string().trim().max(maximum),
  z.null(),
]).optional();

const httpsUrlSchema = z.string().trim().max(2048).url().refine(
  (value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  },
  "Only HTTPS URLs are accepted",
);

const catalogMediaFilenameSchema = z.string().trim().min(1).max(512).refine((value) => {
  if (/^https:\/\//i.test(value)) {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }
  if (value.startsWith("/") || value.includes("\\") || value.includes("\u0000")) return false;
  return !value.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}, "Media filename must be an HTTPS URL or a safe object key");

const catalogTranslationSchema = z.object({
  lang: languageSchema,
  title: z.string().trim().min(1).max(240),
  description: optionalNullableText(4_000),
  history: optionalNullableText(8_000),
}).strict();

const catalogMediaSchema = z.object({
  media_type: z.string().trim().min(1).max(64),
  label: optionalNullableText(240),
  lang: z.union([languageSchema, z.null()]).optional(),
  filename: catalogMediaFilenameSchema,
  sort_order: z.number().int().min(0).max(10_000).optional().default(0),
}).strict();

const catalogQuizQuestionSchema = z.object({
  question_group_id: idSchema.nullable().optional(),
  lang: languageSchema,
  question: z.string().trim().min(1).max(MAX_QUIZ_QUESTION_LENGTH),
  question_type: z.enum(["yes_no", "single", "abc", "abcd", "multi"]),
  options: z.array(z.string().trim().min(1).max(MAX_QUIZ_OPTION_LENGTH)).min(1).max(MAX_QUIZ_OPTIONS),
  correct_answers: z.array(z.number().int().min(0).max(MAX_QUIZ_ANSWER_INDICES - 1)).min(1).max(MAX_QUIZ_ANSWER_INDICES),
  sort_order: z.number().int().min(0).max(10_000).optional().default(0),
  // Catalog generators may use this to group equivalent questions. It is not
  // persisted because quiz ordering is the server-owned contract.
  group: z.number().int().min(0).max(10_000).optional(),
}).strict().superRefine((value, context) => {
  const validationError = quizContentValidationError({
    question: value.question,
    questionType: value.question_type,
    options: value.options,
    correctAnswers: value.correct_answers,
  });
  if (validationError) context.addIssue({ code: "custom", message: validationError, path: ["correct_answers"] });
});

export const catalogItemCreateSchema = z.object({
  id: idSchema.optional(),
  category: categorySchema,
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  country_code: z.union([
    z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()),
    z.null(),
  ]).optional(),
  icon_slug: idSchema.optional().nullable(),
  is_published: z.boolean().optional().default(false),
  recipe: optionalNullableText(8_000),
  location_desc: optionalNullableText(4_000),
  fun_facts: z.unknown().optional(),
  audio_urls: z.unknown().optional(),
  youtube_url: z.union([httpsUrlSchema, z.null()]).optional(),
  trailer_url: z.union([httpsUrlSchema, z.null()]).optional(),
  characters: z.unknown().optional(),
  start_year: z.number().int().min(-2_000_000_000).max(3_000_000_000).nullable().optional(),
  end_year: z.number().int().min(-2_000_000_000).max(3_000_000_000).nullable().optional(),
  time_precision: optionalNullableText(32),
  released_date: optionalNullableText(64),
  rich_fields: z.record(z.string(), z.unknown()).optional(),
  franchise_id: z.union([idSchema, z.null()]).optional(),
  quiz_required: z.boolean().optional(),
  translations: z.array(catalogTranslationSchema).min(1).max(32),
  media: z.array(catalogMediaSchema).max(64).optional().default([]),
  quiz_questions: z.array(catalogQuizQuestionSchema).max(MAX_QUIZ_QUESTIONS).optional().default([]),
}).strict().superRefine((value, context) => {
  const languages = value.translations.map((translation) => translation.lang);
  if (new Set(languages).size !== languages.length) {
    context.addIssue({ code: "custom", path: ["translations"], message: "Translation languages must be unique" });
  }
}).transform((value) => ({
  ...value,
  quiz_required: value.quiz_required ?? value.quiz_questions.length > 0,
}));

export const parentLessonCreateSchema = z.object({
  item: catalogItemCreateSchema,
  target_scope: z.enum(["family", "profile"]),
  target_profile_id: idSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.target_scope === "profile" && !value.target_profile_id) {
    context.addIssue({ code: "custom", path: ["target_profile_id"], message: "A target profile is required" });
  }
  if (value.target_scope === "family" && value.target_profile_id !== undefined) {
    context.addIssue({ code: "custom", path: ["target_profile_id"], message: "Family lessons cannot specify a profile" });
  }
  if (value.item.id !== undefined) {
    context.addIssue({ code: "custom", path: ["item", "id"], message: "The server assigns lesson IDs" });
  }
});

export const parentLessonShareSchema = z.object({
  target_scope: z.enum(["family", "profile"]),
  target_family_id: idSchema,
  target_profile_id: idSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.target_scope === "profile" && !value.target_profile_id) {
    context.addIssue({ code: "custom", path: ["target_profile_id"], message: "A target profile is required" });
  }
  if (value.target_scope === "family" && value.target_profile_id !== undefined) {
    context.addIssue({ code: "custom", path: ["target_profile_id"], message: "Family shares cannot specify a profile" });
  }
});

export const catalogItemUpdateSchema = z.object({
  id: idSchema,
  category: categorySchema.optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  country_code: z.union([
    z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()),
    z.null(),
  ]).optional(),
  icon_slug: idSchema.nullable().optional(),
  is_published: z.boolean().optional(),
  recipe: optionalNullableText(8_000),
  location_desc: optionalNullableText(4_000),
  fun_facts: z.unknown().optional(),
  audio_urls: z.unknown().optional(),
  youtube_url: z.union([httpsUrlSchema, z.null()]).optional(),
  trailer_url: z.union([httpsUrlSchema, z.null()]).optional(),
  characters: z.unknown().optional(),
  start_year: z.number().int().min(-2_000_000_000).max(3_000_000_000).nullable().optional(),
  end_year: z.number().int().min(-2_000_000_000).max(3_000_000_000).nullable().optional(),
  time_precision: optionalNullableText(32),
  released_date: optionalNullableText(64),
  rich_fields: z.union([z.record(z.string(), z.unknown()), z.null()]).optional(),
  franchise_id: z.union([idSchema, z.null()]).optional(),
  quiz_required: z.boolean().optional(),
  translations: z.array(catalogTranslationSchema).min(1).max(32).optional(),
  media: z.array(catalogMediaSchema).max(64).optional(),
  quiz_questions: z.array(catalogQuizQuestionSchema).max(MAX_QUIZ_QUESTIONS).optional(),
}).strict().superRefine((value, context) => {
  if (value.translations) {
    const languages = value.translations.map((translation) => translation.lang);
    if (new Set(languages).size !== languages.length) {
      context.addIssue({ code: "custom", path: ["translations"], message: "Translation languages must be unique" });
    }
  }
});

export const catalogItemSingleUpdateSchema = z.object({ item: catalogItemUpdateSchema }).strict();
export const parentLessonUpdateSchema = catalogItemSingleUpdateSchema;

export const catalogItemBatchUpdateSchema = z.object({
  items: z.array(catalogItemUpdateSchema).min(1).max(100),
}).strict().superRefine((value, context) => {
  const ids = value.items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["items"], message: "Each item may appear only once per batch" });
  }
});

export const quizSubmitSchema = z.object({
  answers: z.array(z.object({
    question_id: idSchema,
    chosen_answers: z.array(z.number().int().min(0).max(31)).min(1).max(MAX_QUIZ_ANSWER_INDICES),
  }).strict()).min(1).max(MAX_QUIZ_QUESTIONS),
}).strict();

/** Standalone daily-bank IDs are namespaced; item quiz IDs keep their existing contract. */
export const dailyQuizSubmitSchema = z.object({
  answers: z.array(z.object({
    question_id: z.union([idSchema, z.string().max(128).regex(/^daily-v1:[a-z0-9-]+(?::[a-z0-9-]+)*$/)]),
    chosen_answers: z.array(z.number().int().min(0).max(31)).length(1),
  }).strict()).min(1).max(8),
}).strict();

export const adminQuizQuestionSchema = z.object({
  question_group_id: idSchema.nullable().optional(),
  lang: z.string().trim().regex(/^[A-Za-z-]{2,8}$/).transform((value) => value.toLowerCase()),
  question_type: z.enum(["yes_no", "single", "abc", "abcd", "multi"]),
  question: z.string().trim().min(1).max(MAX_QUIZ_QUESTION_LENGTH),
  options: z.array(z.string().trim().min(1).max(MAX_QUIZ_OPTION_LENGTH)).min(1).max(MAX_QUIZ_OPTIONS),
  correct_answers: z.array(z.number().int().min(0).max(MAX_QUIZ_OPTIONS - 1)).min(1).max(MAX_QUIZ_ANSWER_INDICES),
  sort_order: z.number().int().min(0).max(MAX_QUIZ_QUESTIONS),
  is_active: z.boolean().default(true),
}).strict().superRefine((value, context) => {
  if (new Set(value.correct_answers).size !== value.correct_answers.length
    || value.correct_answers.some((index) => index >= value.options.length)
    || (value.question_type !== "multi" && value.correct_answers.length !== 1)) {
    context.addIssue({ code: "custom", path: ["correct_answers"], message: "Correct answers do not match the question options." });
  }
});

export const adminFlashcardCreateSchema = z.object({
  lang: z.string().trim().regex(/^[A-Za-z-]{2,8}$/).transform((value) => value.toLowerCase()),
  front: z.string().trim().min(1).max(500),
  back: z.string().trim().min(1).max(4_000),
  media_hint: z.string().trim().max(2_000).nullable().optional(),
  sort_order: z.number().int().min(0).max(10_000),
  is_published: z.boolean().default(false),
  source_type: z.string().trim().min(1).max(32).default("manual"),
}).strict();

export const adminFlashcardUpdateSchema = adminFlashcardCreateSchema.partial().strict();

export const flashcardThemeSchema = z.enum(["item", "country", "continent", "era", "category"]);

export const friendRequestCreateSchema = z.object({
  requesting_scope: z.enum(["profile", "family"]),
  requesting_profile_id: z.union([idSchema, z.null()]).optional(),
  target_code: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9._~-]+$/).transform((value) => value.toUpperCase()),
  target_scope: z.enum(["profile", "family"]),
}).strict();

export const friendRequestRespondSchema = z.object({
  accept: z.boolean(),
}).strict();

const flashcardResponseSchema = z.object({
  flashcard_id: idSchema,
  rating: z.enum(["got_it", "review_again"]),
}).strict();

const isoTimestampSchema = z.string().trim().min(20).max(40).refine(
  (value) => /T/.test(value)
    && /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value)),
  "started_at must be an ISO timestamp with a timezone",
);

export const flashcardStudySessionSchema = z.object({
  focus_item_id: z.union([idSchema, z.null()]).optional().transform((value) => value ?? undefined),
  theme_type: flashcardThemeSchema,
  theme_value: z.string().trim().min(1).max(128),
  lang: languageSchema,
  viewed_flashcard_ids: z.array(idSchema).min(1).max(15),
  responses: z.array(flashcardResponseSchema).max(15),
  started_at: isoTimestampSchema,
}).strict().superRefine((value, context) => {
  if (new Set(value.viewed_flashcard_ids).size !== value.viewed_flashcard_ids.length) {
    context.addIssue({ code: "custom", path: ["viewed_flashcard_ids"], message: "Viewed flashcard IDs must be unique" });
  }
  const responseIds = value.responses.map((response) => response.flashcard_id);
  if (new Set(responseIds).size !== responseIds.length) {
    context.addIssue({ code: "custom", path: ["responses"], message: "Flashcard responses must be unique" });
  }
  const viewed = new Set(value.viewed_flashcard_ids);
  if (responseIds.some((id) => !viewed.has(id))) {
    context.addIssue({ code: "custom", path: ["responses"], message: "Responses must be a subset of viewed flashcards" });
  }
});

async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("request body limit exceeded").catch(() => undefined);
        throw new AppError(413, "REQUEST_TOO_LARGE", "Request body is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function parseJson<T>(request: Request, schema: ZodType<T>, maxBytes: number): Promise<T> {
  const buffer = await readBoundedBody(request, maxBytes);
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(422, "VALIDATION_ERROR", "Request input is invalid.", result.error.issues.slice(0, 12).map((issue) => ({ path: issue.path, message: issue.message })));
  }
  return result.data;
}

export function parsePathId(value: string): string {
  const result = idSchema.safeParse(value);
  if (!result.success) {
    throw new AppError(400, "INVALID_PATH_PARAMETER", "Path parameter is invalid.");
  }
  return result.data;
}

export function parseLimit(raw: string | undefined, max: number): number {
  if (raw === undefined || raw === "") return max;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new AppError(422, "VALIDATION_ERROR", "limit must be a positive integer.");
  }
  return Math.min(value, max);
}
