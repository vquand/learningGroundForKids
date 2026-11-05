import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { getSeasonalTheme } from "../src/lib/seasonalTheme.ts";

function vietnamDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 5));
}

test("a seasonal background is selected throughout the year", () => {
  assert.equal(getSeasonalTheme(vietnamDate(2026, 2, 13)), "winter");
  assert.equal(getSeasonalTheme(vietnamDate(2026, 3, 1)), "spring");
  assert.equal(getSeasonalTheme(vietnamDate(2026, 6, 1)), "summer");
  assert.equal(getSeasonalTheme(vietnamDate(2026, 9, 4)), "fall");
  assert.equal(getSeasonalTheme(vietnamDate(2026, 12, 27)), "winter");
});

test("event art starts three days before and ends one day after Vietnamese National Day", () => {
  assert.equal(getSeasonalTheme(vietnamDate(2026, 8, 29)), "summer");
  assert.equal(getSeasonalTheme(vietnamDate(2026, 8, 30)), "vietnam-national-day");
  assert.equal(getSeasonalTheme(vietnamDate(2026, 9, 3)), "vietnam-national-day");
  assert.equal(getSeasonalTheme(vietnamDate(2026, 9, 4)), "fall");
});

test("Tet art follows the same three-days-before through one-day-after window", () => {
  assert.equal(getSeasonalTheme(vietnamDate(2026, 2, 13)), "winter");
  assert.equal(getSeasonalTheme(vietnamDate(2026, 2, 14)), "tet");
  assert.equal(getSeasonalTheme(vietnamDate(2026, 2, 18)), "tet");
  assert.equal(getSeasonalTheme(vietnamDate(2026, 2, 19)), "winter");
});

test("Halloween and Christmas use the same short event window", () => {
  assert.equal(getSeasonalTheme(vietnamDate(2026, 10, 27)), "fall");
  assert.equal(getSeasonalTheme(vietnamDate(2026, 10, 28)), "halloween");
  assert.equal(getSeasonalTheme(vietnamDate(2026, 11, 1)), "halloween");
  assert.equal(getSeasonalTheme(vietnamDate(2026, 11, 2)), "fall");

  assert.equal(getSeasonalTheme(vietnamDate(2026, 12, 21)), "winter");
  assert.equal(getSeasonalTheme(vietnamDate(2026, 12, 22)), "christmas");
  assert.equal(getSeasonalTheme(vietnamDate(2026, 12, 26)), "christmas");
  assert.equal(getSeasonalTheme(vietnamDate(2026, 12, 27)), "winter");
});

test("invalid dates return no theme", () => {
  assert.equal(getSeasonalTheme(new Date(Number.NaN)), null);
});

test("each seasonal theme has a local pastel background illustration", () => {
  const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));

  for (const season of ["spring", "summer", "fall", "winter", "halloween", "christmas", "vietnam-national-day", "tet"]) {
    const asset = resolve(publicDirectory, "illustrations", "seasonal", `${season}-pastel-chubby.png`);
    assert.ok(existsSync(asset), `${season} background is missing at ${asset}`);
  }
});
