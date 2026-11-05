import assert from 'node:assert/strict';
import test from 'node:test';
import { eventSchemas } from '../src/calendar/events.js';
import { studyItemSchema } from '../src/calendar/contracts.js';
import { eventNameAt, renameSeriesItem } from '../src/calendar/names.js';
import { buildCalendarNotifications } from '../src/calendar/notifications.js';

test('past one-time records are allowed but new repeating events cannot start in the past', () => {
  const schema = eventSchemas('2026-10-30').create;
  const record = { title: 'School trip', icon_key: 'school_trip', start_date: '2026-10-27', repeat: 'none' };
  assert.equal(schema.safeParse(record).success, true);
  assert.equal(schema.safeParse({ ...record, repeat: 'weekly' }).success, false);
});
test('study items support a custom name while keeping a reviewed icon', () => {
  assert.equal(studyItemSchema.safeParse({ subject: 'math', name: 'Math in Vietnamese' }).success, true);
  assert.equal(studyItemSchema.safeParse({ subject: 'invented', name: 'Math' }).success, false);
});
test('renaming targets only the selected entry', () => {
  const items = [{ subject: 'math' }, { subject: 'math', name: 'Math club' }];
  assert.deepEqual(renameSeriesItem(items, 0, 'Math in English'), [{ subject: 'math', name: 'Math in English' }, items[1]]);
  assert.deepEqual(items, [{ subject: 'math' }, { subject: 'math', name: 'Math club' }]);
});
test('event names preserve earlier occurrences without moving the recurrence anchor', () => {
  const event = { title: 'Math', icon_key: 'math', name_history: [{ from: '2026-10-27', title: 'Math club', icon_key: 'math' }] };
  assert.equal(eventNameAt(event, '2026-10-26').title, 'Math');
  assert.equal(eventNameAt(event, '2026-10-27').title, 'Math club');
  assert.equal(eventNameAt(event, '2027-01-31').title, 'Math club');
});
test('historical one-time records never appear in reminders', () => {
  const event = { id: 'e', profile_id: 'p', profile_name: 'Kid', title: 'Trip', icon_key: 'school_trip', start_date: '2026-10-27', repeat: 'none' as const, repeat_ended_on: null };
  assert.deepEqual(buildCalendarNotifications({ today: '2026-10-30', systemEvents: [], kidEvents: [event] }).items, []);
});
