import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCivilDays, buildEventPayload, defaultEventDate, eventDayWindowEnd, eventTitleProblem, EVENT_REPEAT_OPTIONS, EVENT_TITLE_MAX_LENGTH,
  isCivilDate, isLockedStart, normalizeEventTitle, repeatOption, visibleEventRowCount,
} from '../src/lib/calendarEventHelpers.ts';

const TODAY = '2026-10-29';
const context = { today: TODAY, editing: false, lockedStart: false };
const draft = { title: 'Hiking with Dad', icon_key: 'hiking', start_date: '2026-11-02', repeat: 'weekly' as const };

test('titles are trimmed, control characters removed and NFC-normalised', () => {
  assert.equal(normalizeEventTitle('  Piano\tlesson\u0007 '), 'Pianolesson');
  assert.equal(normalizeEventTitle('é'), 'é');
  assert.equal(eventTitleProblem('   '), 'required');
  assert.equal(eventTitleProblem('\u0000\n'), 'required');
  assert.equal(eventTitleProblem('a'.repeat(EVENT_TITLE_MAX_LENGTH)), null);
  assert.equal(eventTitleProblem('a'.repeat(EVENT_TITLE_MAX_LENGTH + 1)), 'too_long');
  assert.equal(eventTitleProblem(`  ${'a'.repeat(EVENT_TITLE_MAX_LENGTH)}  `), null, 'the limit applies after trimming');
});

test('civil dates are real calendar days and add without timezone drift', () => {
  assert.equal(isCivilDate('2028-02-29'), true);
  assert.equal(isCivilDate('2026-02-29'), false);
  assert.equal(isCivilDate('2026-13-01'), false);
  assert.equal(isCivilDate('2026-1-01'), false);
  assert.equal(addCivilDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addCivilDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addCivilDays('2027-03-01', -1), '2027-02-28');
  assert.equal(eventDayWindowEnd(TODAY), '2027-10-29');
});

test('defaults pick today or the first upcoming day of the selected week', () => {
  const week = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
  assert.equal(defaultEventDate(week, TODAY), TODAY);
  assert.equal(defaultEventDate(week.slice(0, 2), TODAY), '2026-10-27', 'every day has passed: the last day is returned');
  assert.equal(defaultEventDate(['2026-11-02', '2026-11-03'], TODAY), '2026-11-02');
});

test('payloads trim titles and keep the frozen field set', () => {
  const result = buildEventPayload({ ...draft, title: '  Hiking with Dad  ' }, context);
  assert.deepEqual(result, { ok: true, value: { title: 'Hiking with Dad', icon_key: 'hiking', start_date: '2026-11-02', repeat: 'weekly' } });
});

test('payload validation rejects blank names, bad icons, bad repeats and out-of-window days', () => {
  assert.deepEqual(buildEventPayload({ ...draft, title: '  ' }, context), { ok: false, problem: 'title_required' });
  assert.deepEqual(buildEventPayload({ ...draft, title: 'x'.repeat(41) }, context), { ok: false, problem: 'title_too_long' });
  assert.deepEqual(buildEventPayload({ ...draft, icon_key: 'tet' }, context), { ok: false, problem: 'icon_unknown' }, 'system artwork is not allowed');
  assert.deepEqual(buildEventPayload({ ...draft, icon_key: 'pho' }, context).ok, true, 'meal icons are allowed');
  assert.deepEqual(buildEventPayload({ ...draft, repeat: 'daily' as never }, context), { ok: false, problem: 'repeat_unknown' });
  assert.deepEqual(buildEventPayload({ ...draft, start_date: '2026-02-30' }, context), { ok: false, problem: 'day_invalid' });
  assert.deepEqual(buildEventPayload({ ...draft, start_date: '2026-10-28' }, context), { ok: false, problem: 'day_out_of_range' }, 'past days are not allowed for new events');
  assert.deepEqual(buildEventPayload({ ...draft, start_date: '2027-10-30' }, context), { ok: false, problem: 'day_out_of_range' }, 'more than 365 days ahead');
  assert.equal(buildEventPayload({ ...draft, start_date: '2027-10-29' }, context).ok, true, 'exactly 365 days ahead is allowed');
});

test('a started event keeps its past start date when only the title or icon changes', () => {
  const started = { ...draft, start_date: '2026-10-20' };
  assert.equal(isLockedStart('2026-10-20', TODAY), true);
  assert.equal(isLockedStart(TODAY, TODAY), false);
  assert.equal(buildEventPayload(started, { today: TODAY, editing: true, lockedStart: true }).ok, true);
  assert.deepEqual(buildEventPayload(started, { today: TODAY, editing: true, lockedStart: false }), { ok: false, problem: 'day_out_of_range' });
});

test('repeat options keep one badge per repeating choice and none for one-off events', () => {
  assert.deepEqual(EVENT_REPEAT_OPTIONS.map((option) => option.value), ['none', 'weekly', 'monthly', 'yearly']);
  assert.equal(repeatOption('none').badge, null);
  assert.equal(repeatOption('weekly').badge, 'Repeats every week');
  assert.equal(repeatOption('monthly').badge, 'Repeats every month');
  assert.equal(repeatOption('yearly').badge, 'Repeats every year');
});

test('visible row count shows all rows that fit, otherwise reserves a slot for +N', () => {
  assert.equal(visibleEventRowCount(0, 3), 0);
  assert.equal(visibleEventRowCount(476, 0), 0);
  assert.equal(visibleEventRowCount(476, 10), 10, '10 rows of 44px with 4px gaps are 476px');
  assert.equal(visibleEventRowCount(475, 10), 8, 'one pixel short: ten rows no longer fit, so eight rows plus +2');
  assert.equal(visibleEventRowCount(476, 12), 9, 'twelve rows: nine shown plus +3');
  assert.equal(visibleEventRowCount(515, 12), 9, '768px-tall day list (515px) fits ten slots, nine rows plus +3');
  assert.equal(visibleEventRowCount(567, 14), 10, '820px-tall day list (567px) fits eleven slots: ten rows plus +4');
  assert.equal(visibleEventRowCount(10, 1), 0, 'a row that cannot fit shows only +1');
});
