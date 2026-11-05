import assert from 'node:assert/strict';
import test from 'node:test';
import { CalendarApiError, fetchCalendarWeather, saveCalendarList } from '../src/api/calendar.ts';

test('calendar 409 preserves the server current list as a typed error', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: { code: 'CALENDAR_REVISION_CONFLICT', message: 'The calendar list has changed.', details: { current: { id: 'new', items: [{ subject: 'science' }], revision: 4, source: 'template' } } } }, { status: 409 });
  try {
    await assert.rejects(
      saveCalendarList('kid/a', { scope: 'template', weekday: 4, area: 'study_morning', items: [{ subject: 'math' }], expected_revision: 3 }),
      (error: unknown) => error instanceof CalendarApiError && error.status === 409 && error.code === 'CALENDAR_REVISION_CONFLICT' && error.current?.revision === 4,
    );
  } finally { globalThis.fetch = original; }
});

test('calendar API keeps same-origin credentials and serializes the frozen contract', async () => {
  const original = globalThis.fetch; let request: { path: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => { request = { path: String(input), init }; return Response.json({ id: 'saved', items: [], revision: 1, source: 'template' }); };
  try {
    await saveCalendarList('kid/a', { scope: 'template', weekday: 2, area: 'study_afternoon', items: [], expected_revision: 0 });
    assert.equal(request?.path, '/api/v1/profiles/kid%2Fa/calendar/lists');
    assert.equal(request?.init?.credentials, 'same-origin');
    assert.deepEqual(JSON.parse(String(request?.init?.body)), { scope: 'template', weekday: 2, area: 'study_afternoon', items: [], expected_revision: 0 });
  } finally { globalThis.fetch = original; }
});

test('calendar weather API uses the frozen same-origin profile route', async () => {
  const original = globalThis.fetch; let request: { path: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => { request = { path: String(input), init }; return Response.json({ status: 'ok', location_label: 'Da Nang, VN', updated_at: null, days: [] }); };
  try {
    const response = await fetchCalendarWeather('kid/a');
    assert.equal(response.status, 'ok');
    assert.equal(request?.path, '/api/v1/profiles/kid%2Fa/calendar/weather');
    assert.equal(request?.init?.credentials, 'same-origin');
  } finally { globalThis.fetch = original; }
});
