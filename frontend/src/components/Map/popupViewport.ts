interface Rectangle { left: number; top: number; right: number; bottom: number }
export interface PopupPadding { left: number; top: number; right: number; bottom: number }
export const EXPLORE_POPUP_PADDING: PopupPadding = { left: 96, top: 148, right: 24, bottom: 128 };

/** Translate a measured popup into the usable map region without panning it. */
export function popupViewportShift(popup: Rectangle, viewport: Rectangle, padding: PopupPadding) {
  const axis = (min: number, max: number) => Math.max(min, Math.min(max, 0));
  return { x: axis(viewport.left + padding.left - popup.left, viewport.right - padding.right - popup.right),
    y: axis(viewport.top + padding.top - popup.top, viewport.bottom - padding.bottom - popup.bottom) };
}
