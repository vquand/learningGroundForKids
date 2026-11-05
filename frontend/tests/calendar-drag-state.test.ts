import assert from 'node:assert/strict';
import test from 'node:test';
import { reduceRowDrag, ROW_DRAG_THRESHOLD_PX, rowDragView, type RowDragEvent, type RowDragState } from '../src/lib/calendarDragState.ts';
import { moveStudyItemTo } from '../src/lib/calendarHelpers.ts';
import type { StudyItem } from '../src/types/calendar.ts';

// Four rows, 40px tall and 40px apart: centres at 20, 60, 100 and 140.
const ROW_CENTERS = [20, 60, 100, 140] as const;

function press(index: number, pointerId = 1, y = ROW_CENTERS[index] ?? 0): RowDragEvent {
  const centre = ROW_CENTERS[index] ?? 0;
  return {
    type: 'press',
    pointerId,
    index,
    count: ROW_CENTERS.length,
    x: 50,
    y,
    grabOffset: y - centre,
    step: 40,
    otherCenters: ROW_CENTERS.filter((_, rowIndex) => rowIndex !== index),
  };
}

function stateAfter(events: RowDragEvent[]): RowDragState | null {
  let state: RowDragState | null = null;
  for (const event of events) state = reduceRowDrag(state, event).state;
  return state;
}

test('press, move outside before the threshold, and release outside clears the drag', () => {
  const pressed = reduceRowDrag(null, press(0, 1, 20));
  // A few pixels of movement that never reach the threshold (the pointer has left the list).
  const moved = reduceRowDrag(pressed.state, { type: 'move', pointerId: 1, x: 52, y: 21 });
  assert.ok(moved.state && !moved.state.active, 'still a pending press');
  const released = reduceRowDrag(moved.state, { type: 'release', pointerId: 1 });
  assert.equal(released.state, null);
  assert.equal(released.endedPointerId, 1, 'the view releases capture for this pointer');
  assert.equal(released.commit, null);
});

test('a second press works after a pending press ended outside the list', () => {
  const afterFirst = stateAfter([press(0, 1, 20), { type: 'move', pointerId: 1, x: 52, y: 21 }, { type: 'release', pointerId: 1 }]);
  assert.equal(afterFirst, null);
  const second = reduceRowDrag(afterFirst, press(2, 2, 100));
  assert.equal(second.state?.from, 2);
  assert.equal(second.state?.pointerId, 2);
});

test('a press during an unfinished drag is ignored instead of replacing it', () => {
  const active = stateAfter([press(0, 1, 20), { type: 'move', pointerId: 1, x: 50, y: 80 }]);
  const ignored = reduceRowDrag(active, press(3, 2, 140));
  assert.equal(ignored.state, active);
  assert.equal(ignored.state?.from, 0);
});

test('cancel clears a pending drag and an active drag; a foreign pointer cannot cancel', () => {
  const pending = stateAfter([press(1, 1, 60)]);
  assert.equal(reduceRowDrag(pending, { type: 'cancel', pointerId: 1 }).state, null);

  const active = stateAfter([press(1, 1, 60), { type: 'move', pointerId: 1, x: 50, y: 120 }]);
  assert.ok(active?.active);
  const foreign = reduceRowDrag(active, { type: 'cancel', pointerId: 9 });
  assert.equal(foreign.state, active, 'another pointer does not cancel this drag');
  const cancelled = reduceRowDrag(active, { type: 'cancel', pointerId: 1 });
  assert.equal(cancelled.state, null);
  assert.equal(cancelled.commit, null, 'a cancelled drag never commits');
});

test('movement below the threshold stays pending and crossing it activates the drag', () => {
  const pending = stateAfter([press(0, 1, 20)]);
  const edge = reduceRowDrag(pending, { type: 'move', pointerId: 1, x: 50, y: 20 + ROW_DRAG_THRESHOLD_PX });
  assert.equal(edge.state?.active, true, 'a move of exactly the threshold activates the drag');
  assert.equal(rowDragView(pending), null, 'a pending press draws no row offsets');
  assert.deepEqual(rowDragView(edge.state), { from: 0, target: 0, dy: ROW_DRAG_THRESHOLD_PX, step: 40 });
});

test('a commit moves exactly one item to the release position and is returned once', () => {
  const items: StudyItem[] = [{ subject: 'math' }, { subject: 'english' }, { subject: 'science' }, { subject: 'art' }];
  const dragged = stateAfter([press(0, 1, 20), { type: 'move', pointerId: 1, x: 50, y: 130 }]);
  assert.equal(dragged?.target, 2);
  const released = reduceRowDrag(dragged, { type: 'release', pointerId: 1 });
  assert.deepEqual(released.commit, { from: 0, to: 2 });

  const next = released.commit ? moveStudyItemTo(items, released.commit.from, released.commit.to) : items;
  assert.deepEqual(next.map((item) => item.subject), ['english', 'science', 'math', 'art']);
  assert.equal(next.length, items.length, 'no item is added or removed');
  assert.deepEqual([...next.map((item) => item.subject)].sort(), [...items.map((item) => item.subject)].sort());

  // A second release (or a late window pointerup) commits nothing.
  assert.equal(reduceRowDrag(released.state, { type: 'release', pointerId: 1 }).commit, null);
});

test('a release at the starting position or without crossing the threshold commits nothing', () => {
  const unmoved = reduceRowDrag(stateAfter([press(2, 1, 100)]), { type: 'release', pointerId: 1 });
  assert.equal(unmoved.commit, null);
  const samePlace = stateAfter([press(2, 1, 100), { type: 'move', pointerId: 1, x: 50, y: 101 }]);
  assert.equal(reduceRowDrag(samePlace, { type: 'release', pointerId: 1 }).commit, null);
});

test('unmount or blur (cancel with no pointer id) clears an active drag, and later events do nothing', () => {
  const active = stateAfter([press(0, 1, 20), { type: 'move', pointerId: 1, x: 50, y: 90 }]);
  const cleared = reduceRowDrag(active, { type: 'cancel' });
  assert.equal(cleared.state, null);
  assert.equal(cleared.endedPointerId, 1);
  assert.equal(reduceRowDrag(cleared.state, { type: 'move', pointerId: 1, x: 50, y: 200 }).state, null);
  assert.equal(reduceRowDrag(cleared.state, { type: 'release', pointerId: 1 }).commit, null);
});

test('drag offsets clamp to the list bounds', () => {
  const far = stateAfter([press(0, 1, 20), { type: 'move', pointerId: 1, x: 50, y: 1000 }]);
  assert.equal(far?.dy, (ROW_CENTERS.length - 1) * 40);
  assert.equal(far?.target, 3);
  const above = stateAfter([press(3, 1, 140), { type: 'move', pointerId: 1, x: 50, y: -1000 }]);
  assert.equal(above?.dy, -3 * 40);
  assert.equal(above?.target, 0);
});
