import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolve } from "node:path";

import {
  buildReviewedItem,
  classifyCatalogCategory,
  countWords,
  isInsufficientContent,
  isLikelyVietnamese,
  isQualityDescription,
  isPlaceholderText,
  truncateWords,
} from "../scripts/catalog-content-review-lib.mjs";

test("content review truncates summaries to 150 words without cutting the source category", () => {
  const source = Array.from({ length: 190 }, (_, index) => `word${index}`).join(" ");
  const summary = truncateWords(source, 150);

  assert.equal(countWords(summary), 150);
  assert.equal(summary.endsWith("."), false);
});

test("placeholder detection catches generated catalog copy", () => {
  assert.equal(isPlaceholderText("This map item helps children compare places around the world."), true);
  assert.equal(isPlaceholderText("This is one of the gentlest and most soothing songs ever written."), true);
  assert.equal(isPlaceholderText("Ammonite is an animal entry in the reference catalog. The linked references provide context for its classification and distribution."), true);
  assert.equal(isPlaceholderText("The saola is a rare forest antelope found in the Annamite Range."), false);
});

test("insufficient content catches short category-only descriptions", () => {
  assert.equal(isInsufficientContent("Vietnamese noodle dish"), true);
  assert.equal(isInsufficientContent("Mì Quảng is a Vietnamese noodle dish from Quảng Nam Province in central Vietnam."), false);
});

test("description quality rejects short, identical-language, and English-like Vietnamese copy", () => {
  assert.equal(isQualityDescription("subspecies of tiger"), false);
  assert.equal(isQualityDescription("species of Old World monkey", { language: "vi" }), false);
  assert.equal(isQualityDescription("Chongqing blood and tripe hotpot-style dish", { language: "vi" }), false);
  assert.equal(isQualityDescription("A cenote is a natural pit or sinkhole formed when limestone collapses and exposes groundwater.", { language: "vi" }), false);
  assert.equal(isQualityDescription("Mì Quảng là một món mì của Việt Nam với rau thơm và đậu phộng.", { language: "vi" }), true);
  assert.equal(isLikelyVietnamese("Mì Quảng là một món mì của Việt Nam."), true);
  assert.equal(isLikelyVietnamese("species of Old World monkey"), false);
});

test("Mì Quảng has source-backed bilingual content and separate ingredients", async () => {
  const items = JSON.parse(await readFile(resolve(process.cwd(), "data", "expanded-catalog.json"), "utf8"));
  const item = items.find((candidate: any) => candidate.translations?.some((translation: any) => translation.title === "Mì Quảng"));
  assert.ok(item);
  for (const translation of item.translations) {
    assert.equal(isInsufficientContent(translation.description), false);
    assert.ok(countWords(translation.description) <= 150);
    assert.ok(translation.description.split(/(?<=[.!?])\s+/u).length >= 10);
    assert.notEqual(translation.history, translation.description);
  }
  assert.ok(item.rich_fields.ingredients.length >= 5);
  assert.equal(item.rich_fields.sources[0].url, "https://en.wikipedia.org/wiki/M%C3%AC_Qu%E1%BA%A3ng");
});

test("category classification uses source evidence while preserving the catalog vocabulary", () => {
  assert.equal(classifyCatalogCategory("A traditional noodle dish made with rice flour and herbs."), "food");
  assert.equal(classifyCatalogCategory("A mammal species living in tropical forests."), "animal");
  assert.equal(classifyCatalogCategory("A song released by a Vietnamese singer."), "music");
  assert.equal(classifyCatalogCategory("A temple built in the eighteenth century."), "monument");
});

test("reviewed food content keeps a separate ingredient section and source metadata", () => {
  const item = {
    category: "food",
    translations: [
      { lang: "en", title: "Pho", description: "This map item helps children compare places." },
      { lang: "vi", title: "Phở", description: "Nội dung này gắn với Việt Nam." },
    ],
    recipe: "A placeholder recipe.",
    rich_fields: { recipe_steps: ["Cook it."] },
  };
  const reviewed = buildReviewedItem(item, {
    titleEn: "Pho",
    titleVi: "Phở",
    category: "food",
    descriptionEn: "Pho is a Vietnamese noodle soup made with broth, rice noodles, herbs, and meat.",
    descriptionVi: "Phở là món súp mì của Việt Nam, gồm nước dùng, bánh phở, rau thơm và thịt.",
    historyEn: "Pho developed in northern Vietnam and became a beloved dish in many countries.",
    historyVi: "Phở phát triển ở miền Bắc Việt Nam và trở thành món ăn được yêu thích ở nhiều quốc gia.",
    ingredients: ["rice noodles", "broth", "herbs", "beef"],
    sources: [{ url: "https://en.wikipedia.org/wiki/Ph%E1%BB%9F", publisher: "English Wikipedia" }],
  });

  assert.equal(reviewed.translations[0].description, "Pho is a Vietnamese noodle soup made with broth, rice noodles, herbs, and meat.");
  assert.deepEqual(reviewed.rich_fields.ingredients, [
    { name: "rice noodles", quantity: "varies by regional recipe" },
    { name: "broth", quantity: "varies by regional recipe" },
    { name: "herbs", quantity: "varies by regional recipe" },
    { name: "beef", quantity: "varies by regional recipe" },
  ]);
  assert.deepEqual(reviewed.rich_fields.sources, [{ url: "https://en.wikipedia.org/wiki/Ph%E1%BB%9F", publisher: "English Wikipedia" }]);
  assert.ok(countWords(reviewed.translations[0].description) <= 150);
});

