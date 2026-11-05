import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { WALL_MATERIALS, wallMaterialStyle, wallMaskStyle } from '../src/features/math-quiz-wall/wallMaterial.ts';
import { wallOpeningFrame } from '../src/features/math-quiz-wall/wallOpening.ts';

test('every material supplies four registered transparent wall states in one small sheet', () => {
  for (const name of ['brick', 'stone', 'garden', 'blocks'] as const) {
    const sheet = WALL_MATERIALS[name];
    const bytes = readFileSync(new URL(`../public${sheet.src}`, import.meta.url));
    assert.equal(bytes.subarray(8, 16).toString(), 'WEBPVP8X');
    assert.equal(bytes.readUIntLE(24, 3) + 1, sheet.width);
    assert.equal(bytes.readUIntLE(27, 3) + 1, sheet.height);
    assert.ok(bytes[20]! & 0x10, 'openings retain real alpha');
    assert.ok(bytes.length < 300000);
    assert.equal(sheet.width / (sheet.height / 4), 3);
    assert.ok(sheet.contentTop >= 0 && sheet.contentTop < .4);
    assert.equal(wallMaterialStyle(name, 0).backgroundPosition, '0% 0%');
    assert.equal(wallMaterialStyle(name, 3).backgroundPosition, '0% 100%');
    assert.equal(wallMaterialStyle(name, 1).backgroundImage, wallMaterialStyle(name, 0).backgroundImage, 'one preloaded sheet prevents outcome swaps flashing');
  }
  assert.equal(wallMaskStyle(2).maskImage, wallMaterialStyle('blocks', 2).backgroundImage);
});

test('the full wall conceals the answer until a valid graded outcome reveals its lane', () => {
  assert.equal(wallOpeningFrame(null), 0);
  assert.equal(wallOpeningFrame({ result: null, correctLane: 1 }), 0);
  assert.equal(wallOpeningFrame({ result: 'pass', correctLane: null }), 0);
  assert.equal(wallOpeningFrame({ result: 'pass', correctLane: 3 }), 0);
  for (const result of ['pass', 'splash'] as const) {
    for (let lane = 0; lane < 3; lane++) assert.equal(wallOpeningFrame({ result, correctLane: lane }), lane + 1);
  }
});
