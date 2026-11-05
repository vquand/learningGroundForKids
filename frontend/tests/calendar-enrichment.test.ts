import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarSearchText, foodGroup } from '../src/lib/calendarFoodGroups.ts';
import { buildEventPayload } from '../src/lib/calendarEventHelpers.ts';
import { addStudyKey } from '../src/lib/calendarHelpers.ts';

test('food search accepts Vietnamese without accents and categories distinguish fish and greens', () => {
  assert.equal(calendarSearchText('Rau muống'), 'rau muong');
  assert.equal(calendarSearchText('Cải thìa'), 'cai thia');
  assert.equal(foodGroup('canned_fish'), 'Fish and seafood');
  assert.equal(foodGroup('malabar_spinach'), 'Vegetables');
  assert.equal(foodGroup('rotisserie_pork'), 'Meat and protein');
});
test('a custom Math subject does not prevent independently adding common Math', () => {
  const custom = { subject: 'math' as const, name: 'Math club' };
  assert.deepEqual(addStudyKey([custom], 'math'), [custom, { subject: 'math' }]);
});
test('past one-time events in this week are valid while past repeating starts are rejected', () => {
  const event = { title: 'Trip', icon_key: 'school_trip', start_date: '2026-10-27', repeat: 'none' as const };
  const context = { today: '2026-10-30', editing: false, lockedStart: false };
  assert.equal(buildEventPayload(event, context).ok, true);
  assert.equal(buildEventPayload({ ...event, repeat: 'weekly' }, context).ok, false);
  assert.equal(buildEventPayload({ ...event, start_date: '2026-10-25' }, context).ok, false);
});
