import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarSearchText } from '../src/calendar/search.js';
import { AppError } from '../src/errors.js';

test('calendar people search folds case, combining accents and Vietnamese stroke', () => {
  for (const name of ['Đỗ Hà', 'ĐỖ HÀ', 'đỗ hà', ' Đo\u0302\u0303 Ha\u0300 ']) assert.equal(calendarSearchText(name), 'do ha');
  assert.equal(calendarSearchText('  HÀ  '), 'ha');
});

test('people searches load authorized candidates once before accent-insensitive filtering and the result cap', async () => {
  const { createCalendarPeopleRepository } = await import('../src/calendar/participants.js');
  const authorized = [
    ...Array.from({ length: 205 }, (_, i) => ({ profile_id: `aaa-${i}`, name: `AAA ${String(i).padStart(3, '0')}`, source: 'family' })),
    { profile_id: 'ha', name: 'Hà', source: 'family' },
    { profile_id: 'do', name: 'Đỗ', source: 'friend' },
  ];
  let candidateQueries = 0, totalQueries = 0;
  const pool = { async query(sql: string, params: unknown[]) {
    totalQueries++;
    if (sql.startsWith('SELECT p.family_id')) return { rows: [{ family_id: 'family' }] };
    if (sql.startsWith('SELECT disabled_roles')) return { rows: [] };
    candidateQueries++;
    assert.deepEqual(params.slice(0, 3), ['family', 'viewer', null]);
    assert.match(sql, /p\.id<>\$2/);
    assert.match(sql, /f\.status='accepted'/);
    // Support the old cursor-shaped query too, so the regression fails on the
    // round-trip count rather than on a mock that rejects its implementation.
    const cursorId = params.length === 7 ? params[5] : null;
    const after = cursorId ? authorized.findIndex(row => row.profile_id === cursorId) + 1 : 0;
    return { rows: authorized.slice(after, after + Number(params.at(-1))) };
  } } as unknown as import('pg').Pool;
  const people = createCalendarPeopleRepository(pool);
  for (const query of ['DO', 'ha', 'AAA', 'missing', '']) {
    candidateQueries = 0; totalQueries = 0;
    const result = await people.candidates('viewer', query);
    const expected = authorized.filter(row => calendarSearchText(row.name).includes(calendarSearchText(query)));
    assert.deepEqual(result.profiles, expected.slice(0, 100));
    assert.equal(result.has_more, expected.length > 100, 'the matching set determines has_more');
    assert.equal(candidateQueries, 1, `search ${JSON.stringify(query)} must use one candidate load`);
    assert.equal(totalQueries, 2, 'viewer settings and the authorized set need only two round trips');
  }
});

test('an oversized authorized candidate scope fails safely after one bounded load', async () => {
  const { createCalendarPeopleRepository, PARTICIPANT_CANDIDATE_CAP } = await import('../src/calendar/participants.js');
  assert.equal(PARTICIPANT_CANDIDATE_CAP, 2505);
  const authorized = Array.from({ length: PARTICIPANT_CANDIDATE_CAP + 1 }, (_, i) => ({ profile_id: `person-${i}`, name: `Person ${i}`, source: 'friend' }));
  let candidateQueries = 0, totalQueries = 0;
  const pool = { async query(sql: string, params: unknown[]) {
    totalQueries++;
    if (sql.startsWith('SELECT p.family_id')) return { rows: [{ family_id: 'family' }] };
    if (sql.startsWith('SELECT disabled_roles')) return { rows: [] };
    candidateQueries++;
    assert.equal(Number(params.at(-1)), PARTICIPANT_CANDIDATE_CAP + 1, 'the SQL must cap loaded rows including an overflow sentinel');
    return { rows: authorized.slice(0, Number(params.at(-1))) };
  } } as unknown as import('pg').Pool;
  await assert.rejects(() => createCalendarPeopleRepository(pool).candidates('viewer', 'rare name'), error =>
    error instanceof AppError && error.status === 503 && error.code === 'CALENDAR_PEOPLE_TOO_LARGE');
  assert.equal(candidateQueries, 1);
  assert.equal(totalQueries, 2);
});
