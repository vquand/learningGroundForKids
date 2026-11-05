import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { applyContentReviewBatches } from "../scripts/apply-content-review-batches.mjs";

test("content review batch merger validates ownership and applies bilingual fields", async () => {
  const root = await mkdtemp("/tmp/plg-review-batches-");
  const dataDir = join(root, "data");
  const batchDir = join(dataDir, "content-review-batches");
  await mkdir(batchDir, { recursive: true });
  const item = {
    category: "food", latitude: 1, longitude: 2,
    translations: [
      { lang: "en", title: "Test dish", description: "Short dish", history: "Short dish" },
      { lang: "vi", title: "Món thử", description: "Món ăn ngắn", history: "Món ăn ngắn" },
    ],
  };
  await writeFile(join(dataDir, "legacy-catalog.json"), JSON.stringify([item]));
  await writeFile(join(dataDir, "generated-catalog.json"), "[]");
  await writeFile(join(dataDir, "expanded-catalog.json"), "[]");
  await writeFile(join(batchDir, "food.json"), JSON.stringify([{
    item_key: "food|1|2|Test dish",
    description_en: "Test dish is a regional food with a documented story.",
    history_en: "The dish is prepared in local kitchens and shared at family meals.",
    description_vi: "Đây là món ăn vùng miền có câu chuyện được ghi nhận.",
    history_vi: "Món ăn được chế biến và dùng trong các bữa cơm gia đình.",
    ingredients: ["rice", "herbs"],
    sources: [{ url: "https://example.org/test-dish", publisher: "Example" }],
  }]));
  try {
    const result = await applyContentReviewBatches({ dataDir, batchDir, write: true });
    assert.deepEqual(result, { batch_files: 1, patches: 1, updated: 1, write: true });
    const updated = JSON.parse(await readFile(join(dataDir, "legacy-catalog.json"), "utf8"))[0];
    assert.equal(updated.translations[0].description, "Test dish is a regional food with a documented story.");
    assert.deepEqual(updated.rich_fields.ingredients, [
      { name: "rice", quantity: "varies by regional recipe" },
      { name: "herbs", quantity: "varies by regional recipe" },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
