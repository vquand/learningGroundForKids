import assert from 'node:assert/strict';
import test from 'node:test';
import { equationCard } from '../src/questions/equation.js';
import { promptText } from '../src/questions/text.js';

test('shared question prompts distinguish missing operands from result-only multiplication', () => {
  const missing = equationCard('addsub-2d1d', [23, 3], ['+'], 1);
  const multiplication = equationCard('mul-1d', [9, 9], ['×']);
  assert.equal(promptText(missing, 'en'), 'Find the missing number');
  assert.equal(promptText(missing, 'vi'), 'Điền số còn thiếu');
  assert.equal(promptText(multiplication, 'en'), 'Multiply the numbers');
  assert.equal(promptText(multiplication, 'vi'), 'Nhân hai số');
});
