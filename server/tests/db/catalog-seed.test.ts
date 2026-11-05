import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildCatalogSeed, type CatalogItem } from "../../src/db/catalog-seed.js";

test("buildCatalogSeed emits deterministic parameterized statements without interpolating fixture values", () => {
  const seed = buildCatalogSeed(
    [
      {
        category: "animal",
        latitude: 1,
        longitude: 2,
        country_code: "VN",
        icon_slug: "animal",
        is_published: true,
        fun_facts: ["A'B"],
        translations: [{ lang: "en", title: "Kid's fox", description: "safe", history: null }],
        media: [{ media_type: "image", label: "Kid's fox", filename: "fox.jpg" }],
        quiz_questions: [{
          lang: "en",
          question: "Who?",
          question_type: "single",
          options: ["A", "B"],
          correct_answers: [0],
          sort_order: 0,
        }],
      },
    ],
    {},
  );

  assert.equal(seed.statements.length, 6);
  assert.ok(seed.statements.every((statement) => /\$[0-9]+/.test(statement.text)));
  assert.ok(seed.statements.every((statement) => !statement.text.includes("Kid's fox")));
  const itemStatement = seed.statements[0];
  const questionStatement = seed.statements[5];
  assert.ok(itemStatement);
  assert.ok(questionStatement);
  assert.deepEqual(itemStatement.values.slice(0, 4), [seed.itemIds[0], "animal", 1, 2]);
  assert.equal(itemStatement.values[10], JSON.stringify(["A'B"]));
  assert.equal(questionStatement.values[5], JSON.stringify(["A", "B"]));
  assert.equal(questionStatement.values[6], JSON.stringify([0]));

  const second = buildCatalogSeed(
    [
      {
        category: "animal",
        latitude: 1,
        longitude: 2,
        country_code: "VN",
        icon_slug: "animal",
        is_published: true,
        fun_facts: ["A'B"],
        translations: [{ lang: "en", title: "Kid's fox", description: "safe", history: null }],
        media: [{ media_type: "image", label: "Kid's fox", filename: "fox.jpg" }],
        quiz_questions: [{
          lang: "en",
          question: "Who?",
          question_type: "single",
          options: ["A", "B"],
          correct_answers: [0],
          sort_order: 0,
        }],
      },
    ],
    {},
  );
  assert.deepEqual(second, seed);

  const flashcardStatements = seed.statements.filter((value) => value.text.startsWith("INSERT INTO flashcards"));
  assert.equal(flashcardStatements.length, 2);
  assert.deepEqual(flashcardStatements.map((value) => value.values.slice(2, 5)), [
    ["en", "What is Kid's fox?", "safe"],
    ["en", "Who?", "A"],
  ]);
  assert.ok(flashcardStatements.every((value) => value.text.includes("ON CONFLICT (id) DO UPDATE")));
});

test("the real catalog uses authored cards where reviewed and generated cards elsewhere", async () => {
  const catalog = JSON.parse(await readFile(new URL("../../../frontend/data/generated-catalog.json", import.meta.url), "utf8"));
  const first = buildCatalogSeed(catalog, {});
  const second = buildCatalogSeed(catalog, {});
  assert.deepEqual(second, first);
  assert.equal(first.itemIds.length, 200);

  const counts = new Map<string, number>();
  for (const value of first.statements) {
    if (!value.text.startsWith("INSERT INTO flashcards")) continue;
    const key = `${String(value.values[1])}:${String(value.values[2])}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  assert.equal(counts.size, 400);
  const authoredIds = new Set(buildCatalogSeed(catalog.filter((item: CatalogItem) => item.flashcards), {}).itemIds);
  for (const [key, count] of counts) {
    if (authoredIds.has(key.split(':')[0]!)) assert.equal(count, 2);
    else assert.equal(count, 2);
  }
});

test("buildCatalogSeed rejects invalid quiz content before emitting statements", () => {
  const base = {
    category: "animal",
    latitude: 1,
    longitude: 2,
    translations: [{ lang: "en", title: "Animal" }],
  };
  const invalidQuestions = [
    { lang: "en", question: "Q?", question_type: "other", options: ["A"], correct_answers: [0] },
    { lang: "en", question: "Q?", question_type: "single", options: [], correct_answers: [0] },
    { lang: "en", question: "Q?", question_type: "single", options: ["A"], correct_answers: [] },
    { lang: "en", question: "Q?", question_type: "single", options: ["A", "B"], correct_answers: [0, 1] },
    { lang: "en", question: "Q?", question_type: "multi", options: ["A", "B"], correct_answers: [1, 1] },
    { lang: "en", question: "Q?", question_type: "multi", options: ["A", "B"], correct_answers: [2] },
    { lang: "en", question: "Q?", question_type: "single", options: '["A"]', correct_answers: [0] },
  ];
  for (const quizQuestion of invalidQuestions) {
    assert.throws(
      () => buildCatalogSeed([{ ...base, quiz_questions: [quizQuestion] }], {}),
      /invalid quiz question/i,
    );
  }
});

test("buildCatalogSeed canonicalizes catalog country codes for geography queries", () => {
  const seed = buildCatalogSeed([{
    category: "animal",
    latitude: 1,
    longitude: 2,
    country_code: " gl ",
    translations: [{ lang: "en", title: "Greenland animal" }],
  }], {});

  assert.equal(seed.statements[0]?.values[4], "GL");
});

test('catalog import removes placeholder questions, quiz gates and derived cards', () => {
  const seed = buildCatalogSeed([{
    category: 'food', latitude: 1, longitude: 2, is_published: true,
    translations: [{ lang: 'en', title: 'Fava', description: 'A dish made with fava beans and olive oil.' }],
    quiz_questions: [{ lang: 'en', question: 'Which country or region is Fava associated with?', question_type: 'single', options: ['Turkey', 'Japan', 'France'], correct_answers: [0] }],
  }], {});
  assert.equal(seed.statements.some(statement => statement.text.startsWith('INSERT INTO quiz_questions')), false);
  assert.equal(seed.statements.some(statement => statement.text.startsWith('INSERT INTO flashcards') && statement.values.includes('catalog_quiz')), false);
  const item = seed.statements.find(statement => statement.text.startsWith('INSERT INTO items'))!;
  assert.equal(item.values.at(-2), false);
});


test('removing placeholder questions preserves surviving question and flashcard seed IDs', () => {
  const item = { category: 'food', latitude: 1, longitude: 2, translations: [{ lang: 'en', title: 'Lemonade' }], quiz_questions: [
    { lang: 'en', question: 'Which country is lemonade associated with?', question_type: 'single', options: ['A', 'B'], correct_answers: [0] },
    { lang: 'en', question: 'Which fruit gives lemonade its sour flavor?', question_type: 'single', options: ['Lemon', 'Orange'], correct_answers: [0] },
  ] };
  const imported = buildCatalogSeed([item], {});
  const cleaned = buildCatalogSeed([{ ...item, quiz_questions: [{ ...item.quiz_questions[1]!, seed_index: 1 }] }], {});
  assert.deepEqual(imported, cleaned);
});
