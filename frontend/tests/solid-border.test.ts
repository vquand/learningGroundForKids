import assert from 'node:assert/strict';
import test from 'node:test';
import { clippedSolidBorder, prepareSolidBorder } from '../src/components/Map/solidBorder.ts';

const viewport = { left: 0, top: 0, right: 10, bottom: 10 };

function segments(path: string): number[][][] {
  const parts: number[][][] = [];
  const command = /([MLZ])\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?(?:[\s,]+[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)?)/g;
  for (const match of path.matchAll(command)) {
    if (match[1] === 'Z') continue;
    const numbers = match[2]!.trim().split(/[\s,]+/).map(Number);
    assert.equal(numbers.length, 2, `invalid SVG point in ${path}`);
    if (match[1] === 'M') parts.push([]);
    assert.ok(parts.length > 0, `line without move in ${path}`);
    parts.at(-1)!.push(numbers);
  }
  return parts;
}

test('a completely visible compound path keeps its exact authored string and closing edges', () => {
  const source = 'M1e0,1e0 L9,1 L9,9 L1,9 Z M3,3 L3,7 L7,7 L7,3 Z';
  assert.equal(clippedSolidBorder(prepareSolidBorder(source), viewport), source);
});

test('offscreen rings and an enclosing ring with no visible centerline disappear', () => {
  const source = 'M-5,-5 L15,-5 L15,15 L-5,15 Z M20,2 L25,2 L25,8 L20,8 Z';
  assert.equal(clippedSolidBorder(prepareSolidBorder(source), viewport), '');
});

test('two crossing edges remain disconnected and end at their exact intersections', () => {
  const source = 'M-5,2 L15,2 L15,8 L-5,8 Z';
  const output = clippedSolidBorder(prepareSolidBorder(source), viewport);
  assert.deepEqual(segments(output), [
    [[0, 2], [10, 2]],
    [[10, 8], [0, 8]],
  ]);
  assert.doesNotMatch(output, /Z/i, 'clipping must not close fragments along viewport edges');
});

test('a visible corner joins its original edges, while parallel exterior edges are omitted', () => {
  const source = 'M-5,5 L5,5 L5,15 L-5,15 Z M-2,0 L-2,10 L-1,10 L-1,0 Z';
  assert.deepEqual(segments(clippedSolidBorder(prepareSolidBorder(source), viewport)), [
    [[0, 5], [5, 5], [5, 10]],
  ]);
});

test('fragments on either side of a closed-ring seam connect through the original first vertex', () => {
  const source = 'M5,5 L15,5 L15,-5 L5,-5 Z';
  const output = clippedSolidBorder(prepareSolidBorder(source), viewport);
  const parts = segments(output);
  assert.equal(parts.length, 1, `seam produced separate strokes: ${output}`);
  assert.deepEqual(parts[0], [[5, 0], [5, 5], [10, 5]]);
  assert.doesNotMatch(output, /Z/i);
});

test('a GeoJSON ring repeating its first vertex before Z keeps the seam join without a zero-length tail', () => {
  const source = 'M5,5 L15,5 L15,-5 L5,-5 L5,5 Z';
  const output = clippedSolidBorder(prepareSolidBorder(source), viewport);
  assert.deepEqual(segments(output), [[[5, 0], [5, 5], [10, 5]]]);
  assert.doesNotMatch(output, /Z/i);
});

test('scientific coordinates and separate rings clip independently', () => {
  const source = 'M-1e1,2e0 L2e1,2e0 L2e1,4e0 L-1e1,4e0 Z M-10,6 L20,6 L20,8 L-10,8 Z';
  assert.deepEqual(segments(clippedSolidBorder(prepareSolidBorder(source), viewport)), [
    [[0, 2], [10, 2]], [[10, 4], [0, 4]],
    [[0, 6], [10, 6]], [[10, 8], [0, 8]],
  ]);
});
