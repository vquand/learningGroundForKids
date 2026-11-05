import { VIETNAMESE_CHARACTERS } from '../ufo/letters.js';
import { sql } from "drizzle-orm";
import {
  boolean,
  bigint,
  bigserial,
  check,
  date,
  doublePrecision,
  smallint,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const createdTimestamp = (name: string) => timestamp(name, { withTimezone: true, mode: "date" }).notNull().defaultNow();

// These contain authored catalog/cluster materializations, never identity,
// sessions, progress or earned state. Authorization remains on every read.
export const exploreRevisions = pgTable('explore_revisions', {
  id: integer('id').primaryKey().default(1),
  catalogRevision: bigint('catalog_revision', { mode: 'bigint' }).notNull().default(sql`1`),
  visibilityRevision: bigint('visibility_revision', { mode: 'bigint' }).notNull().default(sql`1`),
}, table => ({ singleton: check('explore_revisions_singleton', sql`${table.id} = 1`) }));

export const exploreSnapshots = pgTable('explore_snapshots', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  catalogRevision: bigint('catalog_revision', { mode: 'bigint' }).notNull(),
  visibilityRevision: bigint('visibility_revision', { mode: 'bigint' }),
  payload: jsonb('payload').$type<unknown>().notNull(),
  payloadBytes: integer('payload_bytes').notNull(),
  createdAt: createdTimestamp('created_at'),
}, table => ({
  kindCreated: index('idx_explore_snapshots_kind_created').on(table.kind, table.createdAt),
  shape: check('explore_snapshots_shape', sql`${table.kind} IN ('common','view') AND char_length(${table.id}) = 64 AND (${table.kind} = 'common') = (${table.visibilityRevision} IS NULL)`),
  size: check('explore_snapshots_size', sql`${table.payloadBytes} BETWEEN 1 AND 8388608`),
}));

export const exploreRebuildJobs = pgTable('explore_rebuild_jobs', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  owner: text('owner').notNull(),
  fence: integer('fence').notNull().default(1),
  state: text('state').notNull(),
  leaseUntil: timestamp('lease_until', { withTimezone: true, mode: 'date' }).notNull(),
  updatedAt: createdTimestamp('updated_at'),
}, table => ({
  stateLease: index('idx_explore_jobs_state_lease').on(table.state, table.leaseUntil),
  shape: check('explore_jobs_shape', sql`${table.kind} IN ('common','view') AND ${table.state} IN ('running','ready','failed') AND ${table.fence} BETWEEN 1 AND 3 AND char_length(${table.id}) = 64`),
}));

export const achievementDefinitions = pgTable('achievement_definitions', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull(),
  definition: jsonb('definition').$type<import('../achievement-catalog.js').AchievementDefinition>().notNull(),
});

export const families = pgTable(
  "families",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    legalAcceptedAt: timestamp("legal_accepted_at", { withTimezone: true, mode: "date" }),
    legalAcceptedVersion: text("legal_accepted_version"),
    role: text("role").notNull().default("family"),
    isActive: boolean("is_active").notNull().default(true),
    // Historical families stay out of the new-family tutorial. Creation opts in.
    onboardingDismissed: boolean("onboarding_dismissed").notNull().default(true),
    onboardingParentVisited: boolean("onboarding_parent_visited").notNull().default(false),
    createdAt: createdTimestamp("created_at"),
    updatedAt: createdTimestamp("updated_at"),
  },
  (table) => ({
    emailUnique: uniqueIndex("families_email_unique").on(table.email),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    parentVerifiedUntil: timestamp("parent_verified_until", { withTimezone: true, mode: "date" }),
    parentVerifiedBy: text("parent_verified_by"),
    createdAt: createdTimestamp("created_at"),
  },
  (table) => ({
    tokenUnique: uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    familyExpiry: index("idx_sessions_family_expiry").on(table.familyId, table.expiresAt),
  }),
);

