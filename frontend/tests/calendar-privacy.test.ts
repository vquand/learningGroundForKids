import assert from 'node:assert/strict';
import test from 'node:test';
import { isPrivateQueryKey } from '../src/lib/familyQueries.ts';

test('every Calendar query prefix is cleared on logout and family switch', () => {
  for (const prefix of ['calendar', 'calendar-weather', 'calendar-notifications', 'parent-calendar']) {
    assert.equal(isPrivateQueryKey([prefix, 'family-a', 'kid']), true, prefix);
  }
});
