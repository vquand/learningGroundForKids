import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { diffInertSets, isBoundaryTab, nextFocusIndex, pushModal, removeModal, topmostModal } from '../src/lib/calendarModalFocus.ts';

test('Tab cycles forward and Shift+Tab backward, wrapping at both ends', () => {
  assert.equal(nextFocusIndex(3, 0, false), 1);
  assert.equal(nextFocusIndex(3, 1, false), 2);
  assert.equal(nextFocusIndex(3, 2, false), 0, 'the last element wraps to the first');
  assert.equal(nextFocusIndex(3, 1, true), 0);
  assert.equal(nextFocusIndex(3, 0, true), 2, 'the first element wraps to the last');
  assert.equal(nextFocusIndex(3, -1, false), 0, 'focus outside the dialog starts at the first element');
  assert.equal(nextFocusIndex(3, -1, true), 2, 'focus outside the dialog starts at the last element');
  assert.equal(nextFocusIndex(0, -1, false), -1, 'nothing focusable: no target');
});

test('only boundary Tab presses are intercepted, so native movement inside the dialog is kept', () => {
  assert.equal(isBoundaryTab(3, 0, false), false);
  assert.equal(isBoundaryTab(3, 1, false), false);
  assert.equal(isBoundaryTab(3, 2, false), true, 'forward from the last element leaves the dialog');
  assert.equal(isBoundaryTab(3, 1, true), false);
  assert.equal(isBoundaryTab(3, 0, true), true, 'backward from the first element leaves the dialog');
  assert.equal(isBoundaryTab(3, -1, false), true, 'focus outside the dialog is always taken back');
  assert.equal(isBoundaryTab(0, -1, true), true, 'an empty dialog keeps focus where it is');
});

test('nested dialogs: the newest open dialog is topmost, and closing it returns control to the outer one', () => {
  let stack = pushModal([], 'drawer');
  assert.equal(topmostModal(stack), 'drawer');
  stack = pushModal(stack, 'medicine');
  assert.equal(topmostModal(stack), 'medicine');
  stack = removeModal(stack, 'medicine');
  assert.equal(topmostModal(stack), 'drawer', 'closing the inner dialog must not release the outer one');
  stack = removeModal(stack, 'drawer');
  assert.equal(topmostModal(stack), null);
});

test('re-opening an id moves it to the top without duplicating it, and removing an unknown id is a no-op', () => {
  assert.deepEqual(pushModal(['a', 'b'], 'a'), ['b', 'a']);
  assert.deepEqual(removeModal(['a'], 'missing'), ['a']);
});

test('inert bookkeeping only touches the difference between the old and new page sets', () => {
  assert.deepEqual(diffInertSets(new Set(['header', 'main']), new Set(['main', 'sheet'])), { add: ['sheet'], remove: ['header'] });
  assert.deepEqual(diffInertSets(new Set<string>(), new Set<string>()), { add: [], remove: [] });
  assert.deepEqual(diffInertSets(new Set(['main']), new Set(['main'])), { add: [], remove: [] }, 'an unchanged page is never re-enabled early');
});

const DIALOG_FILES = [
  'ListEditorDrawer.tsx',
  'MealEditorDrawer.tsx',
  'MealLibraryDialog.tsx',
  'MedicineDialog.tsx',
  'EventEditorDrawer.tsx',
];

test('every calendar dialog calls the shared modal and viewport hooks on the element it renders', async () => {
  for (const file of DIALOG_FILES) {
    const source = await readFile(new URL(`../src/components/Calendar/${file}`, import.meta.url), 'utf8');
    assert.match(source, /import \{[^}]*\buseModalA11y\b[^}]*\} from '\.\/useModalA11y';/, `${file} imports useModalA11y`);
    assert.match(source, /import \{ useVisualViewportFit \} from '\.\/useVisualViewportFit';/, `${file} imports useVisualViewportFit`);
    const modal = /useModalA11y\((\w+)\);/.exec(source);
    assert.ok(modal, `${file} calls useModalA11y`);
    assert.match(source, /useVisualViewportFit\(\w+\);/, `${file} calls useVisualViewportFit`);
    const ref = modal[1];
    assert.ok(source.includes(`ref={${ref}}`), `${file} attaches ${ref} to the dialog element`);
    assert.match(source, /role="dialog" aria-modal="true"/, `${file} keeps its dialog semantics`);
  }
});
