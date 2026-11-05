import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, emptyProgress, generateBoard, publicState, type MinikuProgress } from '../src/miniku/game.js';
import { MINIKU_ACHIEVEMENT_GROUP } from '../src/achievement-catalog.js';

test('catalog metadata and grading agree at every Miniku unlock boundary and preserve awards', () => {
  let progress = emptyProgress();
  const expected = [
    ['miniku-first-solve'],
    ['miniku-first-solve'],
    ['miniku-first-solve'],
    ['miniku-first-solve', 'miniku-three-sizes', 'miniku-five-by-five'],
    ['miniku-first-solve', 'miniku-three-sizes', 'miniku-five-by-five', 'miniku-five-boards'],
  ];
  let now = 1000;
  for (const [run, size] of ([3, 4, 3, 5, 3] as const).entries()) {
    const previousAwards = { ...progress.earned };
    progress = applyCommand(progress, { type: 'new-puzzle', size }, now++, () => 0);
    const board = progress.board!;
    for (let index = 0; index < board.givens.length; index++) {
      if (!board.givens[index]) progress = applyCommand(progress, { type: 'set-cell', index, value: board.solution[index]! }, now++, () => 0);
    }
    assert.deepEqual(Object.keys(progress.earned).sort(), [...expected[run]!].sort());
    for (const [id, at] of Object.entries(previousAwards)) assert.equal(progress.earned[id], at);
    assert.deepEqual(publicState(progress).achievements.map(({ earnedAt: _at, ...metadata }) => metadata),
      MINIKU_ACHIEVEMENT_GROUP.achievements.map(({ id, name, description, difficulty }) => ({ id, name, description, difficulty })));
  }
});

test('generates a child-sized puzzle with a complete row and column solution', () => {
  for (const size of [3, 4, 5] as const) {
    const board = generateBoard(size, max => max > 1 ? 0 : 0);
    assert.equal(board.solution.length, size * size);
    const missing = board.givens.filter(value => value === 0).length;
    if (size === 3) assert.ok(missing >= 5 && missing <= 6);
    else assert.equal(missing, size === 4 ? 9 : 15);
    for (let row = 0; row < size; row += 1) assert.equal(new Set(board.solution.slice(row * size, row * size + size)).size, size);
    for (let column = 0; column < size; column += 1) assert.equal(new Set(Array.from({ length: size }, (_, row) => board.solution[row * size + column])).size, size);
  }
});

test('keeps the answer out of the public state and marks conflicts without blocking input', () => {
  let progress: MinikuProgress = emptyProgress();
  progress = applyCommand(progress, { type: 'start', size: 3 }, 1000, max => max > 1 ? 0 : 0);
  const board = progress.board!;
  const editable = board.givens.findIndex((value, index) => value === 0 && board.givens.some((other, position) => other === 0 && position !== index && Math.floor(position / 3) === Math.floor(index / 3)));
  const otherEditable = board.givens.findIndex((value, index) => value === 0 && index !== editable && Math.floor(index / 3) === Math.floor(editable / 3));
  progress = applyCommand(progress, { type: 'set-cell', index: editable, value: 1 }, 1100, max => 0);
  progress = applyCommand(progress, { type: 'set-cell', index: otherEditable, value: 1 }, 1200, max => 0);
  const state = publicState(progress, 1200);
  assert.equal('solution' in (state.board ?? {}), false);
  assert.ok(state.board?.conflictIndices.includes(editable));
  assert.ok(state.board?.conflictIndices.includes(otherEditable));
  assert.equal(state.board?.status, 'playing');
});

test('completion awards each eligible Miniku achievement once', () => {
  let progress: MinikuProgress = emptyProgress();
  progress = applyCommand(progress, { type: 'start', size: 3 }, 1000, max => max > 1 ? 0 : 0);
  const board = progress.board!;
  for (let index = 0; index < board.givens.length; index += 1) {
    if (board.givens[index] === 0) progress = applyCommand(progress, { type: 'set-cell', index, value: board.solution[index]! }, 1100 + index, max => 0);
  }
  assert.equal(progress.board?.status, 'complete');
  assert.equal(progress.completed, 1);
  assert.equal(Object.keys(progress.earned).length, 1);
  const earnedAt = progress.earned['miniku-first-solve'];
  progress = applyCommand(progress, { type: 'new-puzzle', size: 3 }, 3000, max => 0);
  assert.equal(progress.earned['miniku-first-solve'], earnedAt);
});

test('3×3 boards leave 3–4 clues with a unique logical solution', () => {
  const rows = [[1,2,3], [1,3,2], [2,1,3], [2,3,1], [3,1,2], [3,2,1]];
  const solutions = rows.flatMap(a => rows.flatMap(b => rows.map(c => [...a,...b,...c])))
    .filter(grid => [0,1,2].every(column => new Set([grid[column],grid[column+3],grid[column+6]]).size === 3));
  for (let seed = 1; seed <= 100; seed++) {
    let random = seed;
    const board = generateBoard(3, max => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random % max; });
    const clues = board.givens.filter(Boolean).length;
    assert.ok(clues >= 3 && clues <= 4, `seed ${seed}: ${clues} clues`);
    assert.equal(solutions.filter(grid => board.givens.every((value, index) => !value || value === grid[index])).length, 1);
    const working = [...board.givens];
    const options = (index: number) => [1,2,3].filter(value => !working.some((other, position) => other === value && (Math.floor(position / 3) === Math.floor(index / 3) || position % 3 === index % 3)));
    assert.ok(working.some((value, index) => !value && options(index).length > 1));
    while (working.includes(0)) {
      const index = working.findIndex((value, index) => !value && options(index).length === 1);
      assert.notEqual(index, -1, `seed ${seed}: solvable without guessing`);
      working[index] = options(index)[0]!;
    }
    assert.deepEqual(working, board.solution);
  }
});

test('larger boards respect their starting clue limits', () => {
  for (const size of [4, 5] as const) {
    for (let seed = 1; seed <= 100; seed++) {
      let random = seed;
      const board = generateBoard(size, max => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random % max; });
      assert.ok(board.givens.filter(Boolean).length <= (size === 4 ? 7 : 10), `${size}×${size}, seed ${seed}`);
    }
  }
});

test('admin-edited clues must remain valid and logically solvable', async () => {
  const { validatePuzzle } = await import('../src/miniku/game.js');
  const board = generateBoard(3, () => 0);
  assert.deepEqual(validatePuzzle(3, board.givens).solution, board.solution);
  for (const givens of [[], Array(9).fill(0), [1,1,0,0,0,0,0,0,0], Array(9).fill(1), [4,0,0,0,0,0,0,0,0]]) {
    assert.throws(() => validatePuzzle(3, givens));
  }
});
