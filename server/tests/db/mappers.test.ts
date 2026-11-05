import assert from "node:assert/strict";
import test from "node:test";

import {
  boundedLimit,
  itemDetailFromRows,
  profileFromRow,
  safeStoredJson,
} from "../../src/db/mappers.js";

test("safeStoredJson parses valid JSON and falls back for malformed stored text", () => {
  assert.deepEqual(safeStoredJson('["one"]', []), ["one"]);
  assert.deepEqual(safeStoredJson("not-json", []), []);
  assert.deepEqual(safeStoredJson({ key: "value" }, null), { key: "value" });
});

test("boundedLimit rejects non-finite and clamps untrusted list limits", () => {
  assert.equal(boundedLimit(undefined, 25, 100), 25);
  assert.equal(boundedLimit(Number.NaN, 25, 100), 25);
  assert.equal(boundedLimit(0, 25, 100), 1);
  assert.equal(boundedLimit(999, 25, 100), 100);
  assert.equal(boundedLimit(4.9, 25, 100), 4);
});

test("profileFromRow preserves the frontend profile shape and omits null optionals", () => {
  assert.deepEqual(
    profileFromRow({
      id: "profile-1",
      name: "Ari",
      emoji: "🦊",
      color: "orange",
      publicId: "ABC123",
      nativeCountryCode: null,
      nativeCity: null,
      avatarType: null,
      avatarUrl: null,
      avatarFrame: null,
      createdAt: new Date("2026-09-19T00:00:00.000Z"),
      totalDone: "3",
      badgeCount: 0,
    }),
    {
      id: "profile-1",
      name: "Ari",
      emoji: "🦊",
      color: "orange",
      public_id: "ABC123",
      tour_completed_at: null,
      created_at: "2026-09-19T00:00:00.000Z",
      total_done: 3,
      badge_count: 0,
    },
  );
});

test("profileFromRow returns a selected avatar frame", () => {
  const profile = profileFromRow({
    id: "profile-1",
    name: "Ari",
    emoji: "🦊",
    color: "orange",
    publicId: "ABC123",
    nativeCountryCode: null,
    nativeCity: null,
    avatarType: "default",
    avatarUrl: "lion",
    avatarFrame: "space",
    createdAt: new Date("2026-09-19T00:00:00.000Z"),
    totalDone: 0,
    badgeCount: 0,
  });

  assert.equal(profile.avatar_frame, "space");
});

test("itemDetailFromRows chooses the requested language then English and safely maps media", () => {
  assert.deepEqual(
    itemDetailFromRows(
      {
        id: "item-1",
        category: "animal",
        latitude: 1,
        longitude: 2,
        countryCode: "VN",
        iconSlug: "animal",
        hasQuiz: true,
        recipe: null,
        locationDesc: "A place",
        funFacts: "[\"fact\"]",
        audioUrls: "malformed",
        youtubeUrl: null,
        trailerUrl: null,
        characters: null,
        startYear: null,
        endYear: null,
        timePrecision: null,
        releasedDate: null,
        richFields: { classification: "species" },
        franchiseId: null,
        quizRequired: true,
      },
      [
        { lang: "en", title: "English", description: null, history: null },
        { lang: "vi", title: "Vietnamese", description: "Mô tả", history: null },
      ],
      [{ id: "media-1", mediaType: "image", label: null, filename: "photo.jpg", lang: null, sortOrder: 0 }],
      [],
      "vi",
    ),
    {
      id: "item-1",
      category: "animal",
      latitude: 1,
      longitude: 2,
      country_code: "VN",
      title: "Vietnamese",
      icon_slug: "animal",
      has_quiz: true,
      translation: { lang: "vi", title: "Vietnamese", description: "Mô tả" },
      media: [{ id: "media-1", media_type: "image", filename: "photo.jpg", url: "/media/photo.jpg" }],
      available_languages: ["en", "vi"],
      location_desc: "A place",
      fun_facts: ["fact"],
      rich_fields: { classification: "species" },
      quiz_required: true,
    },
  );
});