export const passkeys = pgTable("passkeys", {
  id: text("id").primaryKey(),
  familyId: text("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  publicKey: text("public_key").notNull(),
  counter: bigint("counter", { mode: "number" }).notNull().default(0),
  transports: jsonb("transports").$type<string[]>(),
  deviceType: text("device_type").notNull(),
  backedUp: boolean("backed_up").notNull(),
  createdAt: createdTimestamp("created_at"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
}, (table) => ({ familyCreated: index("idx_passkeys_family_created").on(table.familyId, table.createdAt) }));

export const passkeyChallenges = pgTable("passkey_challenges", {
  tokenHash: text("token_hash").primaryKey(),
  challenge: text("challenge").notNull(),
  purpose: text("purpose").notNull(),
  sessionHash: text("session_hash"),
  familyId: text("family_id").references(() => families.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: createdTimestamp("created_at"),
}, (table) => ({ expiry: index("idx_passkey_challenges_expiry").on(table.expiresAt) }));

export const familyPasswordAudit = pgTable(
  "family_password_audit",
  {
    id: text("id").primaryKey(),
    actorFamilyId: text("actor_family_id").notNull().references(() => families.id),
    targetFamilyId: text("target_family_id").notNull().references(() => families.id),
    reason: text("reason").notNull(),
    createdAt: createdTimestamp("created_at"),
  },
  (table) => ({
    targetCreated: index("idx_family_password_audit_target_created").on(table.targetFamilyId, table.createdAt),
  }),
);

export const profiles = pgTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emoji: text("emoji").notNull(),
    color: text("color").notNull(),
    publicId: text("public_id").notNull(),
    nativeCountryCode: text("native_country_code"),
    nativeCity: text("native_city"),
    avatarType: text("avatar_type"),
    avatarUrl: text("avatar_url"),
    avatarFrame: text("avatar_frame"),
    tourCompletedAt: timestamp("tour_completed_at", { withTimezone: true }),
    createdAt: createdTimestamp("created_at"),
    updatedAt: createdTimestamp("updated_at"),
  },
  (table) => ({
    publicIdUnique: uniqueIndex("profiles_public_id_unique").on(table.publicId),
    familyCreated: index("idx_profiles_family_created").on(table.familyId, table.createdAt),
  }),
);

export const friendRequests = pgTable(
  "friend_requests",
  {
    id: text("id").primaryKey(),
    requestingFamilyId: text("requesting_family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    requestingScope: text("requesting_scope").notNull(),
    requestingProfileId: text("requesting_profile_id").references(() => profiles.id, { onDelete: "cascade" }),
    requestingLabel: text("requesting_label").notNull(),
    targetFamilyId: text("target_family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    targetScope: text("target_scope").notNull(),
    targetProfileId: text("target_profile_id").references(() => profiles.id, { onDelete: "cascade" }),
    targetLabel: text("target_label").notNull(),
    targetCode: text("target_code").notNull(),
    requesterMessage: text("requester_message").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: createdTimestamp("created_at"),
    respondedAt: timestamp("responded_at", { withTimezone: true, mode: "date" }),
    respondedByFamilyId: text("responded_by_family_id").references(() => families.id, { onDelete: "set null" }),
  },
  (table) => ({
    pendingUnique: uniqueIndex("friend_requests_pending_unique")
      .using(
        "btree",
        sql`${table.requestingFamilyId}, coalesce(${table.requestingProfileId}, ''), ${table.requestingScope}, ${table.targetFamilyId}, coalesce(${table.targetProfileId}, ''), ${table.targetScope}`,
      )
      .where(sql`${table.status} = 'pending'`),
    participant: index("friend_requests_participant_idx").on(table.targetFamilyId, table.status, table.createdAt),
    requester: index("friend_requests_requester_idx").on(table.requestingFamilyId, table.status, table.createdAt),
    requestingScope: check("friend_requests_requesting_scope_check", sql`${table.requestingScope} IN ('profile', 'family')`),
    targetScope: check("friend_requests_target_scope_check", sql`${table.targetScope} IN ('profile', 'family')`),
    status: check("friend_requests_status_check", sql`${table.status} IN ('pending', 'accepted', 'rejected', 'cancelled')`),
    requestingShape: check(
      "friend_requests_requesting_scope_shape",
      sql`(${table.requestingScope} = 'profile' AND ${table.requestingProfileId} IS NOT NULL) OR (${table.requestingScope} = 'family' AND ${table.requestingProfileId} IS NULL)`,
    ),
    targetShape: check(
      "friend_requests_target_scope_shape",
      sql`(${table.targetScope} = 'profile' AND ${table.targetProfileId} IS NOT NULL) OR (${table.targetScope} = 'family' AND ${table.targetProfileId} IS NULL)`,
    ),
    crossFamily: check("friend_requests_cross_family", sql`${table.requestingFamilyId} <> ${table.targetFamilyId}`),
    targetCodeLength: check("friend_requests_target_code_length", sql`char_length(${table.targetCode}) BETWEEN 1 AND 64`),
    labelLength: check("friend_requests_label_length", sql`char_length(${table.requestingLabel}) BETWEEN 1 AND 160 AND char_length(${table.targetLabel}) BETWEEN 1 AND 160`),
    messageLength: check("friend_requests_message_length", sql`char_length(${table.requesterMessage}) BETWEEN 1 AND 500`),
  }),
);

export const items = pgTable(
  "items",
  {
    id: text("id").primaryKey(),
    category: text("category").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    countryCode: text("country_code"),
    iconSlug: text("icon_slug"),
    isPublished: boolean("is_published").notNull().default(false),
    sourceType: text("source_type").notNull().default("system"),
    ownerFamilyId: text("owner_family_id").references(() => families.id, { onDelete: "cascade" }),
    recipe: text("recipe"),
    locationDesc: text("location_desc"),
    funFacts: jsonb("fun_facts").$type<unknown>(),
    audioUrls: jsonb("audio_urls").$type<unknown>(),
    youtubeUrl: text("youtube_url"),
    trailerUrl: text("trailer_url"),
    characters: jsonb("characters").$type<unknown>(),
    startYear: integer("start_year"),
    endYear: integer("end_year"),
    timePrecision: text("time_precision"),
    releasedDate: text("released_date"),
    richFields: jsonb("rich_fields").$type<unknown>(),
    franchiseId: text("franchise_id"),
    quizRequired: boolean("quiz_required").notNull().default(false),
    catalogContentHash: text("catalog_content_hash"),
    createdAt: createdTimestamp("created_at"),
    updatedAt: createdTimestamp("updated_at"),
  },
  (table) => ({
    publishedCategory: index("idx_items_published_category").on(
      table.isPublished,
      table.category,
      table.createdAt,
    ),
    ownerCreated: index("idx_items_owner_created").on(table.ownerFamilyId, table.createdAt),
    franchise: index("idx_items_franchise").on(table.franchiseId),
  }),
);

export const lessonAudiences = pgTable(
  "lesson_audiences",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    targetFamilyId: text("target_family_id").references(() => families.id, { onDelete: "cascade" }),
    targetProfileId: text("target_profile_id").references(() => profiles.id, { onDelete: "cascade" }),
    grantedByFamilyId: text("granted_by_family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    createdAt: createdTimestamp("created_at"),
  },
  (table) => ({
    itemFamily: uniqueIndex("lesson_audiences_item_family_unique").on(table.itemId, table.targetFamilyId),
    itemProfile: uniqueIndex("lesson_audiences_item_profile_unique").on(table.itemId, table.targetProfileId),
    targetFamily: index("lesson_audiences_target_family_idx").on(table.targetFamilyId, table.createdAt),
    targetProfile: index("lesson_audiences_target_profile_idx").on(table.targetProfileId, table.createdAt),
    targetRequired: check(
      "lesson_audiences_target_required",
      sql`${table.targetFamilyId} IS NOT NULL OR ${table.targetProfileId} IS NOT NULL`,
    ),
  }),
);

export const familyDisabledLessons = pgTable(
  "family_disabled_lessons",
  {
    familyId: text("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    disabledAt: createdTimestamp("disabled_at"),
  },
  (table) => ({
    key: primaryKey({ columns: [table.familyId, table.itemId] }),
  }),
);

export const itemTranslations = pgTable(
  "item_translations",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    history: text("history"),
  },
  (table) => ({
    itemLangUnique: uniqueIndex("item_translations_item_lang_unique").on(table.itemId, table.lang),
    itemLang: index("idx_item_translations_item_lang").on(table.itemId, table.lang),
  }),
);

export const itemMedia = pgTable(
  "item_media",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    mediaType: text("media_type").notNull(),
    label: text("label"),
    lang: text("lang"),
    filename: text("filename").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => ({
    itemOrder: index("idx_item_media_item_order").on(table.itemId, table.sortOrder),
  }),
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    questionGroupId: text("question_group_id"),
    lang: text("lang").notNull(),
    question: text("question").notNull(),
    questionType: text("question_type").notNull(),
    options: jsonb("options").$type<unknown>().notNull(),
    correctAnswers: jsonb("correct_answers").$type<unknown>().notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdTimestamp("created_at"),
  },
  (table) => ({
    itemActive: index("idx_quiz_questions_item_active").on(
      table.itemId,
      table.isActive,
      table.lang,
      table.sortOrder,
    ),
  }),
);

export const flashcards = pgTable(
  "flashcards",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(),
    front: text("front").notNull(),
    back: text("back").notNull(),
    mediaHint: text("media_hint"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(false),
    sourceType: text("source_type").notNull().default("manual"),
    createdAt: createdTimestamp("created_at"),
    updatedAt: createdTimestamp("updated_at"),
  },
  (table) => ({
    itemPublishedLanguage: index("idx_flashcards_item_published_language_order").on(
      table.itemId,
      table.isPublished,
      table.lang,
      table.sortOrder,
      table.id,
    ),
    langLength: check("flashcards_lang_length", sql`char_length(${table.lang}) BETWEEN 2 AND 8`),
    frontLength: check("flashcards_front_length", sql`char_length(${table.front}) BETWEEN 1 AND 500`),
    backLength: check("flashcards_back_length", sql`char_length(${table.back}) BETWEEN 1 AND 4000`),
  }),
);

export const flashcardStudySessions = pgTable(
  "flashcard_study_sessions",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    focusItemId: text("focus_item_id").references(() => items.id, { onDelete: "set null" }),
    themeType: text("theme_type").notNull(),
    themeValue: text("theme_value").notNull(),
    lang: text("lang").notNull(),
    cardsShown: integer("cards_shown").notNull(),
    gotItCount: integer("got_it_count").notNull(),
    reviewAgainCount: integer("review_again_count").notNull(),
    responses: jsonb("responses").$type<Array<{ flashcard_id: string; rating: "got_it" | "review_again" }>>().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    profileCompleted: index("idx_flashcard_study_sessions_profile_completed").on(table.profileId, table.completedAt),
    validTheme: check("flashcard_study_sessions_valid_theme", sql`${table.themeType} IN ('item', 'country', 'continent', 'era', 'category')`),
    cardsShownRange: check("flashcard_study_sessions_cards_shown_range", sql`${table.cardsShown} BETWEEN 1 AND 15`),
    gotItRange: check("flashcard_study_sessions_got_it_range", sql`${table.gotItCount} BETWEEN 0 AND ${table.cardsShown}`),
    reviewAgainRange: check("flashcard_study_sessions_review_again_range", sql`${table.reviewAgainCount} BETWEEN 0 AND ${table.cardsShown}`),
    responsesWithinShown: check("flashcard_study_sessions_responses_within_shown", sql`${table.gotItCount} + ${table.reviewAgainCount} <= ${table.cardsShown}`),
    startedBeforeCompleted: check("flashcard_study_sessions_started_before_completed", sql`${table.startedAt} <= ${table.completedAt}`),
  }),
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    itemId: text("item_id").references(() => items.id, { onDelete: "cascade" }),
    attemptDate: timestamp("attempt_date", { withTimezone: true, mode: "date" }).notNull(),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    answers: jsonb("answers").$type<unknown>().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    profileItem: index("idx_quiz_attempts_profile_item").on(
      table.profileId,
      table.itemId,
      table.completedAt,
    ),
    scoreNonnegative: check("quiz_attempts_score_nonnegative", sql`${table.score} >= 0`),
    totalNonnegative: check("quiz_attempts_total_nonnegative", sql`${table.total} >= 0`),
    scoreWithinTotal: check("quiz_attempts_score_not_over_total", sql`${table.score} <= ${table.total}`),
  }),
);

