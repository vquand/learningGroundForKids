import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MEAL_FOOD_KEYS, MEDICINE_COLOR_KEYS, MEDICINE_METHOD_KEYS } from '../src/calendar/catalog.js';

// The frontend keeps labels and artwork in lib/calendarMealCatalog.ts. Its key tables are read from source so
// this server test never imports frontend code (the server tsconfig roots at server/).
const catalogUrl = new URL('../../frontend/src/lib/calendarMealCatalog.ts', import.meta.url);
const typesUrl = new URL('../../frontend/src/types/calendarMeals.ts', import.meta.url);

/** Keys listed as `['key', ...]` rows inside one named frontend table. */
function tableKeys(source: string, tableName: string): string[] {
  const start = source.indexOf(`const ${tableName} = [`);
  assert.ok(start >= 0, `frontend table ${tableName} exists`);
  const end = source.indexOf('] as const', start);
  assert.ok(end > start, `frontend table ${tableName} is closed`);
  return [...source.slice(start, end).matchAll(/^\s*\[\s*'([a-z_]+)'/gm)].map((match) => match[1]!);
}

/** Keys of an exported `as const` array in the frontend types module. */
function constKeys(source: string, constName: string): string[] {
  const start = source.indexOf(`export const ${constName} = [`);
  assert.ok(start >= 0, `frontend array ${constName} exists`);
  const end = source.indexOf('] as const', start);
  return [...source.slice(start, end).matchAll(/'([a-z_]+)'/g)].map((match) => match[1]!);
}

function assertSameKeySet(name: string, frontend: readonly string[], server: readonly string[]) {
  assert.equal(new Set(frontend).size, frontend.length, `${name}: frontend keys are unique`);
  assert.equal(new Set(server).size, server.length, `${name}: server keys are unique`);
  const frontendSet = new Set(frontend);
  const serverSet = new Set(server);
  for (const key of server) assert.ok(frontendSet.has(key), `${name}: server key ${key} is missing in the frontend`);
  for (const key of frontend) assert.ok(serverSet.has(key), `${name}: frontend key ${key} is missing on the server`);
}

test('frontend meal food catalog matches the server MEAL_FOOD_KEYS in both directions', async () => {
  const catalog = await readFile(catalogUrl, 'utf8');
  const types = await readFile(typesUrl, 'utf8');
  const frontend = tableKeys(catalog, 'foodEntries');
  assert.equal(frontend.length, 81);
  assertSameKeySet('meal foods', frontend, [...MEAL_FOOD_KEYS]);
  // The frontend type module mirrors the same tuple, so the typed union cannot drift from the labels.
  assertSameKeySet('meal foods (types)', constKeys(types, 'MEAL_FOOD_KEYS'), [...MEAL_FOOD_KEYS]);
});

test('frontend medicine methods match the server MEDICINE_METHOD_KEYS in both directions', async () => {
  const catalog = await readFile(catalogUrl, 'utf8');
  const types = await readFile(typesUrl, 'utf8');
  const frontend = tableKeys(catalog, 'methodEntries');
  assert.equal(frontend.length, 9);
  assertSameKeySet('medicine methods', frontend, [...MEDICINE_METHOD_KEYS]);
  assertSameKeySet('medicine methods (types)', constKeys(types, 'MEDICINE_METHOD_KEYS'), [...MEDICINE_METHOD_KEYS]);
});

test('frontend medicine colours match the server MEDICINE_COLOR_KEYS in both directions', async () => {
  const catalog = await readFile(catalogUrl, 'utf8');
  const types = await readFile(typesUrl, 'utf8');
  const frontend = tableKeys(catalog, 'colorEntries');
  assert.equal(frontend.length, 8);
  assertSameKeySet('medicine colours', frontend, [...MEDICINE_COLOR_KEYS]);
  assertSameKeySet('medicine colours (types)', constKeys(types, 'MEDICINE_COLOR_KEYS'), [...MEDICINE_COLOR_KEYS]);
});
