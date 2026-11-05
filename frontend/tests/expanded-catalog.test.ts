import { loadCatalogSeeds } from "../scripts/catalog-seeds.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type JsonRecord = Record<string, any>;

const EXPECTED_COUNTS = {
  food: 1000,
  monument: 500,
  landmark: 500,
  phenomenon: 100,
  animal: 2000,
};

const VIETNAM_MINIMUMS = {
  food: 100,
  monument: 50,
  landmark: 50,
  phenomenon: 10,
  animal: 200,
};

async function readJson(path: string): Promise<JsonRecord[]> {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

async function readExistingItems(): Promise<JsonRecord[]> {
  const result = JSON.parse(await readFile(new URL("../data/generated-catalog.json", import.meta.url), "utf8"));
  result.push(...await loadCatalogSeeds(["food", "monument", "landmark", "phenomenon", "animal"]));
  return result;
}

function englishTitle(item: JsonRecord): string {
  return item.translations?.find((translation: JsonRecord) => translation.lang === "en")?.title ?? "";
}

function itemKey(item: JsonRecord): string {
  return `${item.category}|${String(item.latitude)}|${String(item.longitude)}|${englishTitle(item)}`;
}

function normalizedTitle(item: JsonRecord): string {
  return englishTitle(item).normalize("NFKD").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
}

test("expanded catalog has the requested category and Vietnam quotas", async () => {
  const items = await readJson("../data/expanded-catalog.json");
  assert.equal(items.length, 4100);

  const counts = items.reduce<Record<string, JsonRecord[]>>((groups, item) => {
    const category = String(item.category);
    (groups[category] ??= []).push(item);
    return groups;
  }, {});
  for (const [category, expected] of Object.entries(EXPECTED_COUNTS)) {
    assert.equal(counts[category]?.length, expected, `wrong ${category} count`);
  }

  for (const [category, minimum] of Object.entries(VIETNAM_MINIMUMS)) {
    const count = items.filter((item) => item.category === category && item.country_code === "VN").length;
    assert.ok(count >= minimum, `${category} needs at least ${minimum} Vietnam items, got ${count}`);
  }
});

test("expanded catalog records have the current import shape and no existing identity collision", async () => {
  const [items, existing] = await Promise.all([
    readJson("../data/expanded-catalog.json"),
    readExistingItems(),
  ]);
  const existingKeys = new Set(existing.map(itemKey));
  const keys = new Set<string>();
  const titles = new Set<string>();

  for (const item of items) {
    const authored = Boolean(item.content_review?.approved_at && item.flashcards);
    assert.ok(["food", "monument", "landmark", "phenomenon", "animal"].includes(item.category));
    assert.equal(item.icon_slug, item.category);
    assert.equal(typeof item.is_published, 'boolean', 'reviewed records may be retained unpublished for enrichment');
    assert.equal(typeof item.latitude, "number");
    assert.equal(typeof item.longitude, "number");
    assert.ok(item.latitude >= -90 && item.latitude <= 90);
    assert.ok(item.longitude >= -180 && item.longitude <= 180);
    assert.match(item.country_code, /^[A-Z]{2}$/);
    assert.equal(item.media?.length, 1);
    assert.equal(item.media[0].media_type, "image");
    assert.equal(item.media[0].filename, `placeholder-${item.category}.jpg`);
    assert.equal(item.media[0].label, englishTitle(item));
    assert.deepEqual(item.translations.map((translation: JsonRecord) => translation.lang), ["en", "vi"]);
    assert.ok(item.translations.every((translation: JsonRecord) => translation.title && translation.description && translation.history));
    assert.equal(item.fun_facts?.length, authored ? 0 : 3);
    assert.equal(item.quiz_questions?.length, authored ? 4 : 0);
    if (authored) assert.deepEqual(item.quiz_questions.map((question: JsonRecord) => [question.group, question.lang, question.sort_order]), [
      [0, "en", 0],
      [0, "vi", 0],
      [1, "en", 1],
      [1, "vi", 1],
    ]);
    for (const question of item.quiz_questions as JsonRecord[]) {
      assert.equal(question.question_type, "single");
      assert.equal(question.options.length, authored ? 3 : 4);
      assert.equal(question.correct_answers.length, 1);
      assert.ok(question.correct_answers[0] >= 0 && question.correct_answers[0] < question.options.length);
    }
    if (item.category === "food") {
      assert.ok(item.recipe);
      if (item.rich_fields && !item.rich_fields.sources) {
        assert.ok(item.rich_fields.ingredients?.length >= 2);
        assert.ok(item.rich_fields.recipe_steps?.length >= 2);
      }
    }
    if (item.category === "monument") {
      if (authored) assert.equal(item.location_desc, null);
      else assert.ok(item.location_desc);
      if (item.rich_fields && !item.rich_fields.sources) {
        assert.ok(item.rich_fields.construction_date);
        assert.ok(Object.keys(item.rich_fields.dimensions ?? {}).length >= 1);
      }
    }
    if (item.category === "landmark") {
      if (authored) assert.equal(item.location_desc, null);
      else assert.ok(item.location_desc);
      if (item.rich_fields && !item.rich_fields.sources) assert.ok(Object.keys(item.rich_fields.key_stats ?? {}).length >= 1);
    }
    if (item.category === "animal") {
      if (authored) assert.equal(item.location_desc, null);
      else assert.ok(item.location_desc);
      if (item.rich_fields && !item.rich_fields.sources) {
        assert.ok(item.rich_fields.classification || item.rich_fields.population || item.rich_fields.endangered_status);
      }
    }
    if (item.category === "phenomenon") {
      if (item.rich_fields && !item.rich_fields.sources) assert.ok(Object.keys(item.rich_fields.kid_metrics ?? {}).length >= 1);
    }

    assert.equal(keys.has(itemKey(item)), false, `duplicate generated key ${itemKey(item)}`);
    assert.equal(existingKeys.has(itemKey(item)), false, `existing key collision ${itemKey(item)}`);
    assert.equal(titles.has(`${item.category}|${normalizedTitle(item)}`), false, `duplicate title ${englishTitle(item)}`);
    keys.add(itemKey(item));
    titles.add(`${item.category}|${normalizedTitle(item)}`);
  }
});

test("expanded catalog provenance covers every item with two HTTPS sources", async () => {
  const [items, provenance] = await Promise.all([
    readJson("../data/expanded-catalog.json"),
    readJson("../data/expanded-catalog-provenance.json"),
  ]);
  assert.equal(provenance.length, items.length);
  const itemKeys = new Set(items.map(itemKey));
  for (const entry of provenance) {
    assert.ok(itemKeys.has(entry.item_key));
    assert.ok(entry.sources.length >= 2);
    assert.ok(new Set(entry.sources.map((source: JsonRecord) => source.url)).size >= 2);
    assert.ok(entry.sources.every((source: JsonRecord) => source.url.startsWith("https://")));
    assert.ok(entry.sources.every((source: JsonRecord) => source.accessed_at));
  }
});
