/**
 * Pure arithmetic for keeping Calendar dialogs inside the visible area while an on-screen keyboard is open.
 * iPadOS shrinks the visual viewport but leaves fixed elements at their layout-viewport position, so the dialog
 * needs the visual viewport's height, top and bottom inset. The DOM side is components/Calendar/useVisualViewportFit.ts.
 */

/** The keyboard counts as open only when the visual viewport is at least this many pixels shorter than the layout viewport. */
export const KEYBOARD_MIN_SHRINK_PX = 120;

export const VISUAL_VIEWPORT_VARIABLES = ['--calendar-vv-height', '--calendar-vv-top', '--calendar-vv-inset'] as const;
export type VisualViewportVariable = typeof VISUAL_VIEWPORT_VARIABLES[number];

export interface VisualViewportSample {
  height: number;
  offsetTop: number;
}

export interface VisualViewportFit {
  /** Visible height in CSS pixels. */
  height: number;
  /** Visible top edge relative to the layout viewport. */
  top: number;
  /** Space between the visible bottom edge and the layout viewport bottom (the keyboard's share). */
  inset: number;
}

const isFiniteNumber = (value: number) => typeof value === 'number' && Number.isFinite(value);

/**
 * Returns the visible area while the keyboard is open, or null when no fit should apply. Null keeps every
 * variable unset, so desktop layouts and browsers without visualViewport are unchanged.
 */
export function visualViewportFit(sample: VisualViewportSample | null | undefined, layoutHeight: number): VisualViewportFit | null {
  if (!sample || !isFiniteNumber(sample.height) || !isFiniteNumber(sample.offsetTop) || !isFiniteNumber(layoutHeight)) return null;
  if (!(sample.height > 0) || !(layoutHeight > 0)) return null;
  if (layoutHeight - sample.height < KEYBOARD_MIN_SHRINK_PX) return null;
  const top = Math.max(0, sample.offsetTop);
  const inset = Math.max(0, layoutHeight - (top + sample.height));
  return { height: Math.round(sample.height), top: Math.round(top), inset: Math.round(inset) };
}

/** CSS custom properties for a fit, or null when the variables must be cleared. */
export function visualViewportCssProperties(fit: VisualViewportFit | null): Record<VisualViewportVariable, string> | null {
  if (!fit) return null;
  return {
    '--calendar-vv-height': `${fit.height}px`,
    '--calendar-vv-top': `${fit.top}px`,
    '--calendar-vv-inset': `${fit.inset}px`,
  };
}
