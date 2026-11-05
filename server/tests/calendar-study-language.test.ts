import assert from 'node:assert/strict';
import test from 'node:test';
import { writableItems, listBodySchema } from '../src/calendar/contracts.js';
import { renameSeriesItem } from '../src/calendar/names.js';

test('study list writes and reads preserve optional teaching language and legacy items', () => {
  const items = [{ subject: 'math', teaching_language: 'en' }, { subject: 'math', name: 'Math A+', teaching_language: 'vi' }, { subject: 'science' }];
  assert.deepEqual(writableItems('study_afternoon', items), items);
  assert.equal(listBodySchema.safeParse({ scope: 'template', weekday: 1, area: 'study_afternoon', items, expected_revision: 0 }).success, true);
  assert.deepEqual(renameSeriesItem(items, 1, 'Advanced math')[1], { ...items[1], name: 'Advanced math' });
});

test('study language rejects unknown values and cannot leak into meal items', () => {
  for (const teaching_language of ['fr', '', null, 1, {}, 'EN']) {
    assert.throws(() => writableItems('study_morning', [{ subject: 'math', teaching_language }]));
  }
  assert.throws(() => writableItems('meal_lunch', [{ food: 'rice', teaching_language: 'en' }]));
});
