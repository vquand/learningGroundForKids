import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertCanonicalDeckMembership,
  buildFlashcardDeck,
  buildThemeDescriptors,
  continentForCountry,
  deriveStudySession,
  preferredFlashcardLanguage,
  themeMatchesItem,
  type FlashcardCandidateItem,
  type FlashcardRecord,
} from "../src/flashcards.js";

const focus: FlashcardCandidateItem = {
  id: "item-focus",
  category: "animal",
  country_code: "VN",
  start_year: 2001,
  title: "Saola",
  has_quiz: true,
};

function card(itemId: string, index: number): FlashcardRecord {
  return {
    id: `${itemId}-card-${index}`,
    item_id: itemId,
    item_title: itemId,
    lang: "en",
    front: `Front ${index}`,
    back: `Back ${index}`,
    sort_order: index,
    source_type: "catalog_quiz",
  };
}

test("theme descriptors preserve UI titles and derive values from the published focus item", () => {
  assert.deepEqual(buildThemeDescriptors(focus), [
    {
      theme_type: "item",
      theme_value: "item-focus",
      title: "Study This Item",
      description: "Quick cards for this place, food, song, or story.",
      min_cards: 1,
    },
    {
      theme_type: "country",
      theme_value: "VN",
      title: "More From Vietnam",
      description: "Mix cards from nearby items in the same country.",
      min_cards: 6,
    },
    {
      theme_type: "continent",
      theme_value: "Asia",
      title: "Explore Asia",
      description: "Travel wider with cards from the same continent.",
      min_cards: 6,
    },
    {
      theme_type: "era",
      theme_value: "today",
      title: "Travel Today",
      description: "Study cards from the same time period.",
      min_cards: 6,
    },
    {
      theme_type: "category",
      theme_value: "animal",
      title: "More In Animal",
      description: "Stay on theme with related cards from this category.",
      min_cards: 6,
    },
  ]);
});

test("multi-item decks are deterministic, bounded, and give every item up to two cards first", () => {
  const candidates: FlashcardCandidateItem[] = [
    focus,
    { ...focus, id: "item-a", title: "A", has_quiz: true },
    { ...focus, id: "item-b", title: "B", has_quiz: false },
    { ...focus, id: "item-c", title: "C", has_quiz: true },
    { ...focus, id: "item-d", title: "D", has_quiz: false },
    { ...focus, id: "item-e", title: "E", has_quiz: true },
    { ...focus, id: "item-f", title: "F", has_quiz: true },
    { ...focus, id: "item-g", title: "G", has_quiz: true },
  ];
  const cardsByItem = new Map(candidates.map((item) => [
    item.id,
    [card(item.id, 0), card(item.id, 1), card(item.id, 2)],
  ]));

  const first = buildFlashcardDeck("profile-1", focus.id, "category", "animal", candidates, cardsByItem);
  const second = buildFlashcardDeck("profile-1", focus.id, "category", "animal", candidates, cardsByItem);

  assert.deepEqual(second, first);
  assert.equal(first.length, 15);
  assert.equal(new Set(first.map((value) => value.id)).size, 15);
  assert.ok(candidates.every((item) => first.filter((value) => value.item_id === item.id).length >= 1));
  assert.ok(candidates.every((item) => first.filter((value) => value.item_id === item.id).length <= 2));
});

test("multi-item decks keep the focus item first while remaining deterministic", () => {
  const candidates = [
    focus,
    ...Array.from({ length: 9 }, (_, index) => ({
      ...focus,
      id: `item-${index}`,
      title: `Item ${index}`,
      has_quiz: true,
    })),
  ];
  const cardsByItem = new Map(candidates.map((item) => [
    item.id,
    [card(item.id, 0), card(item.id, 1), card(item.id, 2)],
  ]));

  const first = buildFlashcardDeck("profile-1", focus.id, "category", "animal", candidates, cardsByItem);
  const second = buildFlashcardDeck("profile-1", focus.id, "category", "animal", candidates, cardsByItem);

  assert.deepEqual(second, first);
  assert.equal(first[0]?.item_id, focus.id);
});

test("deck membership remains stable when profile progress changes after GET", () => {
  const candidates = [
    focus,
    ...Array.from({ length: 8 }, (_, index) => ({
      ...focus,
      id: `item-${String.fromCharCode(97 + index)}`,
      title: String.fromCharCode(65 + index),
    })),
  ];
  const beforeProgressChange = candidates.map((item, index) => ({ ...item, done: index === 8 }));
  const afterProgressChange = candidates.map((item, index) => ({ ...item, done: index === 1 }));
  const cardsByItem = new Map(candidates.map((item) => [
    item.id,
    [card(item.id, 0), card(item.id, 1), card(item.id, 2)],
  ]));
  const before = buildFlashcardDeck("profile-1", focus.id, "category", "animal", beforeProgressChange, cardsByItem);
  const after = buildFlashcardDeck(
    "profile-1",
    focus.id,
    "category",
    "animal",
    afterProgressChange,
    cardsByItem,
  );

  assert.deepEqual(after.map((value) => value.id), before.map((value) => value.id));
});