test("reviewed items fail closed instead of copying English-like Vietnamese text", () => {
  const reviewed = buildReviewedItem({
    category: "food",
    translations: [
      { lang: "en", title: "Mao xue wang", description: "old English text", history: "old English text" },
      { lang: "vi", title: "Mao xue wang", description: "Chongqing blood and tripe hotpot-style dish", history: "Chongqing blood and tripe hotpot-style dish" },
    ],
  }, {
    titleEn: "Mao xue wang",
    titleVi: "Mao xue wang",
    category: "food",
    descriptionEn: "Mao xue wang is a Chongqing dish made with blood curd, tripe, sprouts, and mala broth.",
    descriptionVi: "Chongqing blood and tripe hotpot-style dish",
    historyEn: "The dish belongs to Chongqing cuisine and is served fully cooked in a communal bowl.",
    historyVi: "Chongqing blood and tripe hotpot-style dish",
  });

  assert.equal(reviewed.translations[1].description, "");
  assert.equal(reviewed.translations[1].history, "");
});

test("checked-in catalogs contain reviewed descriptions and histories", async () => {
  for (const filename of ["legacy-catalog.json", "generated-catalog.json", "expanded-catalog.json"]) {
    const items = JSON.parse(await readFile(resolve(process.cwd(), "data", filename), "utf8"));
    for (const item of items) {
      for (const translation of item.translations ?? []) {
        assert.ok(translation.description, `${filename}:${translation.lang} is missing a description`);
        assert.ok(translation.history, `${filename}:${translation.lang} is missing a history`);
        assert.ok(countWords(translation.description) <= 150, `${filename}:${translation.title} exceeds 150 words`);
        assert.ok(!isPlaceholderText(translation.description), `${filename}:${translation.title} has placeholder description`);
        assert.ok(!isPlaceholderText(translation.history), `${filename}:${translation.title} has placeholder history`);
      }
    }
  }
});

test("checked-in catalogs contain no placeholder prose or quiz scaffolding", async () => {
  for (const filename of ["legacy-catalog.json", "generated-catalog.json", "expanded-catalog.json"]) {
    const items = JSON.parse(await readFile(resolve(process.cwd(), "data", filename), "utf8"));
    for (const item of items) {
      for (const translation of item.translations ?? []) {
        assert.equal(isPlaceholderText(translation.description), false, `${filename}:${translation.title} has placeholder description`);
        assert.equal(isPlaceholderText(translation.history), false, `${filename}:${translation.title} has placeholder history`);
      }
      for (const fact of item.fun_facts ?? []) {
        assert.equal(isPlaceholderText(fact), false, `${filename}:${item.category} has placeholder fun fact`);
      }
      for (const question of item.quiz_questions ?? []) {
        assert.equal(/^where is .* associated with\?$/iu.test(question.question), false, `${filename} has awkward location quiz wording`);
        assert.equal(question.options.some((option: string) => /^option\s+\d+$/iu.test(option)), false, `${filename} has placeholder quiz option`);
      }
    }
  }
});

test("checked-in catalogs contain meaningful bilingual descriptions", async () => {
  for (const filename of ["legacy-catalog.json", "generated-catalog.json", "expanded-catalog.json"]) {
    const items = JSON.parse(await readFile(resolve(process.cwd(), "data", filename), "utf8"));
    for (const item of items) {
      const english = item.translations?.find((translation: any) => translation.lang === "en")?.description;
      const vietnamese = item.translations?.find((translation: any) => translation.lang === "vi")?.description;
      assert.equal(isQualityDescription(english), true, `${filename}:${item.category} English description is too short or generic`);
      assert.equal(isQualityDescription(vietnamese, { language: "vi" }), true, `${filename}:${item.category} Vietnamese description is not meaningful Vietnamese`);
      assert.notEqual(english.trim().toLocaleLowerCase(), vietnamese.trim().toLocaleLowerCase(), `${filename}:${item.category} copied English into Vietnamese`);
    }
  }
});

test("checked-in catalogs contain meaningful bilingual histories", async () => {
  for (const filename of ["legacy-catalog.json", "generated-catalog.json", "expanded-catalog.json"]) {
    const items = JSON.parse(await readFile(resolve(process.cwd(), "data", filename), "utf8"));
    for (const item of items) {
      const english = item.translations?.find((translation: any) => translation.lang === "en")?.history;
      const vietnamese = item.translations?.find((translation: any) => translation.lang === "vi")?.history;
      assert.equal(isQualityDescription(english), true, `${filename}:${item.category} English history is too short or generic`);
      assert.equal(isQualityDescription(vietnamese, { language: "vi" }), true, `${filename}:${item.category} Vietnamese history is not meaningful Vietnamese`);
      assert.notEqual(english.trim().toLocaleLowerCase(), vietnamese.trim().toLocaleLowerCase(), `${filename}:${item.category} copied English into Vietnamese history`);
    }
  }
});

test('human-approved lessons and authored practice survive automatic research refresh', () => {
  const item = { content_review: { batch: 'exploring-30-2026-10-23', approved_at: '2026-10-23' },
    translations: [{lang:'en',title:'Old Faithful',description:'Approved mechanism',history:'Approved variable interval'}],
    flashcards: [{key:'heat',lang:'en',front:'What supplies heat?',back:'The volcanic system.'}] };
  const before = structuredClone(item);
  assert.deepEqual(buildReviewedItem(item, {descriptionEn:'A crawled replacement',historyEn:'Repeated filler'}), before);
  assert.deepEqual(item, before);
});
