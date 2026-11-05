import assert from "node:assert/strict";
import test from "node:test";

import {
  catalogItemBatchUpdateSchema,
  catalogItemCreateSchema,
  catalogItemUpdateSchema,
  flashcardStudySessionSchema,
  profileCreateSchema,
  profileUpdateSchema,
} from "../src/input.js";

const base = {
  theme_type: "category" as const,
  theme_value: "animal",
  lang: "en",
  viewed_flashcard_ids: ["card-1"],
  responses: [],
  started_at: "2026-09-20T09:00:00.000Z",
};

test("flashcard session schema normalizes explicit null and omitted focus IDs to undefined", () => {
  assert.equal(flashcardStudySessionSchema.parse(base).focus_item_id, undefined);
  assert.equal(flashcardStudySessionSchema.parse({ ...base, focus_item_id: null }).focus_item_id, undefined);
});

test("profile creation cannot assign a custom avatar URL outside the owner-scoped upload route", () => {
  const profile = { name: "Child", emoji: "🌟", color: "#3B82F6" };
  assert.equal(profileCreateSchema.parse({ ...profile, avatar_type: "default", avatar_url: "lion" }).avatar_url, "lion");
  assert.equal(profileCreateSchema.parse({ ...profile, avatar_frame: "flowers" }).avatar_frame, "flowers");
  assert.throws(() => profileCreateSchema.parse({ ...profile, avatar_type: "custom", avatar_url: "/media/profile-avatars/other/key.png" }));
  assert.throws(() => profileCreateSchema.parse({ ...profile, avatar_type: "default", avatar_url: "https://tracking.example/avatar.png" }));
});

test("profile updates accept supported avatar frames and null clears the frame", () => {
  assert.deepEqual(profileUpdateSchema.parse({ avatar_frame: "tet" }), { avatar_frame: "tet" });
  assert.deepEqual(profileUpdateSchema.parse({ avatar_frame: null }), { avatar_frame: null });
  assert.throws(() => profileUpdateSchema.parse({ avatar_frame: "unknown-frame" }));
});

const catalogItem = {
  id: "saola-vn",
  category: "animal",
  latitude: 16.2,
  longitude: 107.8,
  country_code: "vn",
  icon_slug: "animal",
  translations: [{ lang: "EN", title: "Saola", description: "A rare forest animal." }],
  media: [{ media_type: "image", filename: "animals/saola.jpg" }],
  quiz_questions: [{
    lang: "en",
    question: "Where is the saola found?",
    question_type: "single",
    options: ["Vietnam", "Canada"],
    correct_answers: [0],
  }],
};

test("catalog item input normalizes safe fields and derives quiz_required from supplied questions", () => {
  assert.deepEqual(catalogItemCreateSchema.parse(catalogItem), {
    ...catalogItem,
    country_code: "VN",
    is_published: false,
    translations: [{ lang: "en", title: "Saola", description: "A rare forest animal." }],
    media: [{ media_type: "image", filename: "animals/saola.jpg", sort_order: 0 }],
    quiz_questions: [{
      lang: "en",
      question: "Where is the saola found?",
      question_type: "single",
      options: ["Vietnam", "Canada"],
      correct_answers: [0],
      sort_order: 0,
    }],
    quiz_required: true,
  });
});

test("catalog item input rejects unsafe media paths, invalid coordinates, duplicate languages, and client ownership", () => {
  assert.throws(() => catalogItemCreateSchema.parse({
    ...catalogItem,
    latitude: 91,
    media: [{ media_type: "image", filename: "../private.png" }],
    translations: [
      { lang: "en", title: "Saola" },
      { lang: "EN", title: "Saola again" },
    ],
    owner_family_id: "other-family",
  }));
});

test("catalog item updates preserve omitted fields and allow explicit nullable clears", () => {
  assert.deepEqual(catalogItemUpdateSchema.parse({
    id: "saola-vn",
    location_desc: null,
    rich_fields: null,
    translations: [{ lang: "en", title: "Updated saola" }],
  }), {
    id: "saola-vn",
    location_desc: null,
    rich_fields: null,
    translations: [{ lang: "en", title: "Updated saola" }],
  });
});

test("catalog item update batches are bounded and cannot target one item twice", () => {
  const item = { id: "saola-vn", category: "animal" as const };
  assert.equal(catalogItemBatchUpdateSchema.parse({ items: [item] }).items.length, 1);
  assert.throws(() => catalogItemBatchUpdateSchema.parse({
    items: Array.from({ length: 101 }, (_, index) => ({ id: `item-${index}`, category: "animal" as const })),
  }));
  assert.throws(() => catalogItemBatchUpdateSchema.parse({ items: [item, item] }));
});
