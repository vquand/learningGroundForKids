/**
 * Pure focus and stacking rules for the Calendar's modal dialogs. The DOM side lives in
 * components/Calendar/useModalA11y.ts and only applies these results.
 */

/**
 * Index of the focusable element that receives focus after Tab (or Shift+Tab) inside a dialog with `count`
 * focusable elements. `current` is -1 when focus is outside the dialog. Returns -1 when there is nothing to focus.
 */
export function nextFocusIndex(count: number, current: number, backwards: boolean): number {
  if (count <= 0) return -1;
  if (backwards) return current <= 0 ? count - 1 : current - 1;
  return current < 0 || current >= count - 1 ? 0 : current + 1;
}

/**
 * True when the browser's native Tab would leave the dialog, or focus is already outside it. Only these Tab presses
 * are intercepted, so radio groups and other native focus movement inside the dialog keep their behaviour.
 */
export function isBoundaryTab(count: number, current: number, backwards: boolean): boolean {
  if (count <= 0 || current < 0) return true;
  return backwards ? current === 0 : current === count - 1;
}

/** Open dialog ids, oldest first. The last entry is the topmost dialog. */
export type ModalStack = readonly string[];

/** Opening a dialog (or re-opening an id already present) makes it the topmost one. */
export function pushModal(stack: ModalStack, id: string): ModalStack {
  return [...stack.filter((item) => item !== id), id];
}

export function removeModal(stack: ModalStack, id: string): ModalStack {
  return stack.includes(id) ? stack.filter((item) => item !== id) : stack;
}

export function topmostModal(stack: ModalStack): string | null {
  const top = stack[stack.length - 1];
  return top ?? null;
}

/**
 * Which elements must change inert state to move from `current` to `wanted`. Elements in both sets are left alone,
 * so nested dialogs never re-enable the page early.
 */
export function diffInertSets<T>(current: ReadonlySet<T>, wanted: ReadonlySet<T>): { add: T[]; remove: T[] } {
  const add: T[] = [];
  const remove: T[] = [];
  for (const item of wanted) if (!current.has(item)) add.push(item);
  for (const item of current) if (!wanted.has(item)) remove.push(item);
  return { add, remove };
}
