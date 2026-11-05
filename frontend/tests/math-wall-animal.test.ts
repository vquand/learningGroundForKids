import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ANIMAL_SPRITES } from '../src/features/math-quiz-wall/animalSprites.ts';

test('each animal has a real transparent image and complete directional/surprised frames', () => {
  for (const animal of ['cow', 'highland', 'capybara'] as const) {
    const sheet = ANIMAL_SPRITES[animal];
    const webp = readFileSync(new URL(`../public${sheet.src}`, import.meta.url));
    assert.equal(webp.subarray(0, 4).toString(), 'RIFF');
    assert.equal(webp.subarray(8, 16).toString(), 'WEBPVP8X');
    assert.equal(webp.readUIntLE(24, 3) + 1, sheet.width);
    assert.equal(webp.readUIntLE(27, 3) + 1, sheet.height);
    assert.ok(webp[20]! & 0x10, 'Sprite WebP keeps its alpha channel');
    assert.ok(webp.length < 300_000, 'Animated sheet remains small enough for phone loading');
    assert.deepEqual(Object.keys(sheet.frames), ['rear', 'left', 'right', 'surprised']);
    for (const frame of Object.values(sheet.frames)) {
      assert.ok(frame.x >= 0 && frame.y >= 0 && frame.width > 24 && frame.height > 24);
      assert.ok(frame.x + frame.width <= sheet.width && frame.y + frame.height <= sheet.height);
    }
    for (const direction of ['left', 'right'] as const) {
      const frames = sheet.walks[direction];
      assert.equal(frames.length, 6);
      assert.equal(new Set(frames.map(frame => `${frame.x}:${frame.y}`)).size, 6);
      assert.ok(frames.every((frame, index) => frame.width === 256 && frame.height === 192 && frame.x === index * 256 && frame.y === sheet.frames[direction].y));
    }
  }
});
