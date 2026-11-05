import { createCalendarPeopleRepository } from '../calendar/participants.js';
import { createCalendarRepository } from '../calendar/repository.js';
import { createCalendarEventsRepository } from '../calendar/events.js';
import { createMealLibraryRepository } from '../calendar/meals.js';
import { createScheduleRepository } from '../schedule/repository.js';
import { createCalendarNotificationsRepository } from '../calendar/notifications.js';
import { PLACEHOLDER_QUIZ_PATTERN } from '../quiz-content-policy.mjs';
import { createDailyQuizRepository } from '../daily-quiz/repository.js';
import type { DailyQuestion } from '../daily-quiz/game.js';
import { createRoadRacingRepository } from '../road-racing/repository.js';
import { blueprintAdventures } from '../adventures/town-events.js';
import { CachedCatalog, type CatalogScope } from '../explore/catalog.js';
import { ExploreMaps } from '../explore/maps.js';
import { PostgresSnapshotStore } from '../explore/postgres-snapshots.js';
import { withExploreTransaction } from '../explore/postgres-query.js';
import { createAdventureRepository } from '../adventures/repository.js';
import { createKitchenRepository } from '../kitchen/repository.js';
import { createPasskeyRepository } from './passkeys.js';
import { createParentReportRepository } from '../parent-reports/repository.js';
import { createGoogleAuthRepository, GOOGLE_ONLY_PASSWORD } from '../google-auth/repository.js';
import { createMinikuCatalog } from '../miniku/catalog.js';
import { createDrinkRepository } from '../town-building/drinks.js';
import { createCabbageRollRepository } from '../town-building/cabbage-rolls.js';
import { createTownRepository } from '../town-building/repository.js';
import { createTownVisitsRepository } from '../town-building/visits.js';
import { createTownBasketsRepository } from '../town-building/baskets.js';
import {createTownRaftRepository} from '../town-building/raft.js';
import { createInfinidrillRepository } from '../infinidrill/repository.js';
import { createUfoRepository } from '../ufo/repository.js';
import { createMathWallRepository } from '../math-wall/repository.js';
import { createMinikuRepository } from '../miniku/repository.js';
import { createFishingRepository } from '../fishing/repository.js';
import { createAchievementCatalogRepository } from './achievement-catalog.js';
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, gt, inArray, isNotNull, isNull, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type {
  AdminAssessmentDetailRecord,
  AdminAssessmentSummaryRecord,
  AdminCatalogItemRecord,
  AppDatabase,
  CreateCatalogItemInput,
  CreatedCatalogItemRecord,
  CreateFriendRequestInput,
  FriendRequestRecord,
  FamilyRecord,
  UpdateCatalogItemInput,
} from "../contracts/db.js";
import { assessmentPerformance, assessmentSummary } from "../admin-reports.js";
import { adminProfileReports } from "./admin-profile-reports.js";
import {
  defaultCatalogRepoRoot,
  refreshCatalogFromRepo,
} from "../catalog-refresh.js";

import {
  families,
  itemMedia,
  itemTranslations,
  items,
  profileProgress,
  profiles,
  dailyQuizSnapshots,
  flashcards,
  flashcardStudySessions,
  quizAttempts,
  quizQuestions,
  sessions,
  passkeys,
  passkeyChallenges,
  familyPasswordAudit,
  friendRequests,
  lessonAudiences,
  familyDisabledLessons,
} from "./schema.js";
import {
  assertAnswerableQuizSize,
  chooseQuizLanguage,
  computeQuizDifficulty,
  gradeQuizAnswers,
  MAX_QUIZ_QUESTIONS,
  parseQuizQuestionRecord,
} from "../quiz.js";
import type { QuizQuestionRecord } from "../contracts/db.js";
import { AppError } from "../errors.js";
import { isRootAccount, ROOT_ACCOUNT_EMAIL, ROOT_ACCOUNT_ID } from "../root-account.js";
import { deriveBadges } from "../badges.js";
import {
  assertCanonicalDeckMembership,
  buildFlashcardDeck,
  buildThemeDescriptors,
  countryCodesForContinent,
  deriveStudySession,
  knownCountryCodes,
  MAX_FLASHCARD_CANDIDATE_ITEMS,
  MAX_FLASHCARDS_PER_ITEM_LANGUAGE,
  preferredFlashcardLanguage,
  type FlashcardCandidateItem,
  type FlashcardRecord,
  type FlashcardThemeDescriptor,
  type FlashcardThemeType,
} from "../flashcards.js";
import {
  boundedLimit,
  itemDetailFromRows,
  itemSummaryFromRow,
  profileFromRow,
  safeStoredJson,
} from "./mappers.js";
import {
  friendRequestMessage,
  friendScopeLabel,
  normalizeTargetCode,
  FRIEND_REQUEST_MAX_LIST,
} from "../social.js";

const MAX_PROFILE_LIMIT = 5;
const DEFAULT_ITEM_LIMIT = 5000;
const MAX_ITEM_LIMIT = 5000;
const CATEGORIES = new Set(["food", "monument", "landmark", "music", "movie", "phenomenon", "animal"]);

function visibleItemCondition(familyId: string, profileId?: string): SQL {
  // Family-only routes cannot infer permission from a profile-targeted grant.
  // Those grants need a separately verified active profile before they are usable.
  return or(
    and(
      eq(items.sourceType, "system"),
      isNull(items.ownerFamilyId),
      sql<boolean>`NOT EXISTS (SELECT 1 FROM ${familyDisabledLessons}
        WHERE ${familyDisabledLessons.itemId} = ${items.id}
          AND ${familyDisabledLessons.familyId} = ${familyId})`,
    ),
    eq(items.ownerFamilyId, familyId),
    sql<boolean>`EXISTS (SELECT 1
      FROM ${lessonAudiences}
      WHERE ${lessonAudiences.itemId} = ${items.id}
        AND ${lessonAudiences.targetFamilyId} = ${familyId})`,
    ...(profileId ? [sql<boolean>`EXISTS (SELECT 1 FROM ${lessonAudiences}
      INNER JOIN ${profiles} ON ${profiles.id} = ${lessonAudiences.targetProfileId}
      WHERE ${lessonAudiences.itemId} = ${items.id}
        AND ${lessonAudiences.targetProfileId} = ${profileId}
        AND ${profiles.familyId} = ${familyId})`] : []),
  )!;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

interface FamilyMappingRow {
  legalAcceptedAt?: Date | null;
  legalAcceptedVersion?: string | null;
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: string;
  isActive: boolean;
  onboardingDismissed?: boolean;
  onboardingParentVisited?: boolean;
}

function familyFromRow(row: FamilyMappingRow): FamilyRecord {
  return {
    id: row.id,
    legalAcceptedAt: row.legalAcceptedAt ?? null,
    legalAcceptedVersion: row.legalAcceptedVersion ?? null,
    email: row.email,
    displayName: row.displayName,
    passwordHash: row.passwordHash,
    role: row.role,
    isActive: row.isActive,
    onboardingDismissed: row.onboardingDismissed ?? true,
    onboardingParentVisited: row.onboardingParentVisited ?? false,
  };
}

function friendRequestFromRow(row: typeof friendRequests.$inferSelect): FriendRequestRecord {
  return {
    id: row.id,
    requesting_family_id: row.requestingFamilyId,
    requesting_scope: row.requestingScope as FriendRequestRecord["requesting_scope"],
    requesting_profile_id: row.requestingProfileId,
    requesting_label: row.requestingLabel,
    target_family_id: row.targetFamilyId,
    target_scope: row.targetScope as FriendRequestRecord["target_scope"],
    target_profile_id: row.targetProfileId,
    target_label: row.targetLabel,
    target_code: row.targetCode,
    requester_message: row.requesterMessage,
    status: row.status as FriendRequestRecord["status"],
    created_at: row.createdAt,
    responded_at: row.respondedAt,
    responded_by_family_id: row.respondedByFamilyId,
  };
}

function isPendingFriendRequestViolation(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    const databaseError = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (databaseError.code === "23505" && databaseError.constraint === "friend_requests_pending_unique") {
      return true;
    }
    current = databaseError.cause;
  }
  return false;
}

function isCatalogItemConflict(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    const databaseError = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (databaseError.code === "23505" && (
      databaseError.constraint === "items_pkey"
      || (typeof databaseError.constraint === "string" && databaseError.constraint.startsWith("items_"))
    )) return true;
    current = databaseError.cause;
  }
  return false;
}

function storedStringArray(value: unknown): string[] {
  const parsed = safeStoredJson(value, []);
  return Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string") ? parsed : [];
}

function storedNumberArray(value: unknown): number[] {
  const parsed = safeStoredJson(value, []);
  return Array.isArray(parsed) && parsed.every((entry) => Number.isInteger(entry)) ? parsed : [];
}



function profileSelect() {
  return {
    id: profiles.id,
    name: profiles.name,
    emoji: profiles.emoji,
    color: profiles.color,
    publicId: profiles.publicId,
    nativeCountryCode: profiles.nativeCountryCode,
    nativeCity: profiles.nativeCity,
    avatarType: profiles.avatarType,
    avatarUrl: profiles.avatarUrl,
    avatarFrame: profiles.avatarFrame,
    tourCompletedAt: profiles.tourCompletedAt,
    createdAt: profiles.createdAt,
    totalDone: sql<number>`COUNT(DISTINCT ${profileProgress.id})`,
    badgeCount: sql<number>`0`,
  };
}