test("optional-focus sessions reject an in-theme card outside the canonical selected deck", () => {
  const candidates = Array.from({ length: 10 }, (_, index) => ({
    ...focus,
    id: `item-${index}`,
    title: `Item ${index}`,
  }));
  const cardsByItem = new Map(candidates.map((item) => [
    item.id,
    [card(item.id, 0), card(item.id, 1), card(item.id, 2)],
  ]));
  const canonical = buildFlashcardDeck("profile-1", "", "category", "animal", candidates, cardsByItem);
  assert.equal(canonical.length, 15);
  const canonicalIds = new Set(canonical.map((value) => value.id));
  const outside = [...cardsByItem.values()].flat().find((value) => !canonicalIds.has(value.id));
  assert.ok(outside);

  assert.doesNotThrow(() => assertCanonicalDeckMembership([canonical[0]!.id], canonical));
  assert.throws(() => assertCanonicalDeckMembership([outside.id], canonical), /canonical deck/i);
});

test("item decks are capped at fifteen cards", () => {
  const values = Array.from({ length: 20 }, (_, index) => card(focus.id, index));
  const deck = buildFlashcardDeck(
    "profile-1",
    focus.id,
    "item",
    focus.id,
    [focus],
    new Map([[focus.id, values]]),
  );
  assert.equal(deck.length, 15);
  assert.deepEqual(deck.map((value) => value.id), values.slice(0, 15).map((value) => value.id));
});

test("flashcards use an exact requested language and otherwise fall back only to English", () => {
  const values = [{ id: "en", lang: "en" }, { id: "vi", lang: "vi" }, { id: "fr", lang: "fr" }];
  assert.deepEqual(preferredFlashcardLanguage(values, "vi").map((value) => value.id), ["vi"]);
  assert.deepEqual(preferredFlashcardLanguage(values, "de").map((value) => value.id), ["en"]);
  assert.deepEqual(preferredFlashcardLanguage(values.filter((value) => value.lang !== "en"), "de"), []);
});

test("geography maps Greenland and preserves the legacy Unknown continent fallback", () => {
  assert.equal(continentForCountry("GL"), "North America");
  assert.equal(continentForCountry("gl"), "North America");
  assert.equal(continentForCountry("ZZ"), "Unknown");
  assert.equal(continentForCountry(undefined), null);

  const descriptors = buildThemeDescriptors({ ...focus, country_code: "ZZ" });
  assert.ok(descriptors.some((value) => value.theme_type === "continent" && value.theme_value === "Unknown"));
  assert.equal(buildThemeDescriptors({ ...focus, country_code: " gl " })[1]?.theme_value, "GL");
  assert.equal(themeMatchesItem({ ...focus, country_code: "GL" }, "continent", "North America"), true);
  assert.equal(themeMatchesItem({ ...focus, country_code: "gl" }, "country", "GL"), true);
  assert.equal(themeMatchesItem({ ...focus, country_code: "ZZ" }, "continent", "Unknown"), true);
});

test("every country code in the current catalogs has an explicit continent mapping", async () => {
  const paths = [
    new URL("../../frontend/data/generated-catalog.json", import.meta.url),
    new URL("../../frontend/data/expanded-catalog.json", import.meta.url),
  ];
  const catalogs = await Promise.all(paths.map(async (path) => JSON.parse(await readFile(path, "utf8")) as Array<{ country_code?: string }>));
  const codes = [...new Set(catalogs.flat().map((item) => item.country_code).filter((value): value is string => Boolean(value)))];
  const unmapped = codes.filter((code) => continentForCountry(code) === "Unknown");
  assert.deepEqual(unmapped, []);
});

test("study session metadata is derived from validated viewed cards and server time", () => {
  const now = new Date("2026-09-20T10:00:00.000Z");
  const result = deriveStudySession({
    viewed_flashcard_ids: ["card-a", "card-b", "card-c"],
    responses: [
      { flashcard_id: "card-a", rating: "got_it" },
      { flashcard_id: "card-c", rating: "review_again" },
    ],
    started_at: "2026-09-20T09:30:00.000Z",
  }, now);

  assert.deepEqual(result, {
    cards_shown: 3,
    got_it_count: 1,
    review_again_count: 1,
    started_at: new Date("2026-09-20T09:30:00.000Z"),
    completed_at: now,
  });
});

test("study sessions reject duplicate, non-viewed, future, and stale input", () => {
  const now = new Date("2026-09-20T10:00:00.000Z");
  const valid = {
    viewed_flashcard_ids: ["card-a"],
    responses: [{ flashcard_id: "card-a", rating: "got_it" as const }],
  };
  assert.throws(
    () => deriveStudySession({ ...valid, viewed_flashcard_ids: ["card-a", "card-a"], started_at: "2026-09-20T09:00:00Z" }, now),
    /unique/i,
  );
  assert.throws(
    () => deriveStudySession({ ...valid, responses: [{ flashcard_id: "card-b", rating: "got_it" }], started_at: "2026-09-20T09:00:00Z" }, now),
    /viewed/i,
  );
  assert.throws(
    () => deriveStudySession({ ...valid, started_at: "2026-09-20T10:00:01Z" }, now),
    /future/i,
  );
  assert.throws(
    () => deriveStudySession({ ...valid, started_at: "2026-09-19T09:59:59Z" }, now),
    /24 hours/i,
  );
  assert.throws(
    () => deriveStudySession({ ...valid, started_at: "09/20/2026 09:00" }, now),
    /ISO timestamp/i,
  );
});
