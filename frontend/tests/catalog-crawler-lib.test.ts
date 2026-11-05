import assert from "node:assert/strict";
import test from "node:test";

import { buildCatalogItem, canonicalCategory } from "../scripts/catalog-crawler-lib.mjs";

test("animal crawl records use the canonical animal content shape", () => {
  assert.equal(canonicalCategory("animal"), "animal");

  const item = buildCatalogItem(
    "animal",
    {
      titleEn: "Test mammal",
      titleVi: "Động vật có vú thử nghiệm",
      descriptionEn: "A source-backed animal record.",
      descriptionVi: "Một bản ghi động vật có nguồn.",
      countryCode: "VN",
      countryNameEn: "Vietnam",
      countryNameVi: "Việt Nam",
      latitude: 16,
      longitude: 108,
      placeNameEn: "Vietnam",
      placeNameVi: "Việt Nam",
      coordinateBasis: "direct",
      classification: "mammal",
      population: "wild populations vary",
      endangeredStatus: "data varies by species",
      startYear: -1000000,
    },
    ["Vietnam"],
    ["Việt Nam"],
  );

  assert.equal(item.category, "animal");
  assert.equal(item.location_desc, "Test mammal is associated with Vietnam.");
  assert.deepEqual(item.rich_fields, {
    classification: "mammal",
    population: "wild populations vary",
    endangered_status: "data varies by species",
  });
  assert.equal(item.time_precision, "mya");
});
