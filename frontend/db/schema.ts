import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamp = (name: string) => text(name).notNull().default(sql`CURRENT_TIMESTAMP`);

export const families = sqliteTable("families", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("family"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const profiles = sqliteTable(
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
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => ({
    publicIdUnique: uniqueIndex("profiles_public_id_unique").on(table.publicId),
    familyCreated: index("idx_profiles_family_created").on(table.familyId, table.createdAt),
  }),
);

export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    category: text("category").notNull(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    countryCode: text("country_code"),
    iconSlug: text("icon_slug"),
    isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
    sourceType: text("source_type").notNull().default("system"),
    ownerFamilyId: text("owner_family_id").references(() => families.id, { onDelete: "cascade" }),
    recipe: text("recipe"),
    locationDesc: text("location_desc"),
    funFacts: text("fun_facts"),
    audioUrls: text("audio_urls"),
    youtubeUrl: text("youtube_url"),
    trailerUrl: text("trailer_url"),
    characters: text("characters"),
    startYear: integer("start_year"),
    endYear: integer("end_year"),
    timePrecision: text("time_precision"),
    releasedDate: text("released_date"),
    richFields: text("rich_fields"),
    franchiseId: text("franchise_id"),
    quizRequired: integer("quiz_required", { mode: "boolean" }).notNull().default(false),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => ({
    publishedCategory: index("idx_items_published_category").on(
      table.isPublished,
      table.category,
      table.createdAt,
    ),
    ownerCreated: index("idx_items_owner_created").on(table.ownerFamilyId, table.createdAt),
  }),
);

export const itemTranslations = sqliteTable(
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

export const itemMedia = sqliteTable(
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

export const quizQuestions = sqliteTable(
  "quiz_questions",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(),
    question: text("question").notNull(),
    questionType: text("question_type").notNull(),
    options: text("options").notNull(),
    correctAnswers: text("correct_answers").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
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

export const quizAttempts = sqliteTable(
  "quiz_attempts",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    itemId: text("item_id").references(() => items.id, { onDelete: "cascade" }),
    attemptDate: text("attempt_date").notNull(),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    answers: text("answers").notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    profileItem: index("idx_quiz_attempts_profile_item").on(
      table.profileId,
      table.itemId,
      table.completedAt,
    ),
  }),
);

export const profileProgress = sqliteTable(
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
    doneAt: timestamp("done_at"),
  },
  (table) => ({
    profileItemUnique: uniqueIndex("profile_progress_profile_item_unique").on(
      table.profileId,
      table.itemId,
    ),
    profileRecent: index("idx_profile_progress_profile_recent").on(
      table.profileId,
      table.doneAt,
    ),
  }),
);
