import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { profileCreateSchema, profileUpdateSchema } from '../src/input.js';
test('every offered avatar frame is accepted for profile creation and edits', async () => {
  const source = await readFile(new URL('../../frontend/src/lib/avatarFrames.ts', import.meta.url), 'utf8');
  const frames = [...source.matchAll(/id: "([^"]+)"/g)].map(match => match[1]!);
  assert.ok(frames.includes('car'));
  for (const avatar_frame of frames) {
    assert.equal(profileUpdateSchema.safeParse({ avatar_frame }).success, true, avatar_frame);
    assert.equal(profileCreateSchema.safeParse({ name: 'Test kid', emoji: '🐮', color: '#aabbcc', avatar_frame }).success, true, avatar_frame);
  }
  assert.equal(profileUpdateSchema.safeParse({ avatar_frame: 'unknown-frame' }).success, false);
});
