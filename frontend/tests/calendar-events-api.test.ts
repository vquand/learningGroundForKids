import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CalendarEventApiError, createCalendarEvent, deleteCalendarEvent, stopCalendarEventRepeat, updateCalendarEvent,
} from '../src/api/calendarEvents.ts';

type Recorded = { path: string; init?: RequestInit };

async function withFetch(response: () => Response, run: (recorded: Recorded[]) => Promise<void>) {
  const original = globalThis.fetch;
  const recorded: Recorded[] = [];
  globalThis.fetch = async (input, init) => {
    recorded.push({ path: String(input), init });
    return response();
  };
  try {
    await run(recorded);
  } finally {
    globalThis.fetch = original;
  }
}

const EVENT = { id: 'evt-1', title: 'Hiking', icon_key: 'hiking', start_date: '2026-11-02', repeat: 'weekly', repeat_ended_on: null, revision: 1 };
const input = { title: 'Hiking', icon_key: 'hiking', start_date: '2026-11-02', repeat: 'weekly' as const };

test('create posts exactly the frozen fields to the same-origin profile route', async () => {
  await withFetch(() => Response.json(EVENT, { status: 201 }), async (recorded) => {
    const created = await createCalendarEvent('kid/a', { ...input, title: 'Hiking' });
    assert.equal(created.id, 'evt-1');
    assert.equal(recorded[0]?.path, '/api/v1/profiles/kid%2Fa/calendar/events');
    assert.equal(recorded[0]?.init?.method, 'POST');
    assert.equal(recorded[0]?.init?.credentials, 'same-origin');
    assert.deepEqual(JSON.parse(String(recorded[0]?.init?.body)), input);
  });
});

test('update sends the revision it read and the event id in the path', async () => {
  await withFetch(() => Response.json({ ...EVENT, revision: 2 }), async (recorded) => {
    await updateCalendarEvent('kid-a', 'evt/1', { ...input, expected_revision: 1 });
    assert.equal(recorded[0]?.path, '/api/v1/profiles/kid-a/calendar/events/evt%2F1');
    assert.equal(recorded[0]?.init?.method, 'PUT');
    assert.deepEqual(JSON.parse(String(recorded[0]?.init?.body)), { ...input, expected_revision: 1 });
  });
});

test('delete and stop-repeat use the revision query and body', async () => {
  await withFetch(() => new Response(null, { status: 204 }), async (recorded) => {
    await deleteCalendarEvent('kid-a', 'evt-1', 3);
    assert.equal(recorded[0]?.path, '/api/v1/profiles/kid-a/calendar/events/evt-1?expected_revision=3');
    assert.equal(recorded[0]?.init?.method, 'DELETE');
  });
  await withFetch(() => Response.json({ ...EVENT, repeat_ended_on: '2026-10-29', revision: 4 }), async (recorded) => {
    const stopped = await stopCalendarEventRepeat('kid-a', 'evt-1', 3);
    assert.equal(stopped.repeat_ended_on, '2026-10-29');
    assert.equal(recorded[0]?.path, '/api/v1/profiles/kid-a/calendar/events/evt-1/stop-repeat');
    assert.equal(recorded[0]?.init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(recorded[0]?.init?.body)), { expected_revision: 3 });
  });
});

test('409 conflicts expose the server revision and leave the draft to the caller', async () => {
  await withFetch(() => Response.json({ error: { code: 'CALENDAR_REVISION_CONFLICT', message: 'changed', details: { current: { ...EVENT, title: 'Other', revision: 5 } } } }, { status: 409 }), async () => {
    await assert.rejects(updateCalendarEvent('kid-a', 'evt-1', { ...input, expected_revision: 1 }), (error: unknown) =>
      error instanceof CalendarEventApiError && error.kind === 'conflict' && error.status === 409 && error.currentRevision === 5);
  });
  await withFetch(() => Response.json({ error: { code: 'CALENDAR_REVISION_CONFLICT', message: 'changed' } }, { status: 409 }), async () => {
    await assert.rejects(deleteCalendarEvent('kid-a', 'evt-1', 1), (error: unknown) =>
      error instanceof CalendarEventApiError && error.kind === 'conflict' && error.currentRevision === undefined);
  });
});

test('422 maps the active-event cap and other validation failures to typed kinds', async () => {
  await withFetch(() => Response.json({ error: { code: 'CALENDAR_EVENTS_FULL', message: 'full' } }, { status: 422 }), async () => {
    await assert.rejects(createCalendarEvent('kid-a', input), (error: unknown) => error instanceof CalendarEventApiError && error.kind === 'events_full');
  });
  await withFetch(() => Response.json({ error: { code: 'VALIDATION_FAILED', message: 'bad title' } }, { status: 422 }), async () => {
    await assert.rejects(createCalendarEvent('kid-a', input), (error: unknown) => error instanceof CalendarEventApiError && error.kind === 'validation');
  });
});

test('404 is reported as not found and never as a conflict', async () => {
  await withFetch(() => Response.json({ error: { code: 'NOT_FOUND', message: 'missing' } }, { status: 404 }), async () => {
    await assert.rejects(stopCalendarEventRepeat('kid-a', 'other-family', 1), (error: unknown) => error instanceof CalendarEventApiError && error.kind === 'not_found');
  });
});

test('event updates include occurrence dates and participant references without browser profile names',async()=>{
  await withFetch(()=>Response.json(EVENT),async recorded=>{
    await updateCalendarEvent('kid-a','evt-1',{...input,expected_revision:1,from_date:'2026-11-01',participants:[{kind:'role',key:'dad'},{kind:'profile',profile_id:'kid-2',name:'Untrusted name'}] as never});
    assert.deepEqual(JSON.parse(String(recorded[0]?.init?.body)),{...input,expected_revision:1,from_date:'2026-11-01',participants:[{kind:'role',key:'dad'},{kind:'profile',profile_id:'kid-2'}]});
  });
});