export const dailyQuizSnapshots = pgTable(
  "daily_quiz_snapshots",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date", { mode: "string" }).notNull(),
    lang: text("lang").notNull(),
    questionIds: jsonb("question_ids").$type<string[]>().notNull(),
    createdAt: createdTimestamp("created_at"),
  },
  (table) => ({
    profileDateUnique: uniqueIndex("daily_quiz_snapshots_profile_date_unique").on(table.profileId, table.snapshotDate),
  }),
);

export const profileProgress = pgTable(
  "profile_progress",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    doneAt: timestamp("done_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    profileItemUnique: uniqueIndex("profile_progress_profile_item_unique").on(table.profileId, table.itemId),
    profileRecent: index("idx_profile_progress_profile_recent").on(table.profileId, table.doneAt),
  }),
);

// Short aliases keep the storage vocabulary readable for route code while the
// item-prefixed exports preserve the existing frontend/Worker naming.
export const translations = itemTranslations;
export const media = itemMedia;

export type Family = typeof families.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Item = typeof items.$inferSelect;
export type ItemTranslation = typeof itemTranslations.$inferSelect;
export type ItemMedia = typeof itemMedia.$inferSelect;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type Flashcard = typeof flashcards.$inferSelect;
export type FlashcardStudySession = typeof flashcardStudySessions.$inferSelect;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type DailyQuizSnapshot = typeof dailyQuizSnapshots.$inferSelect;
export type ProfileProgress = typeof profileProgress.$inferSelect;
export type LessonAudience = typeof lessonAudiences.$inferSelect;
export type FamilyDisabledLesson = typeof familyDisabledLessons.$inferSelect;
export type FriendRequest = typeof friendRequests.$inferSelect;

