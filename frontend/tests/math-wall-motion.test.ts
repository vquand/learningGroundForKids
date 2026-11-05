import assert from 'node:assert/strict';
import test from 'node:test';
import { initialBuddyMotion, stepBuddyMotion, buddyPose } from '../src/features/math-quiz-wall/buddyMotion.ts';

test('sprite uses rear at rest, its correct side while moving, and rear again on arrival', () => {
  for (const target of [-2.8, 2.8]) {
    let state = initialBuddyMotion();
    assert.equal(buddyPose(state), 'rear');
    state = stepBuddyMotion(state, target, 1 / 60);
    assert.equal(buddyPose(state), target < 0 ? 'left' : 'right');
    assert.equal(Math.sign(state.x), Math.sign(target));
    let sawWalking = false;
    for (let i = 0; i < 180; i++) {
      state = stepBuddyMotion(state, target, 1 / 60);
      if (state.phase === 'walking') {
        sawWalking = true;
        assert.equal(buddyPose(state), target < 0 ? 'left' : 'right');
      }
    }
    assert.equal(sawWalking, true);
    assert.equal(state.x, target);
    assert.equal(state.phase, 'idle');
    assert.equal(buddyPose(state), 'rear');
  }
});

test('pause freezes movement and side frame; reversing switches to the opposite side', () => {
  let state = initialBuddyMotion();
  for (let i = 0; i < 16; i++) state = stepBuddyMotion(state, 2.8, 1 / 60);
  assert.deepEqual(stepBuddyMotion(state, 2.8, .05, true), state);
  assert.equal(buddyPose(state), 'right');
  state = stepBuddyMotion(state, -2.8, 1 / 60);
  assert.equal(buddyPose(state), 'left');
  for (let i = 0; i < 180; i++) state = stepBuddyMotion(state, -2.8, 1 / 60);
  assert.equal(state.x, -2.8);
  assert.equal(state.phase, 'idle');
});
