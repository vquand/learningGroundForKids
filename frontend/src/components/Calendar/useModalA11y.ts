import { useId, useLayoutEffect, type RefObject } from 'react';
import { diffInertSets, isBoundaryTab, nextFocusIndex, pushModal, removeModal, topmostModal, type ModalStack } from '../../lib/calendarModalFocus';

/**
 * Modal behaviour shared by the Calendar dialogs. While a dialog is mounted it:
 * - keeps Tab and Shift+Tab inside the topmost open dialog, cycling through its focusable elements;
 * - marks everything outside that dialog inert. Dialogs stack, so closing an inner dialog re-enables only
 *   what the outer dialog does not cover;
 * - restores focus to the element that had it when the dialog opened, but only when focus was lost to the page
 *   body on close. The components' own returnFocus handling runs first and is never repeated here.
 * Escape handling stays in each component.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Elements that never need inert and cannot take focus anyway. */
const NOT_INERTED = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE']);

let openStack: ModalStack = [];
const dialogs = new Map<string, HTMLElement>();
/** Elements this module made inert, mapped to whether they already carried the attribute before. */
const inertOwned = new Map<Element, boolean>();

/** Siblings of every ancestor of `dialog` up to the body: the page the dialog sits on top of. */
function pageElementsBehind(dialog: HTMLElement): Set<Element> {
  const behind = new Set<Element>();
  let node: HTMLElement = dialog;
  while (node !== document.body && node.parentElement) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (sibling !== node && !NOT_INERTED.has(sibling.tagName)) behind.add(sibling);
    }
    node = node.parentElement;
  }
  return behind;
}

function syncInert() {
  const top = topmostModal(openStack);
  const dialog = top ? dialogs.get(top) : undefined;
  const wanted = dialog ? pageElementsBehind(dialog) : new Set<Element>();
  const { add, remove } = diffInertSets(new Set(inertOwned.keys()), wanted);
  for (const element of remove) {
    if (!inertOwned.get(element)) element.removeAttribute('inert');
    inertOwned.delete(element);
  }
  for (const element of add) {
    inertOwned.set(element, element.hasAttribute('inert'));
    element.setAttribute('inert', '');
  }
}

function focusablesIn(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => (
    element.getClientRects().length > 0 && window.getComputedStyle(element).visibility !== 'hidden'
  ));
}

function restoreFocusIfLost(opener: HTMLElement) {
  const active = document.activeElement;
  if (opener.isConnected && (!active || active === document.body)) opener.focus();
}

/** Trap, inert and focus-return behaviour for the dialog whose element `dialogRef` points at. */
export function useModalA11y(dialogRef: RefObject<HTMLElement | null>): void {
  const id = useId();

  // Layout effects clean up synchronously on unmount, so the page is interactive again before focus is returned.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && active !== document.body ? active : null;
    openStack = pushModal(openStack, id);
    dialogs.set(id, dialog);
    syncInert();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey || topmostModal(openStack) !== id) return;
      const items = focusablesIn(dialog);
      const focused = document.activeElement;
      const current = focused instanceof HTMLElement ? items.indexOf(focused) : -1;
      const backwards = event.shiftKey;
      if (!isBoundaryTab(items.length, current, backwards)) return;
      event.preventDefault();
      items[nextFocusIndex(items.length, current, backwards)]?.focus();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openStack = removeModal(openStack, id);
      dialogs.delete(id);
      syncInert();
      // Deferred so the component's own returnFocus (which runs first) wins whenever it applies.
      if (opener) window.setTimeout(() => restoreFocusIfLost(opener), 0);
    };
  }, [dialogRef, id]);
}

/** True when `element` is the topmost open dialog. Components use it to ignore Escape while a nested dialog is open. */
export function isTopmostModal(element: HTMLElement | null): boolean {
  const top = topmostModal(openStack);
  return element !== null && top !== null && dialogs.get(top) === element;
}
