import test from 'node:test';
import assert from 'node:assert/strict';
import { guessKey, VIETNAMESE_LETTERS } from '../src/features/ufo/letters.ts';
test('Vietnamese base keys preserve vowel shapes and remove only tone marks', () => {
  assert.equal(VIETNAMESE_LETTERS.length, 29);
  assert.equal(guessKey('Ợ'), 'Ơ'); assert.equal(guessKey('Ắ'), 'Ă'); assert.equal(guessKey('Ấ'), 'Â'); assert.equal(guessKey('Ế'), 'Ê'); assert.equal(guessKey('Đ'), 'Đ');
});
