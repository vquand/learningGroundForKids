import assert from 'node:assert/strict';
import test from 'node:test';
import { renameStudyDraftItem } from '../src/lib/calendarHelpers.ts';

test('both saved and newly added subjects can be renamed without losing unsaved additions', () => {
  const math = { subject: 'math' as const, series_id: 'saved-series' };
  const vietnamese = { subject: 'vietnamese' as const };
  const draft = [math, vietnamese];
  const first = renameStudyDraftItem(draft, 0, 'Math in English');
  assert.deepEqual(first[0], { ...math, name: 'Math in English' });
  assert.equal(first[1], vietnamese);
  const second = renameStudyDraftItem(first, 1, 'Vietnamese at school');
  assert.equal(second[0], first[0]);
  assert.deepEqual(second[1], { subject: 'vietnamese', name: 'Vietnamese at school' });
  assert.deepEqual(draft, [math, vietnamese]);
});
