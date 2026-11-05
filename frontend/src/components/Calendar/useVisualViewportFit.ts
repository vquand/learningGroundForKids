import { useLayoutEffect, type RefObject } from 'react';
import { VISUAL_VIEWPORT_VARIABLES, visualViewportCssProperties, visualViewportFit } from '../../lib/calendarVisualViewport';

/** Lets the on-screen keyboard finish opening before the focused field is centred. */
export const FOCUS_SCROLL_DELAY_MS = 300;

/** Input types that do not open the on-screen keyboard. */
const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit']);

function opensKeyboard(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  if (target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type);
}

/**
 * While the on-screen keyboard is open (see visualViewportFit), writes --calendar-vv-height, --calendar-vv-top and
 * --calendar-vv-inset on the dialog element so its CSS can sit inside the visible area. The variables are removed
 * when the keyboard closes and on unmount, so desktop layouts and browsers without visualViewport are unchanged.
 */
export function useVisualViewportFit(dialogRef: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const viewport = typeof window === 'undefined' ? undefined : window.visualViewport;
    if (!dialog || !viewport) return undefined;

    const currentFit = () => visualViewportFit({ height: viewport.height, offsetTop: viewport.offsetTop }, window.innerHeight);
    const apply = () => {
      const properties = visualViewportCssProperties(currentFit());
      for (const name of VISUAL_VIEWPORT_VARIABLES) {
        if (properties) dialog.style.setProperty(name, properties[name]);
        else dialog.style.removeProperty(name);
      }
    };

    let timer: number | undefined;
    const onFocusIn = (event: FocusEvent) => {
      const field = event.target;
      if (!opensKeyboard(field)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (field.isConnected && currentFit()) field.scrollIntoView({ block: 'center', behavior: 'auto' });
      }, FOCUS_SCROLL_DELAY_MS);
    };

    viewport.addEventListener('resize', apply);
    viewport.addEventListener('scroll', apply);
    dialog.addEventListener('focusin', onFocusIn);
    apply();

    return () => {
      viewport.removeEventListener('resize', apply);
      viewport.removeEventListener('scroll', apply);
      dialog.removeEventListener('focusin', onFocusIn);
      window.clearTimeout(timer);
      for (const name of VISUAL_VIEWPORT_VARIABLES) dialog.style.removeProperty(name);
    };
  }, [dialogRef]);
}