export const ufoWords = pgTable('ufo_words', {
 id: text('id').primaryKey(), language: text('language').notNull().default('en'), word: text('word').notNull(), difficulty: text('difficulty').notNull(), clue: text('clue').notNull(), definition: text('definition').notNull(),
}, t => ({ wordUnique: uniqueIndex('ufo_words_word_unique').on(t.language, t.word), wordValid: check('ufo_words_word_valid', sql.raw(`((language = 'en' AND word ~ '^[A-Z]{2,18}$') OR (language = 'vi' AND char_length(word) BETWEEN 2 AND 30 AND word ~ '^[${VIETNAMESE_CHARACTERS}]+( [${VIETNAMESE_CHARACTERS}]+)*$'))`)), languageValid: check('ufo_words_language_valid', sql`${t.language} IN ('en','vi')`), difficultyValid: check('ufo_words_difficulty_valid', sql`${t.difficulty} IN ('easy','medium','hard')`) }));
export const ufoProgress = pgTable('ufo_progress', {
 profileId: text('profile_id').primaryKey().references(() => profiles.id, {onDelete:'cascade'}),
 state: jsonb('state').notNull(), updatedAt: createdTimestamp('updated_at'),
});

export const mathWallProgress = pgTable('math_wall_progress', {
  profileId: text('profile_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
  state: jsonb('state').notNull(), bestScore: integer('best_score').notNull().default(0),
  updatedAt: createdTimestamp('updated_at'),
}, t => ({ bestValid: check('math_wall_best_nonnegative', sql`${t.bestScore} >= 0`) }));

export const infinidrillProgress = pgTable('infinidrill_progress', {
  profileId: text('profile_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
  state: jsonb('state').notNull(), updatedAt: createdTimestamp('updated_at'),
});

export const minikuProgress = pgTable('miniku_progress', {
  profileId: text('profile_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
  state: jsonb('state').notNull(), updatedAt: createdTimestamp('updated_at'),
});

export const fishingProgress = pgTable('fishing_progress', {
  profileId: text('profile_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
  state: jsonb('state').$type<import('../fishing/types.js').FishingProgress>().notNull(),
  updatedAt: createdTimestamp('updated_at'),
});

export const fishingCastResults = pgTable('fishing_cast_results', {
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  castId: text('cast_id').notNull(), location: text('location').notNull(), fishId: text('fish_id'),
  stamina: integer('stamina').notNull(), points: integer('points').notNull(),
  createdAt: createdTimestamp('created_at'),
}, table => ({ key: primaryKey({ columns: [table.profileId, table.castId] }),
  // Per-fish catch counts (the Lake unlocks) read from the index alone.
  byFish: index('fishing_cast_profile_fish').on(table.profileId, table.fishId) }));

export const townState = pgTable('town_state', {
  profileId: text('profile_id').primaryKey().references(() => profiles.id, {onDelete:'cascade'}),
  state: jsonb('state').$type<import('../town-building/game.js').TownState>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
export const townRewardEvents = pgTable('town_reward_events', {
  profileId: text('profile_id').notNull().references(() => profiles.id, {onDelete:'cascade'}),
  eventId: text('event_id').notNull(), reward: jsonb('reward').notNull(), createdAt: createdTimestamp('created_at'),
}, table => ({uniqueEvent: primaryKey({columns:[table.profileId,table.eventId]})}));
export const townBasketGifts=pgTable('town_basket_gifts',{
  id:text('id').primaryKey(),
  senderProfileId:text('sender_profile_id').notNull().references(()=>profiles.id,{onDelete:'cascade'}),
  recipientProfileId:text('recipient_profile_id').notNull().references(()=>profiles.id,{onDelete:'cascade'}),
  decoration:text('decoration').notNull(),message:integer('message').notNull(),
  createdAt:createdTimestamp('created_at'),openedAt:timestamp('opened_at',{withTimezone:true,mode:'date'}),
},t=>({
  inbox:index('town_basket_inbox').on(t.recipientProfileId,t.openedAt,t.createdAt),
  pair:index('town_basket_pair').on(t.senderProfileId,t.recipientProfileId,t.createdAt),
  pendingPair:uniqueIndex('town_basket_pending_pair').on(t.senderProfileId,t.recipientProfileId).where(sql`${t.openedAt} IS NULL`),
  notSelf:check('town_basket_not_self',sql`${t.senderProfileId} <> ${t.recipientProfileId}`),
  decorationValid:check('town_basket_decoration',sql`${t.decoration} IN ('flowers','balloons','gnome')`),
  messageValid:check('town_basket_message',sql`${t.message} BETWEEN 0 AND 9`),
  openedValid:check('town_basket_opened',sql`${t.openedAt} IS NULL OR ${t.openedAt} >= ${t.createdAt}`),
}));
export const townRaftProgress=pgTable('town_raft_progress',{
  profileId:text('profile_id').primaryKey().references(()=>profiles.id,{onDelete:'cascade'}),
  fishCaught:integer('fish_caught').notNull().default(0),
},t=>({valid:check('town_raft_fish_caught',sql`${t.fishCaught} BETWEEN 0 AND 50`)}));
export const townRaftItems=pgTable('town_raft_items',{
  id:text('id').primaryKey(),providerId:text('provider_id').notNull().references(()=>profiles.id,{onDelete:'cascade'}),
  sourceKey:text('source_key').notNull(),kind:text('kind').notNull(),itemId:text('item_id').notNull(),stamina:integer('stamina').notNull(),
  producedAt:createdTimestamp('produced_at'),pickerId:text('picker_id').references(()=>profiles.id,{onDelete:'set null'}),
  pickedAt:timestamp('picked_at',{withTimezone:true,mode:'date'}),pickupRequestId:text('pickup_request_id'),
},t=>({source:uniqueIndex('town_raft_source').on(t.providerId,t.sourceKey),request:uniqueIndex('town_raft_pickup_request').on(t.pickupRequestId),
  stock:index('town_raft_stock').on(t.providerId,t.pickedAt,t.producedAt),quota:index('town_raft_picker_day').on(t.pickerId,t.pickedAt),
  kindValid:check('town_raft_kind',sql`${t.kind} IN ('fish','vegetable','egg')`),staminaValid:check('town_raft_stamina',sql`${t.stamina} BETWEEN 1 AND 10`),
  pickupValid:check('town_raft_pickup_shape',sql`(${t.pickedAt} IS NULL AND ${t.pickupRequestId} IS NULL) OR (${t.pickedAt} IS NOT NULL AND ${t.pickupRequestId} IS NOT NULL)`),
}));
export const townRiverEvents=pgTable('town_river_events',{
  sequence:bigserial('sequence',{mode:'number'}).primaryKey(),eventKey:text('event_key').notNull(),
  ownerId:text('owner_id').notNull().references(()=>profiles.id,{onDelete:'cascade'}),
  visitorId:text('visitor_id').notNull(),
  kind:text('kind').notNull(),data:jsonb('data').notNull(),stamina:integer('stamina').notNull().default(0),createdAt:createdTimestamp('created_at'),
},t=>({receipt:uniqueIndex('town_river_receipt').on(t.eventKey),timeline:index('town_river_timeline').on(t.ownerId,t.createdAt,t.sequence),
  kindValid:check('town_river_kind',sql`${t.kind} IN ('visit','gift','pickup')`),staminaValid:check('town_river_stamina',sql`${t.stamina}>=0`),
}));
export const townRiverInbox=pgTable('town_river_inbox',{
  profileId:text('profile_id').primaryKey().references(()=>profiles.id,{onDelete:'cascade'}),
  lastSequence:bigint('last_sequence',{mode:'number'}).notNull().default(0),
  lastArrivalId:text('last_arrival_id'),lastArrivalNew:boolean('last_arrival_new').notNull().default(false),lastReport:jsonb('last_report'),
});
export const townLearnedItems = pgTable('town_learned_items', {
  profileId: text('profile_id').notNull().references(() => profiles.id, {onDelete:'cascade'}), itemId:text('item_id').notNull(),
}, table => ({uniqueItem:primaryKey({columns:[table.profileId,table.itemId]})}));
export const townDrinkSessions = pgTable('town_drink_sessions', {
  profileId: text('profile_id').primaryKey().references(() => profiles.id, {onDelete:'cascade'}), state:jsonb('state').notNull(),
});

export const cabbageRollSessions = pgTable('cabbage_roll_sessions', {
  profileId: text('profile_id').primaryKey().references(() => profiles.id, {onDelete:'cascade'}), state:jsonb('state').notNull(),
});

export const minikuPuzzles = pgTable('miniku_puzzles', {
  ownerFamilyId: text('owner_family_id').references(() => families.id, { onDelete:'cascade' }),
  id: text('id').primaryKey(),
  size: integer('size').notNull(),
  givens: jsonb('givens').$type<number[]>().notNull(),
  solution: jsonb('solution').$type<number[]>().notNull(),
  enabled: boolean('enabled').notNull().default(true),
  revision: integer('revision').notNull().default(0),
  updatedAt: createdTimestamp('updated_at'),
}, table => ({ sharedLayoutUnique: uniqueIndex('miniku_puzzles_shared_layout_unique').on(table.size, table.givens).where(sql`${table.ownerFamilyId} IS NULL`), familyLayoutUnique: uniqueIndex('miniku_puzzles_family_layout_unique').on(table.ownerFamilyId, table.size, table.givens).where(sql`${table.ownerFamilyId} IS NOT NULL`) }));
export const minikuFamilySettings = pgTable('miniku_family_settings', {
  familyId: text('family_id').primaryKey().references(() => families.id, { onDelete: 'cascade' }),
  hints: boolean('hints').notNull().default(true),
});

export const googleIdentities = pgTable('google_identities', {
  subject: text('subject').primaryKey(),
  familyId: text('family_id').notNull().references(()=>families.id,{onDelete:'cascade'}),
  createdAt: createdTimestamp('created_at'),
}, table=>({familyUnique:uniqueIndex('google_identities_family_unique').on(table.familyId)}));
export const googleAuthTransactions = pgTable('google_auth_transactions', {
  tokenHash:text('token_hash').primaryKey(),
  verifier:text('verifier').notNull(),
  purpose:text('purpose').notNull(),
  familyId:text('family_id').references(()=>families.id,{onDelete:'cascade'}),
  sessionHash:text('session_hash'),
  legalVersion:text('legal_version'),
  expiresAt:timestamp('expires_at',{withTimezone:true,mode:'date'}).notNull(),
}, table=>({expiry:index('google_auth_transactions_expiry').on(table.expiresAt), purposeCheck:check('google_auth_transactions_purpose',sql`${table.purpose} IN ('login','parent','signup')`)}));

export const adventureEvents = pgTable('adventure_events', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id, {onDelete:'cascade'}),
  eventKey: text('event_key').notNull(),
  game: text('game').notNull(),
  kind: text('kind').notNull(),
  data: jsonb('data').notNull(),
  createdAt: createdTimestamp('created_at'),
}, table => ({ event:uniqueIndex('adventure_events_profile_key').on(table.profileId,table.eventKey), timeline:index('adventure_events_profile_time').on(table.profileId,table.createdAt,table.id) }));
export const kitchenSessions = pgTable('kitchen_sessions', {
  profileId: text('profile_id').notNull().references(() => profiles.id, {onDelete:'cascade'}),
  recipeId: text('recipe_id').notNull(),
  state: jsonb('state').notNull(),
},table=>({key:primaryKey({columns:[table.profileId,table.recipeId]})}));

export const roadRacingProgress = pgTable('road_racing_progress', {
  profileId: text('profile_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
  state: jsonb('state').notNull(), updatedAt: createdTimestamp('updated_at'),
});

export const dailyQuizProgress = pgTable('daily_quiz_progress', {
  profileId: text('profile_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
  state: jsonb('state').$type<import('../daily-quiz/game.js').DailyProgress>().notNull(),
  updatedAt: createdTimestamp('updated_at'),
});

export const calendarPlanLists = pgTable('calendar_plan_lists', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  scope: text('scope').notNull(), weekday: integer('weekday'), localDate: date('local_date'),
  area: text('area').notNull(), items: jsonb('items').$type<unknown>().notNull(),
  revision: integer('revision').notNull().default(1), updatedAt: createdTimestamp('updated_at'),
}, table => ({
  shape: check('calendar_plan_lists_scope_shape', sql`(${table.scope} = 'template' AND ${table.weekday} IS NOT NULL AND ${table.weekday} BETWEEN 1 AND 7 AND ${table.localDate} IS NULL) OR (${table.scope} = 'date' AND ${table.weekday} IS NULL AND ${table.localDate} IS NOT NULL)`),
  area: check('calendar_plan_lists_area', sql`${table.area} IN ('study_morning','study_afternoon','study_extra','meal_breakfast','meal_lunch','meal_snack','meal_dinner','medicine')`),
  revision: check('calendar_plan_lists_revision', sql`${table.revision} >= 1`),
  templateUnique: uniqueIndex('calendar_plan_lists_template_unique').on(table.profileId, table.weekday, table.area).where(sql`${table.scope} = 'template'`),
  dateUnique: uniqueIndex('calendar_plan_lists_date_unique').on(table.profileId, table.localDate, table.area).where(sql`${table.scope} = 'date'`),
  profileDate: index('calendar_plan_lists_profile_date').on(table.profileId, table.localDate),
}));
export const calendarMealLibrary = pgTable('calendar_meal_library', {
  id: text('id').primaryKey(), profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  foodKey: text('food_key').notNull(), customName: text('custom_name'), createdAt: createdTimestamp('created_at'),
}, table => ({ uniqueMeal: uniqueIndex('calendar_meal_library_unique').on(table.profileId, table.foodKey, sql`coalesce(${table.customName}, '')`) }));
export const calendarStudyLibrary = pgTable('calendar_study_library', {
  id: text('id').primaryKey(), profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(), name: text('name').notNull(), createdAt: createdTimestamp('created_at'),
}, table => ({ uniqueSubject: uniqueIndex('calendar_study_library_profile_id_subject_name_key').on(table.profileId, table.subject, table.name) }));
export const calendarEvents = pgTable('calendar_events', {
  id: text('id').primaryKey(), profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(), iconKey: text('icon_key').notNull(), startDate: date('start_date').notNull(),
  repeat: text('repeat').notNull().default('none'), repeatEndedOn: date('repeat_ended_on'),
  nameHistory: jsonb('name_history').notNull().default([]),
  revision: integer('revision').notNull().default(1), createdAt: createdTimestamp('created_at'), updatedAt: createdTimestamp('updated_at'),
}, table => ({
  profileStart: index('calendar_events_profile_start').on(table.profileId, table.startDate),
  repeat: check('calendar_events_repeat', sql`${table.repeat} IN ('none','weekly','monthly','yearly')`),
  revision: check('calendar_events_revision', sql`${table.revision} >= 1`),
}));

export const calendarFamilySettings = pgTable('calendar_family_settings', {
  familyId: text('family_id').primaryKey().references(() => families.id, {onDelete:'cascade'}),
  disabledRoles: jsonb('disabled_roles').$type<import('../calendar/participants.js').RelativeRole[]>().notNull().default(sql`'[]'::jsonb`),
  revision: integer('revision').notNull().default(1),
}, table => ({revision:check('calendar_family_settings_revision',sql`${table.revision} >= 1`)}));

export const profileSchedules = pgTable('profile_schedules', {
  profileId: text('profile_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(false),
  revision: integer('revision').notNull().default(0),
  currentTimezone: text('current_timezone'),
  timezoneChangedAt: timestamp('timezone_changed_at', { withTimezone: true }),
  timezoneChangeDay: date('timezone_change_day'),
  timezoneChangesToday: integer('timezone_changes_today').notNull().default(0),
});

export const profileScheduleSlots = pgTable('profile_schedule_slots', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  weekday: smallint('weekday').notNull(),
  startMinute: smallint('start_minute').notNull(),
  endMinute: smallint('end_minute').notNull(),
}, table => ({
  startUnique: uniqueIndex('profile_schedule_slots_start_unique').on(table.profileId, table.weekday, table.startMinute),
  range: check('profile_schedule_slots_range', sql`${table.weekday} BETWEEN 1 AND 7 AND ${table.startMinute} >= 0 AND ${table.startMinute} < ${table.endMinute} AND ${table.endMinute} <= 1440 AND ${table.startMinute} % 30 = 0 AND ${table.endMinute} % 30 = 0`),
}));

export const profileScheduleEvents = pgTable('profile_schedule_events', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  fromTimezone: text('from_timezone'),
  toTimezone: text('to_timezone').notNull(),
  at: createdTimestamp('at'),
}, table => ({ profileAt: index('idx_profile_schedule_events_profile_at').on(table.profileId, table.at) }));