export function createDatabase(url: string): AppDatabase {
  if (!url || !url.trim()) throw new Error("DATABASE_URL is required to create the database.");

  const pool = new Pool({
    connectionString: url,
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    allowExitOnIdle: true,
  });
  // Keep idle connection failures from becoming uncaught EventEmitter errors.
  pool.on("error", () => undefined);
  const orm = drizzle({ client: pool });
  const usefulQuestion = sql`${quizQuestions.question} !~* ${PLACEHOLDER_QUIZ_PATTERN}`;
  const hasUsefulQuiz = sql<boolean>`EXISTS (SELECT 1 FROM quiz_questions AS available_question WHERE available_question.item_id = items.id AND available_question.is_active = true AND available_question.question !~* ${PLACEHOLDER_QUIZ_PATTERN})`;


  function publishedScope(input: CatalogScope) {
    return and(eq(items.isPublished, true), visibleItemCondition(input.familyId, input.profileId),
      ...(input.category ? [eq(items.category, input.category)] : []))!;
  }

  async function loadItemSummaries(condition: SQL, limit: number, signal: AbortSignal) {
    const rows = await withExploreTransaction(pool, client => drizzle({ client }).select({
      id: sql<string>`left(items.id,257)`, category: items.category, latitude: items.latitude, longitude: items.longitude,
      countryCode: sql<string | null>`left(items.country_code,9)`, iconSlug: sql<string | null>`left(items.icon_slug,257)`, startYear: items.startYear, endYear: items.endYear,
      quizRequired: items.quizRequired,
      hasQuiz: hasUsefulQuiz,
      // Select one bounded title per item in PostgreSQL. Loading every
      // translation first makes the 5,000-item bound ineffective.
      title: sql<string | null>`(SELECT left(preferred.title,1025) FROM item_translations AS preferred
        WHERE preferred.item_id=items.id ORDER BY (preferred.lang='en') DESC,preferred.lang LIMIT 1)`,
    }).from(items).where(condition).orderBy(asc(items.createdAt)).limit(limit), { signal, readOnly: true });
    if (rows.length > MAX_ITEM_LIMIT) throw new AppError(503, 'EXPLORE_CACHE_TOO_LARGE', 'Catalog membership exceeds the map limits.');
    return rows.map(row => {
      const output = itemSummaryFromRow(row);
      if (row.title) output.title = row.title;
      return output;
    });
  }

  const cachedCatalog = new CachedCatalog(new PostgresSnapshotStore(pool), {
    async context(input) {
      // Explicit aliases matter in nested SELECTs: Drizzle strips column
      // qualification in select expressions, making joined IDs ambiguous.
      const result = await withExploreTransaction(pool, client => client.query<{ catalogRevision: string; visibilityRevision: string; hasExceptions: boolean }>(`
        SELECT catalog_revision::text AS "catalogRevision", visibility_revision::text AS "visibilityRevision",
          (EXISTS (SELECT 1 FROM family_disabled_lessons d WHERE d.family_id=$1)
          OR EXISTS (SELECT 1 FROM items i WHERE i.is_published=true AND i.owner_family_id=$1)
          OR EXISTS (SELECT 1 FROM lesson_audiences a INNER JOIN items i ON i.id=a.item_id
            WHERE i.is_published=true AND (a.target_family_id=$1 OR (a.target_profile_id=$2
              AND EXISTS (SELECT 1 FROM profiles p WHERE p.id=a.target_profile_id AND p.family_id=$1))))) AS "hasExceptions"
        FROM explore_revisions WHERE id=1`, [input.familyId, input.profileId ?? null]), { readOnly: true });
      if (!result.rows[0]) throw new AppError(503, 'EXPLORE_CACHE_UNAVAILABLE', 'Catalog preparation is unavailable.');
      return result.rows[0];
    },
    common(category, signal) {
      return loadItemSummaries(and(eq(items.isPublished, true), eq(items.sourceType, 'system'), isNull(items.ownerFamilyId),
        ...(category ? [eq(items.category, category)] : []))!, MAX_ITEM_LIMIT + 1, signal);
    },
    async visibleIds(input, signal) {
      const rows = await withExploreTransaction(pool, client => drizzle({ client }).select({ id: sql<string>`left(items.id,257)` }).from(items).where(publishedScope(input))
        .orderBy(asc(items.createdAt)).limit(MAX_ITEM_LIMIT + 1), { signal, readOnly: true });
      if (rows.length > MAX_ITEM_LIMIT) throw new AppError(503, 'EXPLORE_CACHE_TOO_LARGE', 'Catalog membership exceeds the map limits.');
      if (rows.some(row => row.id.length > 256)) throw new AppError(503, 'EXPLORE_CACHE_TOO_LARGE', 'Catalog metadata exceeds the map limits.');
      return rows.map(row => row.id);
    },
    hydrate(input, ids, signal) { return loadItemSummaries(and(publishedScope(input), inArray(items.id, ids))!, MAX_ITEM_LIMIT, signal); },
  });

  async function queryProfile(familyId: string, profileId?: string, limit?: number) {
    const condition = profileId
      ? and(eq(profiles.familyId, familyId), eq(profiles.id, profileId))
      : eq(profiles.familyId, familyId);
    const query = orm
      .select(profileSelect())
      .from(profiles)
      .leftJoin(profileProgress, eq(profileProgress.profileId, profiles.id))
      .where(condition)
      .groupBy(
        profiles.id,
        profiles.name,
        profiles.emoji,
        profiles.color,
        profiles.publicId,
        profiles.nativeCountryCode,
        profiles.nativeCity,
        profiles.avatarType,
        profiles.avatarUrl,
        profiles.avatarFrame,
        profiles.createdAt,
      )
      .orderBy(asc(profiles.createdAt));
    return limit === undefined ? query : query.limit(limit);
  }

  const questionSelection = {
    id: quizQuestions.id,
    itemId: quizQuestions.itemId,
    lang: quizQuestions.lang,
    question: quizQuestions.question,
    questionType: quizQuestions.questionType,
    options: quizQuestions.options,
    correctAnswers: quizQuestions.correctAnswers,
    sortOrder: quizQuestions.sortOrder,
    isActive: quizQuestions.isActive,
  };

  type SelectExecutor = Pick<typeof orm, "select">;
  type FlashcardExecutor = Pick<typeof orm, "select" | "execute">;

  async function chooseStoredQuestionLanguage(
    executor: SelectExecutor,
    itemId: string,
    requestedLanguage: string,
  ): Promise<string | null> {
    const rows = await executor
      .select({ lang: quizQuestions.lang })
      .from(quizQuestions)
      .where(and(eq(quizQuestions.itemId, itemId), eq(quizQuestions.isActive, true), usefulQuestion))
      .groupBy(quizQuestions.lang)
      .orderBy(asc(quizQuestions.lang))
      .limit(MAX_QUIZ_QUESTIONS + 1);
    return chooseQuizLanguage(rows.map((row) => row.lang), requestedLanguage);
  }

  async function loadLanguageQuestions(
    executor: SelectExecutor,
    itemId: string,
    lang: string,
  ): Promise<QuizQuestionRecord[]> {
    const rows = await executor
      .select({
        ...questionSelection,
      })
      .from(quizQuestions)
      .where(and(
        eq(quizQuestions.itemId, itemId),
        eq(quizQuestions.lang, lang),
        eq(quizQuestions.isActive, true), usefulQuestion,
      ))
      .orderBy(asc(quizQuestions.sortOrder), asc(quizQuestions.id))
      .limit(MAX_QUIZ_QUESTIONS + 1);
    assertAnswerableQuizSize(rows.length);
    const questions = rows.map(parseQuizQuestionRecord);
    if (questions.some((question) => question === null)) {
      throw new AppError(422, "QUIZ_UNAVAILABLE", "This quiz contains invalid active questions.");
    }
    return questions as QuizQuestionRecord[];
  }

  function quizSet(questions: QuizQuestionRecord[]) {
    return { questions, difficulty: computeQuizDifficulty(questions) };
  }

  async function loadFocusItem(executor: SelectExecutor, itemId: string, familyId: string, profileId?: string): Promise<FlashcardCandidateItem | null> {
    const rows = await executor
      .select({
        id: items.id,
        category: items.category,
        countryCode: items.countryCode,
        startYear: items.startYear,
        hasQuiz: hasUsefulQuiz,
      })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.isPublished, true), visibleItemCondition(familyId, profileId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const titles = await executor
      .select({ title: itemTranslations.title })
      .from(itemTranslations)
      .where(and(eq(itemTranslations.itemId, itemId), eq(itemTranslations.lang, "en")))
      .limit(1);
    return {
      id: row.id,
      category: row.category,
      country_code: row.countryCode,
      start_year: row.startYear,
      title: titles[0]?.title ?? "Untitled",
      has_quiz: row.hasQuiz,
    };
  }

  function descriptorCondition(descriptor: FlashcardThemeDescriptor): SQL {
    if (descriptor.theme_type === "item") return eq(items.id, descriptor.theme_value);
    if (descriptor.theme_type === "country") return sql`UPPER(${items.countryCode}) = ${descriptor.theme_value}`;
    if (descriptor.theme_type === "category") return eq(items.category, descriptor.theme_value);
    if (descriptor.theme_type === "continent") {
      if (descriptor.theme_value === "Unknown") {
        return and(
          isNotNull(items.countryCode),
          sql`UPPER(${items.countryCode}) NOT IN (${sql.join(knownCountryCodes().map((code) => sql`${code}`), sql`, `)})`,
        )!;
      }
      const countryCodes = countryCodesForContinent(descriptor.theme_value);
      return countryCodes.length
        ? sql`UPPER(${items.countryCode}) IN (${sql.join(countryCodes.map((code) => sql`${code}`), sql`, `)})`
        : sql`false`;
    }
    if (descriptor.theme_value === "dino") return lte(items.startYear, -10_000);
    if (descriptor.theme_value === "ancient") return and(gt(items.startYear, -10_000), lte(items.startYear, 500))!;
    if (descriptor.theme_value === "medieval") return and(gt(items.startYear, 500), lte(items.startYear, 1500))!;
    if (descriptor.theme_value === "olden") return and(gt(items.startYear, 1500), lte(items.startYear, 1900))!;
    if (descriptor.theme_value === "today") return gt(items.startYear, 1900);
    return sql`false`;
  }

  async function loadThemeCandidates(
    executor: SelectExecutor,
    focus: FlashcardCandidateItem | null,
    descriptor: FlashcardThemeDescriptor,
    familyId: string,
    profileId?: string,
  ): Promise<FlashcardCandidateItem[]> {
    const maximumOtherItems = descriptor.theme_type === "item"
      ? 0
      : MAX_FLASHCARD_CANDIDATE_ITEMS - (focus ? 1 : 0);
    const candidateHasQuiz = hasUsefulQuiz;
    const candidateTitle = sql<string>`COALESCE((SELECT candidate_translation.title FROM item_translations AS candidate_translation WHERE candidate_translation.item_id = ${items.id} AND candidate_translation.lang = 'en' ORDER BY candidate_translation.id LIMIT 1), 'Untitled')`;
    const conditions: SQL[] = [eq(items.isPublished, true), visibleItemCondition(familyId, profileId), descriptorCondition(descriptor)];
    if (focus) conditions.push(ne(items.id, focus.id));
    const otherRows = maximumOtherItems === 0 ? [] : await executor
      .select({
        id: items.id,
        category: items.category,
        countryCode: items.countryCode,
        startYear: items.startYear,
        hasQuiz: candidateHasQuiz,
      })
      .from(items)
      .where(and(...conditions))
      .orderBy(desc(candidateHasQuiz), asc(candidateTitle), asc(items.id))
      .limit(maximumOtherItems);
    const baseRows = focus ? [{
      id: focus.id,
      category: focus.category,
      countryCode: focus.country_code ?? null,
      startYear: focus.start_year ?? null,
      hasQuiz: focus.has_quiz,
    }, ...otherRows] : otherRows;
    const ids = baseRows.map((row) => row.id);
    if (!ids.length) return [];
    const titleRows = await executor
      .select({ itemId: itemTranslations.itemId, title: itemTranslations.title })
      .from(itemTranslations)
      .where(and(inArray(itemTranslations.itemId, ids), eq(itemTranslations.lang, "en")))
      .orderBy(asc(itemTranslations.itemId))
      .limit(ids.length);
    const titles = new Map(titleRows.map((row) => [row.itemId, row.title] as const));
    return baseRows.map((row) => ({
      id: row.id,
      category: row.category,
      country_code: row.countryCode,
      start_year: row.startYear,
      title: titles.get(row.id) ?? (focus && row.id === focus.id ? focus.title : "Untitled"),
      has_quiz: row.hasQuiz,
    }));
  }

  function validFlashcardText(row: {
    id: string;
    lang: string;
    front: string;
    back: string;
    sourceType?: string;
    source_type?: string;
  }): boolean {
    const sourceType = row.sourceType ?? row.source_type ?? "";
    return row.id.length > 0 && row.id.length <= 128
      && /^[a-z]{2,8}$/.test(row.lang)
      && row.front.trim().length > 0 && row.front.length <= 500
      && row.back.trim().length > 0 && row.back.length <= 4_000
      && sourceType.length > 0 && sourceType.length <= 128;
  }

  async function loadPreferredCards(
    executor: FlashcardExecutor,
    candidates: readonly FlashcardCandidateItem[],
    requestedLanguage: string,
  ): Promise<Map<string, FlashcardRecord[]>> {
    if (!candidates.length) return new Map();
    const candidateValues = sql.join(
      candidates.map((candidate, index) => sql`(${candidate.id}, ${index})`),
      sql`, `,
    );
    const perItemLimit = MAX_FLASHCARDS_PER_ITEM_LANGUAGE + 1;
    const result = await executor.execute<{
      id: string;
      item_id: string;
      lang: string;
      front: string;
      back: string;
      media_hint: string | null;
      sort_order: number;
      source_type: string;
    }>(sql`
      SELECT selected.id, selected.item_id, selected.lang, selected.front, selected.back,
             selected.media_hint, selected.sort_order, selected.source_type
      FROM (VALUES ${candidateValues}) AS candidate(item_id, item_order)
      CROSS JOIN LATERAL (
        SELECT ${flashcards.id} AS id, ${flashcards.itemId} AS item_id, ${flashcards.lang} AS lang,
               ${flashcards.front} AS front, ${flashcards.back} AS back, ${flashcards.mediaHint} AS media_hint,
               ${flashcards.sortOrder} AS sort_order, ${flashcards.sourceType} AS source_type
        FROM ${flashcards}
        WHERE ${flashcards.itemId} = candidate.item_id
          AND ${flashcards.isPublished} = true
          AND ${flashcards.lang} IN (${requestedLanguage}, 'en')
        ORDER BY CASE WHEN ${flashcards.lang} = ${requestedLanguage} THEN 0 ELSE 1 END,
                 ${flashcards.sortOrder}, ${flashcards.id}
        LIMIT ${perItemLimit}
      ) AS selected
      ORDER BY candidate.item_order, selected.sort_order, selected.id
    `);
    const titles = new Map(candidates.map((candidate) => [candidate.id, candidate.title] as const));
    const grouped = new Map<string, typeof result.rows>();
    for (const row of result.rows) {
      const rows = grouped.get(row.item_id) ?? [];
      rows.push(row);
      grouped.set(row.item_id, rows);
    }
    const preferred = new Map<string, FlashcardRecord[]>();
    for (const candidate of candidates) {
      const rows = grouped.get(candidate.id) ?? [];
      const source = preferredFlashcardLanguage(rows, requestedLanguage);
      const bounded = source.slice(0, MAX_FLASHCARDS_PER_ITEM_LANGUAGE);
      if (bounded.some((row) => !validFlashcardText(row))) continue;
      if (bounded.length) preferred.set(candidate.id, bounded.map((row) => ({
        id: row.id,
        item_id: row.item_id,
        item_title: titles.get(row.item_id) ?? "Untitled",
        lang: row.lang,
        front: row.front,
        back: row.back,
        ...(row.media_hint ? { media_hint: row.media_hint } : {}),
        sort_order: row.sort_order,
        source_type: row.source_type,
      })));
    }
    return preferred;
  }

  async function buildStoredDeck(
    executor: FlashcardExecutor,
    profileId: string,
    itemId: string,
    lang: string,
    themeType: FlashcardThemeType,
    themeValue: string,
    familyId: string,
  ) {
    const focus = await loadFocusItem(executor, itemId, familyId, profileId);
    if (!focus) return null;
    const descriptor = buildThemeDescriptors(focus).find((value) => (
      value.theme_type === themeType && value.theme_value === themeValue
    ));
    if (!descriptor) {
      throw new AppError(422, "INVALID_FLASHCARD_THEME", "Study deck is not available for this item and theme.");
    }
    const candidates = await loadThemeCandidates(executor, focus, descriptor, familyId, profileId);
    const cardsByItem = await loadPreferredCards(executor, candidates, lang);
    const contributing = candidates.filter((candidate) => (cardsByItem.get(candidate.id)?.length ?? 0) > 0);
    const availableCards = contributing.reduce((total, candidate) => total + (cardsByItem.get(candidate.id)?.length ?? 0), 0);
    if (availableCards < descriptor.min_cards) {
      throw new AppError(422, "FLASHCARD_DECK_UNAVAILABLE", "Not enough published flashcards are available for this theme.");
    }

    return {
      theme_type: descriptor.theme_type,
      theme_value: descriptor.theme_value,
      title: descriptor.title,
      description: descriptor.description,
      cards: buildFlashcardDeck(profileId, focus.id, themeType, themeValue, contributing, cardsByItem),
      available_cards: availableCards,
      item_count: contributing.length,
    };
  }

  async function buildCanonicalThemeDeck(
    executor: FlashcardExecutor,
    profileId: string,
    lang: string,
    themeType: Exclude<FlashcardThemeType, "item">,
    themeValue: string,
    familyId: string,
  ): Promise<FlashcardRecord[]> {
    const descriptor: FlashcardThemeDescriptor = {
      theme_type: themeType,
      theme_value: themeValue,
      title: "",
      description: "",
      min_cards: 6,
    };
    const candidates = await loadThemeCandidates(executor, null, descriptor, familyId, profileId);
    const cardsByItem = await loadPreferredCards(executor, candidates, lang);
    const contributing = candidates.filter((candidate) => (cardsByItem.get(candidate.id)?.length ?? 0) > 0);
    const availableCards = contributing.reduce((total, candidate) => total + (cardsByItem.get(candidate.id)?.length ?? 0), 0);
    if (availableCards < descriptor.min_cards) {
      throw new AppError(422, "FLASHCARD_DECK_UNAVAILABLE", "Not enough published flashcards are available for this theme.");
    }
    return buildFlashcardDeck(profileId, "", themeType, themeValue, contributing, cardsByItem);
  }

  async function catalogDetail(itemId: string, condition: SQL): Promise<AdminCatalogItemRecord | null> {
    const rows = await orm
      .select({
        id: items.id,
        category: items.category,
        latitude: items.latitude,
        longitude: items.longitude,
        countryCode: items.countryCode,
        iconSlug: items.iconSlug,
        isPublished: items.isPublished,
        sourceType: items.sourceType,
        ownerFamilyId: items.ownerFamilyId,
        recipe: items.recipe,
        locationDesc: items.locationDesc,
        funFacts: items.funFacts,
        audioUrls: items.audioUrls,
        youtubeUrl: items.youtubeUrl,
        trailerUrl: items.trailerUrl,
        characters: items.characters,
        startYear: items.startYear,
        endYear: items.endYear,
        timePrecision: items.timePrecision,
        releasedDate: items.releasedDate,
        richFields: items.richFields,
        franchiseId: items.franchiseId,
        quizRequired: items.quizRequired,
        createdAt: items.createdAt,
        updatedAt: items.updatedAt,
      })
      .from(items)
      .where(condition)
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    const [translations, media, questions] = await Promise.all([
      orm
        .select({
          id: itemTranslations.id,
          lang: itemTranslations.lang,
          title: itemTranslations.title,
          description: itemTranslations.description,
          history: itemTranslations.history,
        })
        .from(itemTranslations)
        .where(eq(itemTranslations.itemId, itemId))
        .orderBy(asc(itemTranslations.lang)),
      orm
        .select({
          id: itemMedia.id,
          mediaType: itemMedia.mediaType,
          label: itemMedia.label,
          filename: itemMedia.filename,
          lang: itemMedia.lang,
          sortOrder: itemMedia.sortOrder,
        })
        .from(itemMedia)
        .where(eq(itemMedia.itemId, itemId))
        .orderBy(asc(itemMedia.sortOrder)),
      orm
        .select({
          id: quizQuestions.id,
          questionGroupId: quizQuestions.questionGroupId,
          lang: quizQuestions.lang,
          question: quizQuestions.question,
          questionType: quizQuestions.questionType,
          options: quizQuestions.options,
          correctAnswers: quizQuestions.correctAnswers,
          sortOrder: quizQuestions.sortOrder,
          isActive: quizQuestions.isActive,
        })
        .from(quizQuestions)
        .where(and(eq(quizQuestions.itemId, itemId), eq(quizQuestions.isActive, true), usefulQuestion))
        .orderBy(asc(quizQuestions.sortOrder)),
    ]);

    return {
      id: row.id,
      category: row.category,
      latitude: row.latitude,
      longitude: row.longitude,
      country_code: row.countryCode,
      icon_slug: row.iconSlug,
      is_published: row.isPublished,
      source_type: row.sourceType,
      owner_family_id: row.ownerFamilyId,
      recipe: row.recipe,
      location_desc: row.locationDesc,
      fun_facts: safeStoredJson(row.funFacts, null),
      audio_urls: safeStoredJson(row.audioUrls, null),
      youtube_url: row.youtubeUrl,
      trailer_url: row.trailerUrl,
      characters: safeStoredJson(row.characters, null),
      start_year: row.startYear,
      end_year: row.endYear,
      time_precision: row.timePrecision,
      released_date: row.releasedDate,
      rich_fields: safeStoredJson(row.richFields, null),
      franchise_id: row.franchiseId,
      quiz_required: row.quizRequired,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      translations: translations.map((translation) => ({
        id: translation.id,
        lang: translation.lang,
        title: translation.title,
        description: translation.description,
        history: translation.history,
      })),
      media: media.map((value) => ({
        id: value.id,
        media_type: value.mediaType,
        label: value.label,
        lang: value.lang,
        filename: value.filename,
        sort_order: value.sortOrder,
      })),
      quiz_questions: questions.map((question) => ({
        id: question.id,
        question_group_id: question.questionGroupId,
        lang: question.lang,
        question: question.question,
        question_type: question.questionType,
        options: storedStringArray(question.options),
        correct_answers: storedNumberArray(question.correctAnswers),
        sort_order: question.sortOrder,
        is_active: question.isActive,
      })),
    };
  }


  const database: AppDatabase = {
    town: createTownRepository(pool),
    townVisits: createTownVisitsRepository(pool),
    townBaskets: createTownBasketsRepository(pool),
    townRaft:createTownRaftRepository(pool),
    parentReports: createParentReportRepository(pool),
    drinks: createDrinkRepository(pool),
    adventures: createAdventureRepository(pool),
    kitchen: createKitchenRepository(pool),
    cabbageRolls: createCabbageRollRepository(pool),
    infinidrill: createInfinidrillRepository(pool),
    miniku: createMinikuRepository(pool),
    calendar: createCalendarRepository(pool),
    calendarPeople: createCalendarPeopleRepository(pool),
    calendarEvents: createCalendarEventsRepository(pool),
    calendarMeals: createMealLibraryRepository(pool),
    calendarNotifications: createCalendarNotificationsRepository(pool),
    schedules: createScheduleRepository(pool),
    fishing: createFishingRepository(pool),
    explore: new ExploreMaps(cachedCatalog, async (scope, ids) => {
      if (!ids.length) return [];
      const result = await withExploreTransaction(pool, client => client.query<{ item_id: string }>(`
        SELECT pp.item_id FROM profile_progress pp INNER JOIN profiles p ON p.id=pp.profile_id
        WHERE p.family_id=$1 AND p.id=$2 AND pp.item_id=ANY($3::text[])
        ORDER BY pp.item_id LIMIT 5000`, [scope.familyId, scope.profileId, ids]), { readOnly: true });
      return result.rows.map(row => row.item_id);
    }),
    minikuCatalog: createMinikuCatalog(pool),
    achievements: createAchievementCatalogRepository(pool),
    ufo: createUfoRepository(pool),
    roadRacing: createRoadRacingRepository(pool),
    mathWall: createMathWallRepository(pool),
    async ping() {
      await orm.execute(sql`SELECT 1`);
    },

    async close() {
      await pool.end();
    },

    catalog: {
      async refresh(options) {
        return refreshCatalogFromRepo(pool, defaultCatalogRepoRoot(), options);
      },
    },

    googleAuth: createGoogleAuthRepository(orm),
    auth: {
      async updateOnboarding(familyId, action) {
        await orm.update(families).set(action === "dismiss" ? { onboardingDismissed: true } : { onboardingParentVisited: true }).where(eq(families.id, familyId));
      },
      async findFamilyByEmail(email) {
        const rows = await orm
          .select()
          .from(families)
          .where(eq(families.email, normalizeEmail(email)))
          .limit(1);
        return rows[0] ? familyFromRow(rows[0]) : null;
      },

      async findFamilyById(id) {
        const rows = await orm.select().from(families).where(eq(families.id, id)).limit(1);
        return rows[0] ? familyFromRow(rows[0]) : null;
      },

      async createFamily(input) {
        if (input.id === ROOT_ACCOUNT_ID || normalizeEmail(input.email) === ROOT_ACCOUNT_EMAIL) {
          throw new Error("The root account identifiers are reserved; use db:init-root.");
        }
        const rows = await orm
          .insert(families)
          .values({
            id: input.id,
            email: normalizeEmail(input.email),
            displayName: input.displayName,
            passwordHash: input.passwordHash,
            role: input.role,
            legalAcceptedAt: input.legalAcceptedAt ?? null,
            legalAcceptedVersion: input.legalAcceptedVersion ?? null,
            onboardingDismissed: input.role !== "family",
          })
          .onConflictDoNothing({ target: families.email })
          .returning();
        const created = rows[0];
        if (!created) throw new AppError(409, "FAMILY_EXISTS", "An account with that email already exists.");
        return familyFromRow(created);
      },

      async createRootIfMissing(passwordHash) {
        const inserted = await orm.insert(families).values({
          id: ROOT_ACCOUNT_ID, email: ROOT_ACCOUNT_EMAIL, displayName: "Root",
          passwordHash, role: "admin",
        }).onConflictDoNothing().returning({ id: families.id });
        if (inserted.length) return true;
        const existing = await orm.select().from(families).where(eq(families.id, ROOT_ACCOUNT_ID)).limit(1);
        if (!existing[0] || !isRootAccount(familyFromRow(existing[0]))) {
          throw new Error("The reserved root account conflicts with an existing or inactive account.");
        }
        return false;
      },

      async replaceRootPassword(expectedPasswordHash, passwordHash, sessionHash) {
        return orm.transaction(async (tx) => {
          const rows = await tx.select().from(families).where(eq(families.id, ROOT_ACCOUNT_ID)).for("update");
          const row = rows[0];
          if (!row || !isRootAccount(familyFromRow(row)) || row.passwordHash !== expectedPasswordHash) return false;
          // Recheck under the same family lock used to issue sessions, so a
          // revoked session or login using an old hash cannot survive rotation.
          const activeSession = await tx.select({ id: sessions.id }).from(sessions).where(and(
            eq(sessions.familyId, ROOT_ACCOUNT_ID), eq(sessions.tokenHash, sessionHash), gt(sessions.expiresAt, new Date()),
          )).limit(1);
          if (!activeSession.length) return false;
          await tx.update(families).set({ passwordHash, updatedAt: new Date() }).where(eq(families.id, ROOT_ACCOUNT_ID));
          await tx.delete(sessions).where(eq(sessions.familyId, ROOT_ACCOUNT_ID));
          return true;
        });
      },

      async setFamilyPassword(input) {
        return orm.transaction(async (tx) => {
          const rows = await tx.select().from(families).where(eq(families.id, input.targetId)).for("update");
          const target = rows[0];
          if (!target || target.role !== "family" || target.id === ROOT_ACCOUNT_ID || (input.expectedPasswordHash !== undefined && target.passwordHash !== input.expectedPasswordHash)) return "not_found";
          await tx.update(families).set({ passwordHash: input.passwordHash, updatedAt: new Date() }).where(eq(families.id, input.targetId));
          // A password reset is account recovery: remove authenticators and
          // their pending family-bound ceremonies as well as active sessions.
          await tx.delete(passkeys).where(eq(passkeys.familyId, input.targetId));
          await tx.delete(passkeyChallenges).where(eq(passkeyChallenges.familyId, input.targetId));
          await tx.delete(sessions).where(eq(sessions.familyId, input.targetId));
          await tx.insert(familyPasswordAudit).values({
            id: randomUUID(), actorFamilyId: input.actorId, targetFamilyId: input.targetId, reason: input.reason,
          });
          return "updated";
        });
      },

      async createSession(input) {
        await orm.transaction(async (tx) => {
          const rows = await tx.select().from(families).where(eq(families.id, input.familyId)).for("update");
          const row = rows[0];
          if (!row || !row.isActive || (input.expectedPasswordHash !== undefined && row.passwordHash !== input.expectedPasswordHash)) {
            throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
          }
          await tx.insert(sessions).values({
            id: randomUUID(),
            tokenHash: input.tokenHash,
            familyId: input.familyId,
            expiresAt: input.expiresAt,
          });
        });
      },

      async findFamilyBySessionHash(tokenHash, now) {
        const rows = await orm
          .select({
            id: families.id,
            email: families.email,
            displayName: families.displayName,
            passwordHash: families.passwordHash,
            legalAcceptedAt: families.legalAcceptedAt,
            legalAcceptedVersion: families.legalAcceptedVersion,
            role: families.role,
            isActive: families.isActive,
            onboardingDismissed: families.onboardingDismissed,
            onboardingParentVisited: families.onboardingParentVisited,
          })
          .from(sessions)
          .innerJoin(families, eq(families.id, sessions.familyId))
          .where(and(
            eq(sessions.tokenHash, tokenHash),
            gt(sessions.expiresAt, now),
            eq(families.isActive, true),
          ))
          .limit(1);
        return rows[0] ? familyFromRow(rows[0]) : null;
      },

      async deleteSession(tokenHash) {
        await orm.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
      },

      async parentAccess(tokenHash, familyId, now) {
        const rows = await orm.select({ until: sessions.parentVerifiedUntil, method: sessions.parentVerifiedBy, passwordHash: families.passwordHash })
          .from(sessions).innerJoin(families,eq(sessions.familyId,families.id)).where(and(eq(sessions.tokenHash, tokenHash), eq(sessions.familyId, familyId),
            gt(sessions.expiresAt, now), gt(sessions.parentVerifiedUntil, now))).limit(1);
        const row = rows[0];
        return row?.until && (row.method === "password" || row.method === "passkey" || (row.method === "google" && row.passwordHash===GOOGLE_ONLY_PASSWORD))
          ? { until: row.until, method: row.method } : null;
      },

      async grantParentAccess(tokenHash, familyId, until, method) {
        const rows = await orm.update(sessions).set({ parentVerifiedUntil: until, parentVerifiedBy: method })
          .where(and(eq(sessions.tokenHash, tokenHash), eq(sessions.familyId, familyId), gt(sessions.expiresAt, new Date())))
          .returning({ id: sessions.id });
        return rows.length > 0;
      },

      ...createPasskeyRepository(orm),
    },

    profiles: {
      async list(familyId, limit) {
        const rows = await queryProfile(familyId, undefined, boundedLimit(limit, MAX_PROFILE_LIMIT, MAX_PROFILE_LIMIT));
        return rows.map((row) => profileFromRow(row));
      },

      async count(familyId) {
        const rows = await orm
          .select({ count: sql<number>`COUNT(*)` })
          .from(profiles)
          .where(eq(profiles.familyId, familyId));
        return Number(rows[0]?.count ?? 0);
      },

      async get(familyId, profileId) {
        const rows = await queryProfile(familyId, profileId, 1);
        return rows[0] ? profileFromRow(rows[0]) : null;
      },

      async create(familyId, input) {
        const id = randomUUID();
        const publicId = id.replaceAll("-", "").slice(0, 10).toUpperCase();
        await orm.transaction(async (tx) => {
          // Serialize creation for this family before counting its profiles.
          await tx.select({ id: families.id }).from(families)
            .where(eq(families.id, familyId)).for("update");
          const counts = await tx.select({ count: sql<number>`COUNT(*)` })
            .from(profiles).where(eq(profiles.familyId, familyId));
          if (Number(counts[0]?.count ?? 0) >= MAX_PROFILE_LIMIT) {
            throw new AppError(409, "PROFILE_LIMIT_REACHED", "Maximum 5 profiles allowed.");
          }
          await tx.insert(profiles).values({
            id,
            familyId,
            name: input.name,
            emoji: input.emoji,
            color: input.color,
            publicId,
            avatarType: input.avatar_type ?? null,
            avatarUrl: input.avatar_url ?? null,
            avatarFrame: input.avatar_frame ?? null,
            nativeCountryCode: input.native_country_code?.trim().toUpperCase() || null,
            nativeCity: input.native_city?.trim() || null,
          });
        });
        const result = await queryProfile(familyId, id);
        if (!result[0]) throw new Error("Profile was not available after insert.");
        return profileFromRow(result[0]);
      },

      async update(familyId, profileId, input) {
        const changes: Partial<typeof profiles.$inferInsert> = { updatedAt: new Date() };
        if (input.name !== undefined) changes.name = input.name;
        if (input.emoji !== undefined) changes.emoji = input.emoji;
        if (input.color !== undefined) changes.color = input.color;
        if (input.avatar_type !== undefined) changes.avatarType = input.avatar_type;
        if (input.avatar_url !== undefined) changes.avatarUrl = input.avatar_url;
        if (input.avatar_frame !== undefined) changes.avatarFrame = input.avatar_frame;
        if (input.native_country_code !== undefined) changes.nativeCountryCode = input.native_country_code?.trim().toUpperCase() || null;
        if (input.native_city !== undefined) changes.nativeCity = input.native_city?.trim() || null;
        await orm
          .update(profiles)
          .set(changes)
          .where(and(eq(profiles.id, profileId), eq(profiles.familyId, familyId)));
        return database.profiles.get(familyId, profileId);
      },

      async completeTour(familyId, profileId) {
        // Preserve the first server timestamp, including concurrent/retried requests.
        const updated = await orm.update(profiles)
          .set({ tourCompletedAt: sql`COALESCE(${profiles.tourCompletedAt}, now())` })
          .where(and(eq(profiles.id, profileId), eq(profiles.familyId, familyId)))
          .returning({ id: profiles.id });
        if (!updated[0]) return null;
        return database.profiles.get(familyId, profileId);
      },

      async setAvatar(familyId, profileId, url) {
        const updated = await orm
          .update(profiles)
          .set({ avatarType: "custom", avatarUrl: url, updatedAt: new Date() })
          .where(and(eq(profiles.id, profileId), eq(profiles.familyId, familyId)))
          .returning({ id: profiles.id });
        if (!updated[0]) return null;
        return database.profiles.get(familyId, profileId);
      },

      async delete(familyId, profileId) {
        const result = await orm
          .delete(profiles)
          .where(and(eq(profiles.id, profileId), eq(profiles.familyId, familyId)))
          .returning({ id: profiles.id });
        return result.length > 0;
      },
    },

    friendRequests: {
      async canReadAvatar(familyId,key) {
        const parts=key.split('/');if(parts.length!==4||parts[0]!=='profile-avatars')return false;
        const rows=await orm.select({id:profiles.id}).from(friendRequests).innerJoin(profiles,or(
          and(eq(profiles.id,friendRequests.requestingProfileId),eq(profiles.familyId,friendRequests.requestingFamilyId)),
          and(eq(profiles.id,friendRequests.targetProfileId),eq(profiles.familyId,friendRequests.targetFamilyId)),
        )!).where(and(
          or(eq(friendRequests.requestingFamilyId,familyId),eq(friendRequests.targetFamilyId,familyId)),
          // A pending request shows the asker's photo to the person asked, never the other way round.
          or(eq(friendRequests.status,'accepted'),and(eq(friendRequests.status,'pending'),eq(profiles.familyId,friendRequests.requestingFamilyId))),eq(profiles.id,parts[2]!),eq(profiles.familyId,parts[1]!),eq(profiles.avatarType,'custom'),eq(profiles.avatarUrl,`/media/${key}`),
        )).limit(1);
        return rows.length>0;
      },
      async list(familyId, limit) {
        const rows = await orm
          .select()
          .from(friendRequests)
          .where(or(eq(friendRequests.requestingFamilyId, familyId), eq(friendRequests.targetFamilyId, familyId)))
          .orderBy(desc(sql`COALESCE(${friendRequests.respondedAt},${friendRequests.createdAt})`), desc(friendRequests.id))
          .limit(boundedLimit(limit, FRIEND_REQUEST_MAX_LIST, FRIEND_REQUEST_MAX_LIST));
        if(!rows.length)return [];
        const profileIds=[...new Set(rows.flatMap(r=>[r.requestingProfileId,r.targetProfileId]).filter((id):id is string=>!!id))];
        const familyIds=[...new Set(rows.flatMap(r=>[r.requestingFamilyId,r.targetFamilyId]))];
        const [people,homes]=await Promise.all([
          profileIds.length?orm.select({id:profiles.id,familyId:profiles.familyId,name:profiles.name,emoji:profiles.emoji,color:profiles.color,avatarType:profiles.avatarType,avatarUrl:profiles.avatarUrl,avatarFrame:profiles.avatarFrame}).from(profiles).where(inArray(profiles.id,profileIds)):Promise.resolve([]),
          orm.select({id:families.id,name:families.displayName}).from(families).where(inArray(families.id,familyIds)),
        ]);
        const party=(scope:string,profileId:string|null,owner:string,label:string,status:string,asker:string)=>{
          const p=people.find(p=>p.id===profileId&&p.familyId===owner);
          if(scope==='family')return {name:homes.find(f=>f.id===owner)?.name??label};
          if(!p)return {name:label.replace(/ only$/,'')};
          const custom=p.avatarType==='custom'&&(owner===familyId||status==='accepted'||status==='pending'&&owner===asker);
          return {name:p.name,emoji:p.emoji,color:p.color,avatar_type:custom?'custom' as const:p.avatarType==='default'?'default' as const:'emoji' as const,avatar_url:custom||p.avatarType==='default'?p.avatarUrl:null,avatar_frame:p.avatarFrame};
        };
        return rows.map(row=>({...friendRequestFromRow(row),
          requesting_party:party(row.requestingScope,row.requestingProfileId,row.requestingFamilyId,row.requestingLabel,row.status,row.requestingFamilyId),
          target_party:party(row.targetScope,row.targetProfileId,row.targetFamilyId,row.targetLabel,row.status,row.requestingFamilyId),
        }));
      },

      async create(familyId, input: CreateFriendRequestInput) {
        const normalizedCode = normalizeTargetCode(input.target_code);
        if (input.requesting_scope === "profile" && !input.requesting_profile_id) {
          throw new AppError(422, "REQUESTING_PROFILE_REQUIRED", "A requesting profile is required.");
        }
        if (input.requesting_scope === "family" && input.requesting_profile_id !== undefined && input.requesting_profile_id !== null) {
          throw new AppError(422, "REQUESTING_PROFILE_FORBIDDEN", "A family request cannot include a requesting profile.");
        }

        try {
          return await orm.transaction(async (tx) => {
            const requesterRows = await tx
              .select({ displayName: families.displayName })
              .from(families)
              .where(eq(families.id, familyId))
              .limit(1);
            const requester = requesterRows[0];
            if (!requester) throw new AppError(404, "REQUESTING_FAMILY_NOT_FOUND", "Requesting family not found.");

            let requestingProfile: { id: string; name: string } | undefined;
            if (input.requesting_scope === "profile") {
              const profileRows = await tx
                .select({ id: profiles.id, name: profiles.name })
                .from(profiles)
                .where(and(eq(profiles.id, input.requesting_profile_id!), eq(profiles.familyId, familyId)))
                .limit(1);
              requestingProfile = profileRows[0];
              if (!requestingProfile) {
                throw new AppError(404, "REQUESTING_PROFILE_NOT_FOUND", "The requesting profile was not found.");
              }
            }

            const targetRows = await tx
              .select({
                id: profiles.id,
                familyId: profiles.familyId,
                name: profiles.name,
                publicId: profiles.publicId,
              })
              .from(profiles)
              .where(sql`UPPER(${profiles.publicId}) = ${normalizedCode}`)
              .limit(1);
            const targetProfile = targetRows[0];
            if (!targetProfile) throw new AppError(404, "TARGET_NOT_FOUND", "The target code was not found.");
            if (targetProfile.familyId === familyId) {
              throw new AppError(409, "FRIEND_REQUEST_SELF_TARGET", "You cannot send a friend request to your own family.");
            }

            const targetFamilyRows = await tx
              .select({ displayName: families.displayName })
              .from(families)
              .where(eq(families.id, targetProfile.familyId))
              .limit(1);
            const targetFamily = targetFamilyRows[0];
            if (!targetFamily) throw new AppError(404, "TARGET_FAMILY_NOT_FOUND", "The target family was not found.");

            const requestingLabel = friendScopeLabel(
              input.requesting_scope,
              requestingProfile?.name ?? requester.displayName,
            );
            const targetLabel = friendScopeLabel(
              input.target_scope,
              input.target_scope === "profile" ? targetProfile.name : targetFamily.displayName,
            );
            const inserted = await tx
              .insert(friendRequests)
              .values({
                id: randomUUID(),
                requestingFamilyId: familyId,
                requestingScope: input.requesting_scope,
                requestingProfileId: requestingProfile?.id ?? null,
                requestingLabel,
                targetFamilyId: targetProfile.familyId,
                targetScope: input.target_scope,
                targetProfileId: input.target_scope === "profile" ? targetProfile.id : null,
                targetLabel,
                targetCode: normalizedCode,
                requesterMessage: friendRequestMessage(requestingLabel, targetLabel, normalizedCode, targetProfile.name),
                status: "pending",
              })
              .returning();
            const created = inserted[0];
            if (!created) throw new Error("Friend request insert did not return a row.");
            return friendRequestFromRow(created);
          });
        } catch (error) {
          if (isPendingFriendRequestViolation(error)) {
            throw new AppError(409, "FRIEND_REQUEST_EXISTS", "That friend request is already pending.");
          }
          throw error;
        }
      },

      async respond(familyId, requestId, accept) {
        const updated = await orm
          .update(friendRequests)
          .set({
            status: accept ? "accepted" : "rejected",
            respondedAt: new Date(),
            respondedByFamilyId: familyId,
          })
          .where(and(
            eq(friendRequests.id, requestId),
            eq(friendRequests.targetFamilyId, familyId),
            eq(friendRequests.status, "pending"),
          ))
          .returning();
        if (updated[0]) return friendRequestFromRow(updated[0]);

        const existing = await orm
          .select({ targetFamilyId: friendRequests.targetFamilyId, status: friendRequests.status })
          .from(friendRequests)
          .where(eq(friendRequests.id, requestId))
          .limit(1);
        if (!existing[0]) throw new AppError(404, "FRIEND_REQUEST_NOT_FOUND", "Friend request not found.");
        if (existing[0].targetFamilyId !== familyId) {
          throw new AppError(403, "FRIEND_REQUEST_NOT_TARGET", "Only the target family can respond to this request.");
        }
        throw new AppError(409, "FRIEND_REQUEST_ALREADY_HANDLED", "Friend request is no longer pending.");
      },
    },

    parent: {
      async shareTargets(familyId) {
        const accepted = await orm
          .select({ requestingFamilyId: friendRequests.requestingFamilyId, targetFamilyId: friendRequests.targetFamilyId })
          .from(friendRequests)
          .where(and(
            eq(friendRequests.status, "accepted"),
            or(eq(friendRequests.requestingFamilyId, familyId), eq(friendRequests.targetFamilyId, familyId)),
          ))
          .limit(500);
        const ids = new Set([familyId]);
        for (const row of accepted) {
          ids.add(row.requestingFamilyId === familyId ? row.targetFamilyId : row.requestingFamilyId);
        }
        const familyRows = await orm
          .select({ id: families.id, name: families.displayName })
          .from(families)
          .where(inArray(families.id, [...ids]))
          .limit(501);
        const profileRows = await orm
          .select({ id: profiles.id, name: profiles.name, publicId: profiles.publicId, familyId: profiles.familyId })
          .from(profiles)
          .where(inArray(profiles.familyId, [...ids]))
          .orderBy(asc(profiles.createdAt))
          .limit(2505);
        return familyRows
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((row) => ({
            family_id: row.id,
            family_name: row.name,
            profiles: profileRows.filter((profile) => profile.familyId === row.id)
              .map((profile) => ({ id: profile.id, name: profile.name, public_id: profile.publicId })),
          }));
      },

      async catalog(familyId) {
        const [systemRows, customRows, disabledRows] = await Promise.all([
          orm.select({
            id: items.id, category: items.category, countryCode: items.countryCode,
            isPublished: items.isPublished, createdAt: items.createdAt,
            ownerFamilyId: items.ownerFamilyId,
          }).from(items)
            .where(and(eq(items.sourceType, "system"), eq(items.isPublished, true)))
            .orderBy(desc(items.createdAt))
            .limit(DEFAULT_ITEM_LIMIT),
          orm.select({
            id: items.id, category: items.category, countryCode: items.countryCode,
            isPublished: items.isPublished, createdAt: items.createdAt,
            ownerFamilyId: items.ownerFamilyId,
          }).from(items)
            .where(eq(items.sourceType, "custom"))
            .orderBy(desc(items.createdAt))
            .limit(DEFAULT_ITEM_LIMIT),
          orm.select({ itemId: familyDisabledLessons.itemId })
            .from(familyDisabledLessons)
            .where(eq(familyDisabledLessons.familyId, familyId))
            .limit(DEFAULT_ITEM_LIMIT),
        ]);
        const itemIds = [...systemRows, ...customRows].map((row) => row.id);
        const [translationRows, audienceRows] = await Promise.all([
          itemIds.length ? orm.select({ itemId: itemTranslations.itemId, lang: itemTranslations.lang, title: itemTranslations.title })
            .from(itemTranslations).where(inArray(itemTranslations.itemId, itemIds)).orderBy(asc(itemTranslations.lang)) : [],
          customRows.length ? orm.select().from(lessonAudiences)
            .where(inArray(lessonAudiences.itemId, customRows.map((row) => row.id)))
            .orderBy(asc(lessonAudiences.createdAt)).limit(10_000) : [],
        ]);
        const titles = new Map<string, Array<{ lang: string; title: string }>>();
        for (const row of translationRows) {
          const entries = titles.get(row.itemId) ?? [];
          entries.push(row);
          titles.set(row.itemId, entries);
        }
        const targetProfileIds = audienceRows.map((row) => row.targetProfileId).filter((id): id is string => id !== null);
        const targetProfiles = targetProfileIds.length
          ? await orm.select({ id: profiles.id, name: profiles.name, familyId: profiles.familyId })
            .from(profiles).where(inArray(profiles.id, targetProfileIds)).limit(10_000)
          : [];
        const profileById = new Map(targetProfiles.map((row) => [row.id, row]));
        const audiencesByItem = new Map<string, typeof audienceRows>();
        for (const row of audienceRows) {
          const entries = audiencesByItem.get(row.itemId) ?? [];
          entries.push(row);
          audiencesByItem.set(row.itemId, entries);
        }
        const relatedFamilyIds = new Set<string>([familyId]);
        for (const row of customRows) if (row.ownerFamilyId) relatedFamilyIds.add(row.ownerFamilyId);
        for (const row of audienceRows) {
          if (row.targetFamilyId) relatedFamilyIds.add(row.targetFamilyId);
          if (row.targetProfileId) {
            const profile = profileById.get(row.targetProfileId);
            if (profile) relatedFamilyIds.add(profile.familyId);
          }
        }
        const relatedFamilies = await orm.select({ id: families.id, name: families.displayName })
          .from(families).where(inArray(families.id, [...relatedFamilyIds])).limit(10_000);
        const familyNames = new Map(relatedFamilies.map((row) => [row.id, row.name]));
        const disabledIds = new Set(disabledRows.map((row) => row.itemId));
        const preferredTitle = (itemId: string) => {
          const options = titles.get(itemId) ?? [];
          return options.find((row) => row.lang === "en")?.title ?? options[0]?.title ?? "(untitled)";
        };
        const system_lessons = systemRows.map((row) => ({
          id: row.id, category: row.category, title: preferredTitle(row.id),
          country_code: row.countryCode, source_type: "system" as const,
          created_at: row.createdAt, is_published: row.isPublished,
          is_disabled_for_family: disabledIds.has(row.id), can_edit: false, can_share: false,
          audiences: [],
        }));
        const custom_lessons = customRows.flatMap((row) => {
          const owned = row.ownerFamilyId === familyId;
          const rawAudiences = audiencesByItem.get(row.id) ?? [];
          const visibleAudiences = rawAudiences.flatMap((audience) => {
            const targetProfile = audience.targetProfileId ? profileById.get(audience.targetProfileId) : undefined;
            const targetFamilyId = audience.targetFamilyId ?? targetProfile?.familyId;
            if (!targetFamilyId || (!owned && targetFamilyId !== familyId)) return [];
            return [{
              id: audience.id, scope: audience.targetProfileId ? "profile" as const : "family" as const,
              family_id: targetFamilyId,
              family_name: familyNames.get(targetFamilyId) ?? "Unknown family",
              profile_id: audience.targetProfileId,
              profile_name: targetProfile?.name ?? null,
              created_at: audience.createdAt,
            }];
          });
          if (!owned && visibleAudiences.length === 0) return [];
          return [{
            id: row.id, category: row.category, title: preferredTitle(row.id),
            country_code: row.countryCode, source_type: "custom" as const,
            owner_family_id: row.ownerFamilyId,
            owner_family_name: row.ownerFamilyId ? familyNames.get(row.ownerFamilyId) ?? "Unknown family" : null,
            created_at: row.createdAt, is_published: row.isPublished,
            is_disabled_for_family: false, can_edit: owned, can_share: owned,
            audiences: visibleAudiences,
          }];
        });
        return { system_lessons, custom_lessons };
      },

      async setSystemDisabled(familyId, itemIds, disabled) {
        if (itemIds.length === 0) return 0;
        const validRows = await orm.select({ id: items.id }).from(items)
          .where(and(inArray(items.id, [...new Set(itemIds)]), eq(items.sourceType, "system")))
          .limit(500);
        const validIds = validRows.map((row) => row.id);
        if (validIds.length === 0) return 0;
        if (disabled) {
          await orm.insert(familyDisabledLessons)
            .values(validIds.map((itemId) => ({ familyId, itemId })))
            .onConflictDoNothing();
        } else {
          await orm.delete(familyDisabledLessons).where(and(
            eq(familyDisabledLessons.familyId, familyId),
            inArray(familyDisabledLessons.itemId, validIds),
          ));
        }
        return validIds.length;
      },

      async shareLesson(familyId, itemId, target) {
        await orm.transaction(async (tx) => {
          const owned = await tx.select({ id: items.id }).from(items).where(and(
            eq(items.id, itemId), eq(items.sourceType, "custom"), eq(items.ownerFamilyId, familyId),
          )).limit(1);
          if (!owned[0]) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found.");
          if (target.target_family_id !== familyId) {
            const accepted = await tx.select({ id: friendRequests.id }).from(friendRequests).where(and(
              eq(friendRequests.status, "accepted"),
              or(
                and(eq(friendRequests.requestingFamilyId, familyId), eq(friendRequests.targetFamilyId, target.target_family_id)),
                and(eq(friendRequests.targetFamilyId, familyId), eq(friendRequests.requestingFamilyId, target.target_family_id)),
              ),
            )).limit(1);
            if (!accepted[0]) throw new AppError(404, "SHARE_TARGET_NOT_FOUND", "Share target not found.");
          }
          if (target.target_scope === "profile") {
            const profile = await tx.select({ id: profiles.id }).from(profiles).where(and(
              eq(profiles.id, target.target_profile_id!), eq(profiles.familyId, target.target_family_id),
            )).limit(1);
            if (!profile[0]) throw new AppError(404, "TARGET_PROFILE_NOT_FOUND", "Target profile not found.");
          } else {
            const family = await tx.select({ id: families.id }).from(families)
              .where(eq(families.id, target.target_family_id)).limit(1);
            if (!family[0]) throw new AppError(404, "SHARE_TARGET_NOT_FOUND", "Share target not found.");
          }
          await tx.insert(lessonAudiences).values({
            id: randomUUID(), itemId, grantedByFamilyId: familyId,
            targetFamilyId: target.target_scope === "family" ? target.target_family_id : null,
            targetProfileId: target.target_scope === "profile" ? target.target_profile_id! : null,
          }).onConflictDoNothing();
        });
      },
    },

    admin: {
      ...adminProfileReports(pool),
      async families() {
        const [familyRows, profileRows, progressRows, attemptRows, requestRows, itemCountRows] = await Promise.all([
          orm.select({ id: families.id, name: families.displayName, email: families.email,
            role: families.role, isActive: families.isActive, createdAt: families.createdAt })
            .from(families).orderBy(desc(families.createdAt)),
          orm.select({ id: profiles.id, familyId: profiles.familyId, name: profiles.name,
            emoji: profiles.emoji, color: profiles.color, publicId: profiles.publicId, createdAt: profiles.createdAt })
            .from(profiles).orderBy(asc(profiles.createdAt)),
          orm.select({ profileId: profileProgress.profileId, itemId: profileProgress.itemId,
            category: profileProgress.category, doneAt: profileProgress.doneAt })
            .from(profileProgress).orderBy(desc(profileProgress.doneAt)),
          orm.select({ profileId: quizAttempts.profileId, itemId: quizAttempts.itemId,
            score: quizAttempts.score, total: quizAttempts.total, completedAt: quizAttempts.completedAt })
            .from(quizAttempts).orderBy(asc(quizAttempts.completedAt)),
          orm.select().from(friendRequests).orderBy(desc(friendRequests.createdAt)),
          orm.select({ count: sql<number>`count(*)::int` }).from(items),
        ]);
        const familyNames = new Map(familyRows.map((row) => [row.id, row.name]));
        const profileNames = new Map(profileRows.map((row) => [row.id, row.name]));
        const progressItemIds = [...new Set(progressRows.map((row) => row.itemId))];
        const [itemRows, translationRows] = await Promise.all([
          progressItemIds.length ? orm.select({ id: items.id, category: items.category }).from(items)
            .where(inArray(items.id, progressItemIds)) : [],
          progressItemIds.length ? orm.select({ itemId: itemTranslations.itemId, lang: itemTranslations.lang,
            title: itemTranslations.title }).from(itemTranslations)
            .where(inArray(itemTranslations.itemId, progressItemIds)).orderBy(asc(itemTranslations.lang)) : [],
        ]);
        const itemCategories = new Map(itemRows.map((row) => [row.id, row.category]));
        const itemTitles = new Map<string, string>();
        for (const row of translationRows) {
          if (!itemTitles.has(row.itemId) || row.lang === "en") itemTitles.set(row.itemId, row.title);
        }
        const progressByProfile = new Map<string, typeof progressRows>();
        for (const row of progressRows) {
          const entries = progressByProfile.get(row.profileId) ?? [];
          entries.push(row);
          progressByProfile.set(row.profileId, entries);
        }
        const attemptsByProfile = new Map<string, typeof attemptRows>();
        for (const row of attemptRows) {
          const entries = attemptsByProfile.get(row.profileId) ?? [];
          entries.push(row);
          attemptsByProfile.set(row.profileId, entries);
        }
        const requestsByFamily = new Map<string, Array<ReturnType<typeof friendRequestFromRow> & {
          requesting_family_name: string; requesting_profile_name: string | null;
          target_family_name: string; target_profile_name: string | null;
        }>>();
        for (const row of requestRows) {
          const mapped = {
            ...friendRequestFromRow(row),
            requesting_family_name: familyNames.get(row.requestingFamilyId) ?? "Unknown family",
            requesting_profile_name: row.requestingProfileId ? profileNames.get(row.requestingProfileId) ?? null : null,
            target_family_name: familyNames.get(row.targetFamilyId) ?? "Unknown family",
            target_profile_name: row.targetProfileId ? profileNames.get(row.targetProfileId) ?? null : null,
          };
          for (const familyId of [row.requestingFamilyId, row.targetFamilyId]) {
            const entries = requestsByFamily.get(familyId) ?? [];
            entries.push(mapped);
            requestsByFamily.set(familyId, entries);
          }
        }
        const totalItems = Number(itemCountRows[0]?.count ?? 0);
        return familyRows.map((family) => {
          const relatedProfiles = profileRows.filter((profile) => profile.familyId === family.id);
          const requests = requestsByFamily.get(family.id) ?? [];
          return {
            id: family.id, display_name: family.name, created_at: family.createdAt,
            email: family.email, role: family.role, is_active: family.isActive,
            profile_count: relatedProfiles.length,
            accepted_request_count: requests.filter((row) => row.status === "accepted").length,
            pending_incoming_count: requests.filter((row) => row.status === "pending" && row.target_family_id === family.id).length,
            pending_outgoing_count: requests.filter((row) => row.status === "pending" && row.requesting_family_id === family.id).length,
            rejected_request_count: requests.filter((row) => row.status === "rejected").length,
            profiles: relatedProfiles.map((profile) => {
              const completions = progressByProfile.get(profile.id) ?? [];
              const attempts = attemptsByProfile.get(profile.id) ?? [];
              return {
                id: profile.id, name: profile.name, emoji: profile.emoji, color: profile.color,
                public_id: profile.publicId, created_at: profile.createdAt,
                total_done: completions.length,
                badge_count: deriveBadges(profile.id, completions.map((row) => ({
                  item_id: row.itemId, category: row.category, done_at: row.doneAt,
                })), attempts.map((row) => ({
                  item_id: row.itemId, score: row.score, total: row.total, completed_at: row.completedAt,
                }))).length,
                total_items: totalItems,
                completion_rate: totalItems ? completions.length / totalItems * 100 : 0,
                recent_activities: completions.slice(0, 8).map((row) => ({
                  item_id: row.itemId,
                  item_title: itemTitles.get(row.itemId) ?? "(unknown item)",
                  item_category: itemCategories.get(row.itemId) ?? row.category,
                  completed_at: row.doneAt,
                })),
              };
            }),
            friend_requests: requests,
          };
        });
      },

      async assessments(): Promise<AdminAssessmentSummaryRecord[]> {
        const questionRows = await orm.select().from(quizQuestions)
          .where(and(eq(quizQuestions.isActive, true), usefulQuestion)).orderBy(asc(quizQuestions.itemId));
        const itemIds = [...new Set(questionRows.map((row) => row.itemId))];
        if (!itemIds.length) return [];
        const [itemRows, titles, attemptRows] = await Promise.all([
          orm.select({ id: items.id, category: items.category, countryCode: items.countryCode,
            createdAt: items.createdAt }).from(items).where(inArray(items.id, itemIds))
            .orderBy(desc(items.createdAt)),
          orm.select({ itemId: itemTranslations.itemId, lang: itemTranslations.lang,
            title: itemTranslations.title }).from(itemTranslations)
            .where(inArray(itemTranslations.itemId, itemIds)).orderBy(asc(itemTranslations.lang)),
          orm.select({ itemId: quizAttempts.itemId, profileId: quizAttempts.profileId,
            score: quizAttempts.score, total: quizAttempts.total, completedAt: quizAttempts.completedAt })
            .from(quizAttempts).where(inArray(quizAttempts.itemId, itemIds)),
        ]);
        const preferredTitles = new Map<string, string>();
        for (const row of titles) {
          if (!preferredTitles.has(row.itemId) || row.lang === "en") preferredTitles.set(row.itemId, row.title);
        }
        return itemRows.map((item) => assessmentSummary(
          item, preferredTitles.get(item.id) ?? "(untitled)",
          questionRows.filter((question) => question.itemId === item.id),
          attemptRows.filter((attempt) => attempt.itemId === item.id),
        ));
      },

      async assessment(itemId): Promise<AdminAssessmentDetailRecord | null> {
        const [itemRows, questions] = await Promise.all([
          orm.select({ id: items.id, category: items.category, countryCode: items.countryCode,
            createdAt: items.createdAt }).from(items).where(eq(items.id, itemId)).limit(1),
          orm.select().from(quizQuestions).where(and(eq(quizQuestions.itemId, itemId), eq(quizQuestions.isActive, true), usefulQuestion))
            .orderBy(asc(quizQuestions.lang), asc(quizQuestions.sortOrder)),
        ]);
        const item = itemRows[0];
        if (!item || !questions.length) return null;
        const [titles, attempts] = await Promise.all([
          orm.select({ lang: itemTranslations.lang, title: itemTranslations.title })
            .from(itemTranslations).where(eq(itemTranslations.itemId, itemId))
            .orderBy(asc(itemTranslations.lang)),
          orm.select({ profileId: quizAttempts.profileId, score: quizAttempts.score,
            total: quizAttempts.total, completedAt: quizAttempts.completedAt })
            .from(quizAttempts).where(eq(quizAttempts.itemId, itemId)),
        ]);
        const profileIds = [...new Set(attempts.map((attempt) => attempt.profileId))];
        const participantRows = profileIds.length ? await orm.select({
          id: profiles.id, name: profiles.name, emoji: profiles.emoji, color: profiles.color,
          publicId: profiles.publicId, familyId: profiles.familyId, familyName: families.displayName,
        }).from(profiles).innerJoin(families, eq(families.id, profiles.familyId))
          .where(inArray(profiles.id, profileIds)) : [];
        return {
          ...assessmentSummary(item, titles.find((row) => row.lang === "en")?.title
            ?? titles[0]?.title ?? "(untitled)", questions, attempts),
          questions: questions.map((question) => ({
            id: question.id, item_id: question.itemId, question_group_id: question.questionGroupId,
            lang: question.lang, question_type: question.questionType, question: question.question,
            options: storedStringArray(question.options), correct_answers: storedNumberArray(question.correctAnswers),
            sort_order: question.sortOrder, is_active: question.isActive, created_at: question.createdAt,
          })),
          performance: assessmentPerformance(attempts, participantRows),
        };
      },

      async quizQuestions(itemId) {
        const rows = await orm.select().from(quizQuestions)
          .where(and(eq(quizQuestions.itemId, itemId), eq(quizQuestions.isActive, true), usefulQuestion))
          .orderBy(asc(quizQuestions.lang), asc(quizQuestions.sortOrder), asc(quizQuestions.id));
        return rows.map((row) => ({
          id: row.id, item_id: row.itemId, question_group_id: row.questionGroupId,
          lang: row.lang, question_type: row.questionType, question: row.question,
          options: storedStringArray(row.options), correct_answers: storedNumberArray(row.correctAnswers),
          sort_order: row.sortOrder, is_active: row.isActive, created_at: row.createdAt,
        }));
      },

      async createQuizQuestion(itemId, input) {
        const id = randomUUID();
        const [row] = await orm.insert(quizQuestions).values({
          id, itemId, questionGroupId: input.question_group_id ?? null, lang: input.lang, question: input.question,
          questionType: input.question_type, options: input.options,
          correctAnswers: input.correct_answers, sortOrder: input.sort_order,
          isActive: input.is_active,
        }).returning();
        if (!row) throw new AppError(500, "QUIZ_QUESTION_CREATE_FAILED", "Quiz question could not be created.");
        return {
          id: row.id, item_id: row.itemId, question_group_id: row.questionGroupId,
          lang: row.lang, question_type: row.questionType, question: row.question,
          options: storedStringArray(row.options), correct_answers: storedNumberArray(row.correctAnswers),
          sort_order: row.sortOrder, is_active: row.isActive, created_at: row.createdAt,
        };
      },

      async deleteQuizQuestion(questionId) {
        const deleted = await orm.update(quizQuestions).set({ isActive: false })
          .where(and(eq(quizQuestions.id, questionId), eq(quizQuestions.isActive, true)))
          .returning({ id: quizQuestions.id });
        return deleted.length > 0;
      },

      async flashcards(itemId) {
        const rows = await orm.select().from(flashcards)
          .where(eq(flashcards.itemId, itemId))
          .orderBy(asc(flashcards.lang), asc(flashcards.sortOrder), asc(flashcards.id));
        return rows.map((row) => ({
          id: row.id, item_id: row.itemId, lang: row.lang, front: row.front, back: row.back,
          media_hint: row.mediaHint, sort_order: row.sortOrder, is_published: row.isPublished,
          source_type: row.sourceType, created_at: row.createdAt, updated_at: row.updatedAt,
        }));
      },

      async createFlashcard(itemId, input) {
        const id = randomUUID();
        const [row] = await orm.insert(flashcards).values({
          id, itemId, lang: input.lang, front: input.front, back: input.back,
          mediaHint: input.media_hint ?? null, sortOrder: input.sort_order,
          isPublished: input.is_published, sourceType: input.source_type,
        }).returning();
        if (!row) throw new AppError(500, "FLASHCARD_CREATE_FAILED", "Flashcard could not be created.");
        return {
          id: row.id, item_id: row.itemId, lang: row.lang, front: row.front, back: row.back,
          media_hint: row.mediaHint, sort_order: row.sortOrder, is_published: row.isPublished,
          source_type: row.sourceType, created_at: row.createdAt, updated_at: row.updatedAt,
        };
      },

      async updateFlashcard(flashcardId, input) {
        const [row] = await orm.update(flashcards).set({
          ...(input.lang === undefined ? {} : { lang: input.lang }),
          ...(input.front === undefined ? {} : { front: input.front }),
          ...(input.back === undefined ? {} : { back: input.back }),
          ...(input.media_hint === undefined ? {} : { mediaHint: input.media_hint }),
          ...(input.sort_order === undefined ? {} : { sortOrder: input.sort_order }),
          ...(input.is_published === undefined ? {} : { isPublished: input.is_published }),
          ...(input.source_type === undefined ? {} : { sourceType: input.source_type }),
          updatedAt: new Date(),
        }).where(eq(flashcards.id, flashcardId)).returning();
        if (!row) return null;
        return {
          id: row.id, item_id: row.itemId, lang: row.lang, front: row.front, back: row.back,
          media_hint: row.mediaHint, sort_order: row.sortOrder, is_published: row.isPublished,
          source_type: row.sourceType, created_at: row.createdAt, updated_at: row.updatedAt,
        };
      },

      async deleteFlashcard(flashcardId) {
        const deleted = await orm.delete(flashcards).where(eq(flashcards.id, flashcardId)).returning({ id: flashcards.id });
        return deleted.length > 0;
      },
    },

    items: {
      async canReadMedia(familyId, key, isAdmin = false) {
        const profileAudience = sql<boolean>`EXISTS (SELECT 1 FROM ${lessonAudiences}
          INNER JOIN ${profiles} ON ${profiles.id} = ${lessonAudiences.targetProfileId}
          WHERE ${lessonAudiences.itemId} = ${items.id}
            AND ${profiles.familyId} = ${familyId})`;
        const rows = await orm.select({ id: itemMedia.id }).from(itemMedia)
          .innerJoin(items, eq(items.id, itemMedia.itemId))
          .where(and(
            or(eq(itemMedia.filename, key), eq(itemMedia.filename, `/media/${key}`)),
            isAdmin ? sql<boolean>`true` : and(
              eq(items.isPublished, true),
              or(visibleItemCondition(familyId), profileAudience),
            ),
          )).limit(1);
        return rows.length > 0;
      },

      async list(input) {
        const category = input.category?.trim().toLowerCase();
        if (category && !CATEGORIES.has(category)) return [];
        return cachedCatalog.list({ familyId: input.familyId, ...(input.profileId ? { profileId: input.profileId } : {}),
          ...(category ? { category } : {}), limit: boundedLimit(input.limit, DEFAULT_ITEM_LIMIT, MAX_ITEM_LIMIT) });
      },

      async get(itemId, lang, familyId, profileId) {
        const rows = await orm
          .select({
            id: items.id,
            category: items.category,
            latitude: items.latitude,
            longitude: items.longitude,
            countryCode: items.countryCode,
            iconSlug: items.iconSlug,
            recipe: items.recipe,
            locationDesc: items.locationDesc,
            funFacts: items.funFacts,
            audioUrls: items.audioUrls,
            youtubeUrl: items.youtubeUrl,
            trailerUrl: items.trailerUrl,
            characters: items.characters,
            startYear: items.startYear,
            endYear: items.endYear,
            timePrecision: items.timePrecision,
            releasedDate: items.releasedDate,
            richFields: items.richFields,
            franchiseId: items.franchiseId,
            quizRequired: items.quizRequired,
          })
          .from(items)
          .where(and(eq(items.id, itemId), eq(items.isPublished, true), visibleItemCondition(familyId, profileId)))
          .limit(1);
        const row = rows[0];
        if (!row) return null;

        const translations = await orm
          .select({
            lang: itemTranslations.lang,
            title: itemTranslations.title,
            description: itemTranslations.description,
            history: itemTranslations.history,
          })
          .from(itemTranslations)
          .where(eq(itemTranslations.itemId, itemId))
          .orderBy(asc(itemTranslations.lang));
        const media = await orm
          .select({
            id: itemMedia.id,
            mediaType: itemMedia.mediaType,
            label: itemMedia.label,
            filename: itemMedia.filename,
            lang: itemMedia.lang,
            sortOrder: itemMedia.sortOrder,
          })
          .from(itemMedia)
          .where(eq(itemMedia.itemId, itemId))
          .orderBy(asc(itemMedia.sortOrder));
        const activeQuestion = await orm
          .select({ id: quizQuestions.id })
          .from(quizQuestions)
          .where(and(eq(quizQuestions.itemId, itemId), eq(quizQuestions.isActive, true), usefulQuestion))
          .limit(1);

        let siblings: { id: string; title: string }[] = [];
        if (row.franchiseId) {
          const siblingRows = await orm
            .select({ id: items.id })
            .from(items)
            .where(and(
              eq(items.franchiseId, row.franchiseId),
              sql`${items.id} <> ${itemId}`,
              eq(items.isPublished, true),
              visibleItemCondition(familyId, profileId),
            ));
          const siblingIds = siblingRows.map((value) => value.id);
          if (siblingIds.length) {
            const siblingTranslations = await orm
              .select({ itemId: itemTranslations.itemId, lang: itemTranslations.lang, title: itemTranslations.title })
              .from(itemTranslations)
              .where(inArray(itemTranslations.itemId, siblingIds))
              .orderBy(asc(itemTranslations.lang));
            const byItem = new Map<string, { lang: string; title: string }[]>();
            for (const translation of siblingTranslations) {
              const values = byItem.get(translation.itemId) ?? [];
              values.push(translation);
              byItem.set(translation.itemId, values);
            }
            siblings = siblingRows.map((value) => {
              const options = byItem.get(value.id) ?? [];
              return { id: value.id, title: options.find((entry) => entry.lang === "en")?.title ?? options[0]?.title ?? "Untitled" };
            });
          }
        }

        return itemDetailFromRows(
          { ...row, hasQuiz: Boolean(activeQuestion[0]) },
          translations,
          media,
          siblings,
          (lang.trim().toLowerCase() || "en").slice(0, 8),
        );
      },

      async listAdmin(limit) {
        const rows = await orm.select({
          id: items.id, category: items.category, isPublished: items.isPublished, createdAt: items.createdAt,
        }).from(items).orderBy(desc(items.createdAt), asc(items.id))
          .limit(boundedLimit(limit, DEFAULT_ITEM_LIMIT, MAX_ITEM_LIMIT));
        if (!rows.length) return [];
        const titles = await orm.select({
          itemId: itemTranslations.itemId, lang: itemTranslations.lang, title: itemTranslations.title,
        }).from(itemTranslations).where(and(
          inArray(itemTranslations.itemId, rows.map((row) => row.id)),
          inArray(itemTranslations.lang, ["en", "vi"]),
        )).limit(rows.length * 2);
        const byItem = new Map<string, { en?: string; vi?: string }>();
        for (const title of titles) {
          const entry = byItem.get(title.itemId) ?? {};
          if (title.lang === "en") entry.en = title.title;
          if (title.lang === "vi") entry.vi = title.title;
          byItem.set(title.itemId, entry);
        }
        return rows.map((row) => ({
          id: row.id, category: row.category, is_published: row.isPublished,
          ...(byItem.get(row.id)?.en ? { title_en: byItem.get(row.id)!.en } : {}),
          ...(byItem.get(row.id)?.vi ? { title_vi: byItem.get(row.id)!.vi } : {}),
          created_at: row.createdAt,
        }));
      },

      getAdmin: (itemId, ownerFamilyId) => catalogDetail(itemId, ownerFamilyId
        ? and(eq(items.id,itemId),eq(items.sourceType,'custom'),eq(items.ownerFamilyId,ownerFamilyId))!
        : eq(items.id,itemId)),
      async getParent(itemId, familyId) {
        const item = await catalogDetail(itemId, and(eq(items.id,itemId), or(
        and(eq(items.sourceType,'system'),eq(items.isPublished,true)),
        eq(items.ownerFamilyId,familyId),
        sql`EXISTS (SELECT 1 FROM ${lessonAudiences} a LEFT JOIN ${profiles} target ON target.id=a.target_profile_id
          WHERE a.item_id=${items.id} AND (a.target_family_id=${familyId} OR target.family_id=${familyId}))`
      ))!);
        if (!item) return null;
        const disabled = item.source_type === 'system' ? await orm.select({itemId:familyDisabledLessons.itemId})
          .from(familyDisabledLessons).where(and(eq(familyDisabledLessons.familyId,familyId),eq(familyDisabledLessons.itemId,itemId))).limit(1) : [];
        return {...item,can_edit:item.source_type==='custom' && item.owner_family_id===familyId,is_disabled_for_family:disabled.length>0};
      },

      async updateBatch(input: UpdateCatalogItemInput[], ownerFamilyId?: string): Promise<CreatedCatalogItemRecord[]> {
        return orm.transaction(async (tx) => {
          const updated: CreatedCatalogItemRecord[] = [];
          for (const value of input) {
            const existingRows = await tx
              .select({
                category: items.category,
                isPublished: items.isPublished,
                quizRequired: items.quizRequired,
              })
              .from(items)
              .where(ownerFamilyId ? and(eq(items.id, value.id), eq(items.sourceType, "custom"), eq(items.ownerFamilyId, ownerFamilyId)) : eq(items.id, value.id))
              .limit(1);
            const existing = existingRows[0];
            if (!existing) throw new AppError(404, "ITEM_NOT_FOUND", `Item ${value.id} was not found.`);

            const changes: Partial<typeof items.$inferInsert> = { updatedAt: new Date() };
            if (value.category !== undefined) changes.category = value.category;
            if (value.latitude !== undefined) changes.latitude = value.latitude;
            if (value.longitude !== undefined) changes.longitude = value.longitude;
            if (value.country_code !== undefined) changes.countryCode = value.country_code;
            if (value.icon_slug !== undefined) changes.iconSlug = value.icon_slug;
            if (value.is_published !== undefined) changes.isPublished = value.is_published;
            if (value.recipe !== undefined) changes.recipe = value.recipe;
            if (value.location_desc !== undefined) changes.locationDesc = value.location_desc;
            if (value.fun_facts !== undefined) changes.funFacts = value.fun_facts;
            if (value.audio_urls !== undefined) changes.audioUrls = value.audio_urls;
            if (value.youtube_url !== undefined) changes.youtubeUrl = value.youtube_url;
            if (value.trailer_url !== undefined) changes.trailerUrl = value.trailer_url;
            if (value.characters !== undefined) changes.characters = value.characters;
            if (value.start_year !== undefined) changes.startYear = value.start_year;
            if (value.end_year !== undefined) changes.endYear = value.end_year;
            if (value.time_precision !== undefined) changes.timePrecision = value.time_precision;
            if (value.released_date !== undefined) changes.releasedDate = value.released_date;
            if (value.rich_fields !== undefined) changes.richFields = value.rich_fields;
            if (value.franchise_id !== undefined) changes.franchiseId = value.franchise_id;
            if (value.quiz_required !== undefined) changes.quizRequired = value.quiz_required;
            await tx.update(items).set(changes).where(ownerFamilyId
              ? and(eq(items.id, value.id), eq(items.sourceType, "custom"), eq(items.ownerFamilyId, ownerFamilyId))
              : eq(items.id, value.id));

            if (value.translations !== undefined) {
              await tx.delete(itemTranslations).where(eq(itemTranslations.itemId, value.id));
              await tx.insert(itemTranslations).values(value.translations.map((translation) => ({
                id: randomUUID(),
                itemId: value.id,
                lang: translation.lang,
                title: translation.title,
                description: translation.description ?? null,
                history: translation.history ?? null,
              })));
            }
            if (value.media !== undefined) {
              await tx.delete(itemMedia).where(eq(itemMedia.itemId, value.id));
              if (value.media.length > 0) {
                await tx.insert(itemMedia).values(value.media.map((media) => ({
                  id: randomUUID(),
                  itemId: value.id,
                  mediaType: media.media_type,
                  label: media.label ?? null,
                  lang: media.lang ?? null,
                  filename: media.filename,
                  sortOrder: media.sort_order,
                })));
              }
            }
            if (value.quiz_questions !== undefined) {
              await tx.update(quizQuestions).set({ isActive: false })
                .where(eq(quizQuestions.itemId, value.id));
              if (value.quiz_questions.length > 0) {
                await tx.insert(quizQuestions).values(value.quiz_questions.map((question) => ({
                  id: randomUUID(),
                  itemId: value.id,
                  questionGroupId: question.question_group_id ?? null,
                  lang: question.lang,
                  question: question.question,
                  questionType: question.question_type,
                  options: question.options,
                  correctAnswers: question.correct_answers,
                  sortOrder: question.sort_order,
                  isActive: true,
                })));
              }
            }

            const finalRows = await tx
              .select({
                category: items.category,
                isPublished: items.isPublished,
                quizRequired: items.quizRequired,
              })
              .from(items)
              .where(eq(items.id, value.id))
              .limit(1);
            const final = finalRows[0] ?? {
              category: value.category ?? existing.category,
              isPublished: value.is_published ?? existing.isPublished,
              quizRequired: value.quiz_required ?? existing.quizRequired,
            };
            const translationCount = await tx
              .select({ count: sql<number>`count(*)` })
              .from(itemTranslations)
              .where(eq(itemTranslations.itemId, value.id));
            const mediaCount = await tx
              .select({ count: sql<number>`count(*)` })
              .from(itemMedia)
              .where(eq(itemMedia.itemId, value.id));
            const quizQuestionCount = await tx
              .select({ count: sql<number>`count(*)` })
              .from(quizQuestions)
              .where(and(eq(quizQuestions.itemId, value.id), eq(quizQuestions.isActive, true), usefulQuestion));
            updated.push({
              id: value.id,
              category: final.category,
              is_published: final.isPublished,
              quiz_required: final.quizRequired,
              translation_count: Number(translationCount[0]?.count ?? 0),
              media_count: Number(mediaCount[0]?.count ?? 0),
              quiz_question_count: Number(quizQuestionCount[0]?.count ?? 0),
            });
          }
          return updated;
        });
      },

      async deleteAdmin(itemId) {
        const deleted = await orm.delete(items).where(eq(items.id, itemId)).returning({ id: items.id });
        return deleted.length > 0;
      },

      async create(input: CreateCatalogItemInput, options?: { ownerFamilyId: string; targetProfileId?: string }): Promise<CreatedCatalogItemRecord> {
        const itemId = input.id ?? randomUUID();
        try {
          await orm.transaction(async (tx) => {
            await tx.insert(items).values({
              id: itemId,
              category: input.category,
              latitude: input.latitude,
              longitude: input.longitude,
              countryCode: input.country_code ?? null,
              iconSlug: input.icon_slug ?? null,
              isPublished: input.is_published,
              sourceType: options ? "custom" : "system",
              ownerFamilyId: options?.ownerFamilyId ?? null,
              recipe: input.recipe ?? null,
              locationDesc: input.location_desc ?? null,
              funFacts: input.fun_facts ?? null,
              audioUrls: input.audio_urls ?? null,
              youtubeUrl: input.youtube_url ?? null,
              trailerUrl: input.trailer_url ?? null,
              characters: input.characters ?? null,
              startYear: input.start_year ?? null,
              endYear: input.end_year ?? null,
              timePrecision: input.time_precision ?? null,
              releasedDate: input.released_date ?? null,
              richFields: input.rich_fields ?? null,
              franchiseId: input.franchise_id ?? null,
              quizRequired: input.quiz_required,
            });

            if (input.translations.length > 0) {
              await tx.insert(itemTranslations).values(input.translations.map((translation) => ({
                id: randomUUID(),
                itemId,
                lang: translation.lang,
                title: translation.title,
                description: translation.description ?? null,
                history: translation.history ?? null,
              })));
            }

            if (input.media.length > 0) {
              await tx.insert(itemMedia).values(input.media.map((media) => ({
                id: randomUUID(),
                itemId,
                mediaType: media.media_type,
                label: media.label ?? null,
                lang: media.lang ?? null,
                filename: media.filename,
                sortOrder: media.sort_order,
              })));
            }

            if (input.quiz_questions.length > 0) {
              await tx.insert(quizQuestions).values(input.quiz_questions.map((question) => ({
                id: randomUUID(),
                itemId,
                questionGroupId: question.question_group_id ?? null,
                lang: question.lang,
                question: question.question,
                questionType: question.question_type,
                options: question.options,
                correctAnswers: question.correct_answers,
                sortOrder: question.sort_order,
                isActive: true,
              })));
            }
            if (options) {
              if (options.targetProfileId) {
                const target = await tx.select({ id: profiles.id }).from(profiles)
                  .where(and(eq(profiles.id, options.targetProfileId), eq(profiles.familyId, options.ownerFamilyId)))
                  .limit(1);
                if (!target[0]) throw new AppError(422, "TARGET_PROFILE_NOT_OWNED", "The target profile does not belong to this family.");
              }
              await tx.insert(lessonAudiences).values({
                id: randomUUID(), itemId, grantedByFamilyId: options.ownerFamilyId,
                targetFamilyId: options.targetProfileId ? null : options.ownerFamilyId,
                targetProfileId: options.targetProfileId ?? null,
              });
            }
          });
        } catch (caught) {
          if (isCatalogItemConflict(caught)) {
            throw new AppError(409, "ITEM_ALREADY_EXISTS", "An item with this id already exists.");
          }
          throw caught;
        }
        return {
          id: itemId,
          category: input.category,
          is_published: input.is_published,
          quiz_required: input.quiz_required,
          translation_count: input.translations.length,
          media_count: input.media.length,
          quiz_question_count: input.quiz_questions.length,
        };
      },
    },

    flashcards: {
      async getOptions(itemId, lang, familyId, profileId) {
        const focus = await loadFocusItem(orm, itemId, familyId, profileId);
        if (!focus) return null;
        const options = [];
        for (const descriptor of buildThemeDescriptors(focus)) {
          const candidates = await loadThemeCandidates(orm, focus, descriptor, familyId, profileId);
          const cardsByItem = await loadPreferredCards(orm, candidates, lang);
          const contributing = candidates.filter((candidate) => (cardsByItem.get(candidate.id)?.length ?? 0) > 0);
          const availableCards = contributing.reduce(
            (total, candidate) => total + (cardsByItem.get(candidate.id)?.length ?? 0),
            0,
          );
          if (availableCards >= descriptor.min_cards) options.push({
            theme_type: descriptor.theme_type,
            theme_value: descriptor.theme_value,
            title: descriptor.title,
            description: descriptor.description,
            available_cards: availableCards,
            item_count: contributing.length,
          });
        }
        return options;
      },

      async getDeck(profileId, itemId, lang, themeType, themeValue, familyId) {
        return buildStoredDeck(orm, profileId, itemId, lang, themeType, themeValue, familyId);
      },

      async createStudySession(profileId, input, familyId) {
        if (
          input.viewed_flashcard_ids.length < 1
          || input.viewed_flashcard_ids.length > 15
          || input.responses.length > 15
          || (input.focus_item_id !== undefined && (input.focus_item_id.length < 1 || input.focus_item_id.length > 128))
          || !(["item", "country", "continent", "era", "category"] as const).includes(input.theme_type)
          || input.theme_value.length < 1
          || input.theme_value.length > 128
          || !/^[a-z]{2,8}$/.test(input.lang)
          || input.viewed_flashcard_ids.some((id) => id.length < 1 || id.length > 128)
          || input.responses.some((value) => (
            value.flashcard_id.length < 1
            || value.flashcard_id.length > 128
            || (value.rating !== "got_it" && value.rating !== "review_again")
          ))
        ) {
          throw new AppError(422, "INVALID_FLASHCARD_SESSION", "Flashcard study session input is invalid.");
        }
        const derived = deriveStudySession(input);
        return orm.transaction(async (tx) => {
          if (input.focus_item_id) {
            const deck = await buildStoredDeck(
              tx,
              profileId,
              input.focus_item_id,
              input.lang,
              input.theme_type,
              input.theme_value,
              familyId,
            );
            if (!deck) throw new AppError(422, "INVALID_FLASHCARD_SESSION", "The focus item is not published.");
            assertCanonicalDeckMembership(input.viewed_flashcard_ids, deck.cards);
          } else {
            if (input.theme_type === "item") {
              throw new AppError(422, "INVALID_FLASHCARD_SESSION", "An item deck requires a focus item.");
            }
            const canonicalDeck = await buildCanonicalThemeDeck(
              tx,
              profileId,
              input.lang,
              input.theme_type,
              input.theme_value,
              familyId,
            );
            assertCanonicalDeckMembership(input.viewed_flashcard_ids, canonicalDeck);
          }

          const id = randomUUID();
          await tx.insert(flashcardStudySessions).values({
            id,
            profileId,
            focusItemId: input.focus_item_id ?? null,
            themeType: input.theme_type,
            themeValue: input.theme_value,
            lang: input.lang,
            cardsShown: derived.cards_shown,
            gotItCount: derived.got_it_count,
            reviewAgainCount: derived.review_again_count,
            responses: input.responses,
            startedAt: derived.started_at,
            completedAt: derived.completed_at,
          });
          return {
            id,
            profile_id: profileId,
            ...(input.focus_item_id ? { focus_item_id: input.focus_item_id } : {}),
            theme_type: input.theme_type,
            theme_value: input.theme_value,
            lang: input.lang,
            cards_shown: derived.cards_shown,
            got_it_count: derived.got_it_count,
            review_again_count: derived.review_again_count,
            responses: input.responses,
            started_at: derived.started_at,
            completed_at: derived.completed_at,
          };
        }, { isolationLevel: "repeatable read" });
      },
    },

    quiz: {
      async getItemQuiz(itemId, lang, familyId, profileId) {
        const published = await orm
          .select({ id: items.id })
          .from(items)
          .where(and(eq(items.id, itemId), eq(items.isPublished, true), visibleItemCondition(familyId, profileId)))
          .limit(1);
        if (!published[0]) return null;
        const selectedLanguage = await chooseStoredQuestionLanguage(orm, itemId, lang);
        if (!selectedLanguage) return quizSet([]);
        return quizSet(await loadLanguageQuestions(orm, itemId, selectedLanguage));
      },

      async getItemStatus(profileId, itemId, familyId) {
        const visible = await orm
          .select({ id: items.id })
          .from(items)
          .where(and(eq(items.id, itemId), eq(items.isPublished, true), visibleItemCondition(familyId, profileId)))
          .limit(1);
        if (!visible[0]) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found.");
        const condition = and(eq(quizAttempts.profileId, profileId), eq(quizAttempts.itemId, itemId));
        const ratio = sql<number>`CASE WHEN ${quizAttempts.total} > 0 THEN ${quizAttempts.score}::numeric / ${quizAttempts.total} ELSE 0 END`;
        const [aggregateRows, bestRows, latestRows] = await Promise.all([
          orm
            .select({
              count: sql<number>`COUNT(*)::int`,
              passed: sql<boolean>`COALESCE(BOOL_OR(${quizAttempts.total} > 0 AND ${quizAttempts.score}::numeric / NULLIF(${quizAttempts.total}, 0) >= 0.8), false)`,
            })
            .from(quizAttempts)
            .where(condition),
          orm
            .select({ score: quizAttempts.score, total: quizAttempts.total })
            .from(quizAttempts)
            .where(condition)
            .orderBy(desc(ratio), asc(quizAttempts.completedAt), asc(quizAttempts.id))
            .limit(1),
          orm
            .select({ score: quizAttempts.score, total: quizAttempts.total })
            .from(quizAttempts)
            .where(condition)
            .orderBy(desc(quizAttempts.completedAt), desc(quizAttempts.id))
            .limit(1),
        ]);
        const aggregate = aggregateRows[0];
        const best = bestRows[0];
        const latest = latestRows[0];
        if (!aggregate || aggregate.count === 0 || !best || !latest) {
          return { attempt_count: 0, passed: false, best_score: 0, best_total: 0, latest_score: 0, latest_total: 0 };
        }
        return {
          attempt_count: aggregate.count,
          passed: aggregate.passed,
          best_score: best.score,
          best_total: best.total,
          latest_score: latest.score,
          latest_total: latest.total,
        };
      },

      async submitItem(profileId, itemId, answers, familyId) {
        const visible = await orm
          .select({ id: items.id })
          .from(items)
          .where(and(eq(items.id, itemId), eq(items.isPublished, true), visibleItemCondition(familyId, profileId)))
          .limit(1);
        if (!visible[0]) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found.");
        assertAnswerableQuizSize(answers.length);
        return orm.transaction(async (tx) => {
          const itemRows = await tx
            .select({ category: items.category })
            .from(items)
            .where(and(eq(items.id, itemId), eq(items.isPublished, true), visibleItemCondition(familyId, profileId)))
            .limit(1);
          if (!itemRows[0]) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found.");
          if (!answers.length) throw new AppError(422, "INVALID_QUIZ_ANSWERS", "At least one quiz answer is required.");

          const submittedIds = [...new Set(answers.map((answer) => answer.question_id))];
          const matchingRows = await tx
            .select({ ...questionSelection })
            .from(quizQuestions)
            .where(and(
              eq(quizQuestions.itemId, itemId),
              eq(quizQuestions.isActive, true), usefulQuestion,
              inArray(quizQuestions.id, submittedIds),
            ))
            .limit(MAX_QUIZ_QUESTIONS + 1);
          const matching = matchingRows.map(parseQuizQuestionRecord);
          if (matching.some((question) => question === null)) {
            throw new AppError(422, "QUIZ_UNAVAILABLE", "This quiz contains invalid active questions.");
          }
          const languages = [...new Set((matching as QuizQuestionRecord[]).map((question) => question.lang))];
          const servedQuestions = languages.length === 1
            ? await loadLanguageQuestions(tx, itemId, languages[0]!)
            : [];
          const graded = gradeQuizAnswers(servedQuestions, answers, 0.8);
          await tx.insert(quizAttempts).values({
            id: randomUUID(),
            profileId,
            itemId,
            attemptDate: new Date(),
            score: graded.score,
            total: graded.total,
            answers: graded.answers,
          });
          if (graded.passed) {
            await tx
              .insert(profileProgress)
              .values({ id: randomUUID(), profileId, itemId, category: itemRows[0]!.category })
              .onConflictDoNothing({ target: [profileProgress.profileId, profileProgress.itemId] });
          }
          return { score: graded.score, total: graded.total, passed: graded.passed, new_badges: [] };
        }, { isolationLevel: "repeatable read" });
      },

      ...createDailyQuizRepository(pool, async (profileId, lang, familyId, snapshotItemIds = []) => {
        // Bound work per subject, rather than letting a long run of animal
        // lessons crowd every other learned subject out of the candidate pool.
        const ranked = orm.select({ id: items.id, category: items.category,
          position: sql<number>`row_number() over (partition by ${items.category} order by ${profileProgress.doneAt} desc, ${items.id} asc)`.as('position'),
        }).from(profileProgress).innerJoin(items, eq(items.id, profileProgress.itemId))
          .where(and(eq(profileProgress.profileId, profileId), eq(items.isPublished, true), visibleItemCondition(familyId, profileId))).as('daily_learned');
        const learned = await orm.select({ id: ranked.id, category: ranked.category }).from(ranked)
          .where(or(lte(ranked.position, 6), snapshotItemIds.length ? inArray(ranked.id, snapshotItemIds) : undefined))
          .orderBy(asc(ranked.position), asc(ranked.id)).limit(100);
        const result: DailyQuestion[] = [];
        for (const item of learned) {
          const language = await chooseStoredQuestionLanguage(orm, item.id, lang);
          if (!language) continue;
          for (const question of await loadLanguageQuestions(orm, item.id, language)) {
            if (question.correct_answers.length !== 1 || question.options.length < 2 || question.options.length > 4) continue;
            result.push({ ...question, subject: item.category, level: 'medium', question_type: 'single' });
          }
        }
        return { questions: result, learnedIds: learned.map(item => item.id) };
      }),
    },

    progress: {
      async list(familyId, profileId) {
        const profile = await orm
          .select({ id: profiles.id })
          .from(profiles)
          .where(and(eq(profiles.id, profileId), eq(profiles.familyId, familyId)))
          .limit(1);
        if (!profile[0]) return { done_item_ids: [], wip_item_ids: [] };
        const rows = await orm
          .select({ itemId: profileProgress.itemId })
          .from(profileProgress)
          .innerJoin(profiles, eq(profiles.id, profileProgress.profileId))
          .where(and(eq(profileProgress.profileId, profileId), eq(profiles.familyId, familyId)))
          .orderBy(desc(profileProgress.doneAt));
        return { done_item_ids: rows.map((row) => row.itemId), wip_item_ids: [] };
      },

      async listDetailed(familyId, profileId) {
        const rows = await orm
          .select({
            item_id: profileProgress.itemId,
            category: profileProgress.category,
            done_at: profileProgress.doneAt,
          })
          .from(profileProgress)
          .innerJoin(profiles, eq(profiles.id, profileProgress.profileId))
          .where(and(eq(profileProgress.profileId, profileId), eq(profiles.familyId, familyId)))
          .orderBy(desc(profileProgress.doneAt), desc(profileProgress.id))
          .limit(DEFAULT_ITEM_LIMIT);
        return rows;
      },

      async recentVisible(familyId, limit) {
        return orm
          .select({
            family_id: families.id,
            family_name: families.displayName,
            profile_id: profiles.id,
            profile_name: profiles.name,
            profile_emoji: profiles.emoji,
            profile_color: profiles.color,
            avatar_type: profiles.avatarType,
            avatar_url: profiles.avatarUrl,
            avatar_frame: profiles.avatarFrame,
            item_id: profileProgress.itemId,
            item_category: profileProgress.category,
            completed_at: profileProgress.doneAt,
          })
          .from(profileProgress)
          .innerJoin(profiles, eq(profiles.id, profileProgress.profileId))
          .innerJoin(families, eq(families.id, profiles.familyId))
          .where(or(
            eq(profiles.familyId, familyId),
            sql<boolean>`EXISTS (SELECT 1 FROM ${friendRequests}
              WHERE ${friendRequests.status} = 'accepted'
                AND (
                  (${friendRequests.requestingFamilyId} = ${familyId}
                    AND ${friendRequests.targetFamilyId} = ${profiles.familyId}
                    AND (${friendRequests.targetScope} = 'family'
                      OR (${friendRequests.targetScope} = 'profile' AND ${friendRequests.targetProfileId} = ${profiles.id})))
                  OR (${friendRequests.targetFamilyId} = ${familyId}
                    AND ${friendRequests.requestingFamilyId} = ${profiles.familyId}
                    AND (${friendRequests.requestingScope} = 'family'
                      OR (${friendRequests.requestingScope} = 'profile' AND ${friendRequests.requestingProfileId} = ${profiles.id})))
                ))`,
          ))
          .orderBy(desc(profileProgress.doneAt), desc(profileProgress.id))
          .limit(Math.min(Math.max(limit, 1), 50));
      },

      async badges(familyId, profileId) {
        const owned = await orm
          .select({ id: profiles.id })
          .from(profiles)
          .where(and(eq(profiles.id, profileId), eq(profiles.familyId, familyId)))
          .limit(1);
        if (!owned[0]) return [];
        const [completions, attempts] = await Promise.all([
          orm.select({
            item_id: profileProgress.itemId,
            category: profileProgress.category,
            done_at: profileProgress.doneAt,
          }).from(profileProgress)
            .where(eq(profileProgress.profileId, profileId))
            .orderBy(asc(profileProgress.doneAt), asc(profileProgress.id))
            .limit(10_000),
          orm.select({
            item_id: quizAttempts.itemId,
            score: quizAttempts.score,
            total: quizAttempts.total,
            completed_at: quizAttempts.completedAt,
          }).from(quizAttempts)
            .where(eq(quizAttempts.profileId, profileId))
            .orderBy(asc(quizAttempts.completedAt), asc(quizAttempts.id))
            .limit(10_000),
        ]);
        return deriveBadges(profileId, completions, attempts);
      },

      async get(familyId, profileId, itemId) {
        const rows = await orm
          .select({ itemId: profileProgress.itemId })
          .from(profileProgress)
          .innerJoin(profiles, eq(profiles.id, profileProgress.profileId))
          .where(and(
            eq(profileProgress.profileId, profileId),
            eq(profileProgress.itemId, itemId),
            eq(profiles.familyId, familyId),
          ))
          .limit(1);
        const profile = await orm
          .select({ id: profiles.id })
          .from(profiles)
          .where(and(eq(profiles.id, profileId), eq(profiles.familyId, familyId)))
          .limit(1);
        return { done: Boolean(profile[0] && rows[0]) };
      },

      async mark(familyId, profileId, itemId) {
        const profile = await orm
          .select({ id: profiles.id })
          .from(profiles)
          .where(and(eq(profiles.id, profileId), eq(profiles.familyId, familyId)))
          .limit(1);
        if (!profile[0]) return null;

        const item = await orm
          .select({ category: items.category, quizRequired: items.quizRequired })
          .from(items)
          .where(and(eq(items.id, itemId), eq(items.isPublished, true), visibleItemCondition(familyId, profileId)))
          .limit(1);
        if (!item[0]) return null;

        const selectedItem = item[0];
        return orm.transaction(async (tx) => {
          const existing = await tx
            .select({ id: profileProgress.id })
            .from(profileProgress)
            .where(and(eq(profileProgress.profileId, profileId), eq(profileProgress.itemId, itemId)))
            .limit(1);
          if (existing[0]) return { status: "done", already_done: true, newly_earned_badges: [] };

          const availableQuestions = selectedItem.quizRequired ? await tx.select({ id: quizQuestions.id }).from(quizQuestions)
            .where(and(eq(quizQuestions.itemId, itemId), eq(quizQuestions.isActive, true), usefulQuestion)).limit(1) : [];
          if (availableQuestions.length) {
            const passed = await tx
              .select({ id: quizAttempts.id })
              .from(quizAttempts)
              .where(and(
                eq(quizAttempts.profileId, profileId),
                eq(quizAttempts.itemId, itemId),
                gt(quizAttempts.total, 0),
                sql`${quizAttempts.score}::numeric / NULLIF(${quizAttempts.total}, 0) >= 0.8`,
              ))
              .limit(1);
            if (!passed[0]) return { status: "quiz_required", already_done: false, newly_earned_badges: [] };
          }

          // Serialize first-learning thresholds without taking game/Town row locks.
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${profileId},20261017))`);
          const beforeCount=Number((await tx.execute(sql`SELECT count(*) AS count FROM (
            SELECT item_id FROM town_learned_items WHERE profile_id=${profileId}
            UNION SELECT item_id FROM profile_progress WHERE profile_id=${profileId}
          ) learned`)).rows[0]!.count);
          const learned=await tx.execute(sql`INSERT INTO town_learned_items(profile_id,item_id) VALUES (${profileId},${itemId}) ON CONFLICT DO NOTHING RETURNING item_id`);
          const inserted = await tx
            .insert(profileProgress)
            .values({ id: randomUUID(), profileId, itemId, category: selectedItem.category })
            .onConflictDoNothing({ target: [profileProgress.profileId, profileProgress.itemId] })
            .returning({ id: profileProgress.id });
          if(learned.rows.length)for(const event of blueprintAdventures(beforeCount,beforeCount+1))await tx.execute(sql`INSERT INTO adventure_events(id,profile_id,event_key,game,kind,data)
            VALUES(${randomUUID()},${profileId},${event.key},${event.game},${event.kind},${JSON.stringify(event.data)}::jsonb)
            ON CONFLICT(profile_id,event_key) DO NOTHING`);
          if(inserted.length)await tx.execute(sql`INSERT INTO adventure_events(id,profile_id,event_key,game,kind,data)
            VALUES(${randomUUID()},${profileId},${`explore:${itemId}`},'explore','explore_learned',${JSON.stringify({itemId})}::jsonb)
            ON CONFLICT(profile_id,event_key) DO NOTHING`);
          return { status: "done", already_done: inserted.length === 0, newly_earned_badges: [] };
        });
      },

      async remove(familyId, profileId, itemId) {
        const result = await orm
          .delete(profileProgress)
          .where(and(
            eq(profileProgress.profileId, profileId),
            eq(profileProgress.itemId, itemId),
            sql`EXISTS (SELECT 1 FROM profiles AS owner_profile WHERE owner_profile.id = ${profileProgress.profileId} AND owner_profile.family_id = ${familyId})`,
          ))
          .returning({ id: profileProgress.id });
        const profile = await orm
          .select({ id: profiles.id })
          .from(profiles)
          .where(and(eq(profiles.id, profileId), eq(profiles.familyId, familyId)))
          .limit(1);
        return Boolean(profile[0] && result.length > 0);
      },
    },
  };

  return database;
}

export * from "./schema.js";
