import assert from 'node:assert/strict';
import test from 'node:test';
import { CalendarApiError } from '../src/api/calendar.ts';
import type { MealPlanItem } from '../src/types/calendarMeals.ts';
import { addMealLibraryEntry, deleteMealPlanOverride, removeMealLibraryEntry, saveMealPlanList } from '../src/api/calendarMeals.ts';

type Captured = { path: string; init?: RequestInit };

async function withFetch(response: () => Response, run: (captured: Captured[]) => Promise<void>) {
  const original = globalThis.fetch;
  const captured: Captured[] = [];
  globalThis.fetch = async (input, init) => {
    captured.push({ path: String(input), init });
    return response();
  };
  try {
    await run(captured);
  } finally {
    globalThis.fetch = original;
  }
}

test('library add posts the food and optional custom name to the profile route and returns the row', async () => {
  await withFetch(() => Response.json({ id: 'meal-1', food_key: 'fish', custom_name: 'Cá kho' }, { status: 201 }), async (captured) => {
    const entry = await addMealLibraryEntry('kid/a', { food: 'fish', custom_name: 'Cá kho' });
    assert.deepEqual(entry, { id: 'meal-1', food_key: 'fish', custom_name: 'Cá kho' });
    assert.equal(captured[0]?.path, '/api/v1/profiles/kid%2Fa/calendar/meals');
    assert.equal(captured[0]?.init?.method, 'POST');
    assert.equal(captured[0]?.init?.credentials, 'same-origin');
    assert.deepEqual(JSON.parse(String(captured[0]?.init?.body)), { food: 'fish', custom_name: 'Cá kho' });
  });
});

test('library add on an existing row (200) and a plain food serialise without custom_name', async () => {
  await withFetch(() => Response.json({ id: 'meal-2', food_key: 'rice', custom_name: null }, { status: 200 }), async (captured) => {
    await addMealLibraryEntry('kid-a', { food: 'rice' });
    assert.deepEqual(JSON.parse(String(captured[0]?.init?.body)), { food: 'rice' });
  });
});

test('library full (422 CALENDAR_LIBRARY_FULL) surfaces the code and status', async () => {
  await withFetch(() => Response.json({ error: { code: 'CALENDAR_LIBRARY_FULL', message: 'My meals is full.' } }, { status: 422 }), async () => {
    await assert.rejects(
      addMealLibraryEntry('kid-a', { food: 'tea' }),
      (error: unknown) => error instanceof CalendarApiError && error.status === 422 && error.code === 'CALENDAR_LIBRARY_FULL',
    );
  });
});

test('library add conflict (409) keeps a typed error for the view to show', async () => {
  await withFetch(() => Response.json({ error: { code: 'CALENDAR_REVISION_CONFLICT', message: 'Changed.' } }, { status: 409 }), async () => {
    await assert.rejects(addMealLibraryEntry('kid-a', { food: 'tea' }), (error: unknown) => error instanceof CalendarApiError && error.status === 409);
  });
});

test('library remove deletes one row by id and treats 204 as success', async () => {
  await withFetch(() => new Response(null, { status: 204 }), async (captured) => {
    await removeMealLibraryEntry('kid/a', 'meal 1');
    assert.equal(captured[0]?.path, '/api/v1/profiles/kid%2Fa/calendar/meals/meal%201');
    assert.equal(captured[0]?.init?.method, 'DELETE');
  });
});

test('library remove of an unknown or foreign row (404) fails without changing the list', async () => {
  await withFetch(() => Response.json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, { status: 404 }), async () => {
    await assert.rejects(removeMealLibraryEntry('kid-a', 'other'), (error: unknown) => error instanceof CalendarApiError && error.status === 404);
  });
});

test('meal list save sends the mixed meal item shapes and the revision it was given', async () => {
  const items: MealPlanItem[] = [{ food: 'rice' }, { food: 'custom', icon: 'pho', name: 'Phở bò' }, { medicine: { method: 'syrup', color: 'blue', qty: 1 } }];
  await withFetch(() => Response.json({ id: 'list', items, revision: 1, source: 'template' }), async (captured) => {
    await saveMealPlanList('kid-a', { scope: 'template', weekday: 4, area: 'meal_dinner', items, expected_revision: 0 });
    assert.equal(captured[0]?.path, '/api/v1/profiles/kid-a/calendar/lists');
    assert.equal(captured[0]?.init?.method, 'PUT');
    assert.deepEqual(JSON.parse(String(captured[0]?.init?.body)), { scope: 'template', weekday: 4, area: 'meal_dinner', items, expected_revision: 0 });
  });
});

test('meal list save conflict (409) keeps the server copy on the typed error', async () => {
  await withFetch(() => Response.json({ error: { code: 'CALENDAR_REVISION_CONFLICT', message: 'Changed.', details: { current: { id: 'x', items: [], revision: 7, source: 'override' } } } }, { status: 409 }), async () => {
    await assert.rejects(
      saveMealPlanList('kid-a', { scope: 'date', date: '2026-11-03', area: 'medicine', items: [], expected_revision: 2 }),
      (error: unknown) => error instanceof CalendarApiError && error.status === 409 && error.current?.revision === 7,
    );
  });
});

test('restore deletes the override with its revision in the query', async () => {
  await withFetch(() => new Response(null, { status: 204 }), async (captured) => {
    await deleteMealPlanOverride('kid-a', '2026-11-03', 'meal_lunch', 5);
    const url = new URL(captured[0]?.path ?? '', 'http://local');
    assert.equal(url.pathname, '/api/v1/profiles/kid-a/calendar/lists');
    assert.equal(url.searchParams.get('date'), '2026-11-03');
    assert.equal(url.searchParams.get('area'), 'meal_lunch');
    assert.equal(url.searchParams.get('expected_revision'), '5');
    assert.equal(captured[0]?.init?.method, 'DELETE');
  });
});
