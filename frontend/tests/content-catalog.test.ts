import { loadCatalogSeeds } from "../scripts/catalog-seeds.mjs";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("generated catalog contains 200 bilingual cross-era items", async () => {
  const source = await readFile(new URL("../data/generated-catalog.json", import.meta.url), "utf8");
  const items = JSON.parse(source) as Array<Record<string, unknown>>;
  const categories = items.reduce<Record<string, number>>((counts, item) => {
    const category = String(item.category);
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});

  assert.equal(items.length, 200);
  assert.deepEqual(categories, { animal: 50, food: 50, landmark: 50, monument: 50 });
  assert.equal(
    items.every((item) => {
      const translations = item.translations as Array<{ lang: string }>;
      return translations.some((translation) => translation.lang === "en")
        && translations.some((translation) => translation.lang === "vi")
        && (item.quiz_questions as unknown[]).length === (item.content_review ? 4 : 0);
    }),
    true,
  );
});

test("image overrides retain reusable source and license metadata", async () => {
  const source = await readFile(new URL("../data/image-overrides.json", import.meta.url), "utf8");
  const overrides = Object.values(JSON.parse(source)) as Array<Record<string, unknown>>;

  assert.ok(overrides.length > 0);
  assert.equal(
    overrides.every((override) => String(override.url).startsWith("https://")
      && String(override.source_url).startsWith("https://")
      && Boolean(override.license)),
    true,
  );
});

test("generated category illustrations cover every placeholder category", async () => {
  for (const category of ["food", "monument", "landmark", "music", "movie", "phenomenon", "animal"]) {
    const asset = await stat(new URL(`../public/item-category-illustrations/${category}.webp`, import.meta.url));
    assert.ok(asset.isFile());
    assert.ok(asset.size > 0);
  }
});

test("every seeded catalog item has an image override", async () => {
  const items = [
    ...JSON.parse(await readFile(new URL("../data/generated-catalog.json", import.meta.url), "utf8")),
    ...JSON.parse(await readFile(new URL("../data/expanded-catalog.json", import.meta.url), "utf8")),
  ] as Array<Record<string, any>>;
  items.push(...await loadCatalogSeeds());
  const overrides = JSON.parse(await readFile(new URL("../data/image-overrides.json", import.meta.url), "utf8")) as Record<string, { url?: string }>;
  const missing = items.filter((item) => !overrides[`${item.category}|${item.latitude}|${item.longitude}|${item.translations?.find((translation: any) => translation.lang === "en")?.title ?? ""}`]?.url);
  assert.deepEqual(missing, []);
});
