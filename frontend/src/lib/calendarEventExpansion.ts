import { CALENDAR_EVENTS_COPY } from '../components/Calendar/calendarEventsCopy.ts';

/** Space kept between an expanded day card's bottom edge and the bottom of the viewport, in px. */
export const EXPANDED_CARD_VIEWPORT_GAP = 12;

/** The day (YYYY-MM-DD) whose card is expanded, or null. At most one card is expanded at a time. */
export type ExpandedDay = string | null;

/** Expanding a day makes it the only expanded card, so any card expanded before collapses. */
export function expandDay(date: string): ExpandedDay {
  return date;
}

export function collapseDay(): ExpandedDay {
  return null;
}

/**
 * A pointer press collapses the expanded card only when it lands outside that card. The press itself is never
 * swallowed, so a tap on another "+N" or control still reaches it.
 */
export function shouldCollapseForPointer(expanded: ExpandedDay, targetInsideCard: boolean): boolean {
  return expanded !== null && !targetInsideCard;
}

/** Escape collapses whichever card is expanded. */
export function shouldCollapseForEscape(expanded: ExpandedDay): boolean {
  return expanded !== null;
}

/**
 * The tallest an expanded card may be: the viewport bottom minus the card's top minus the 12px gap. Never negative.
 * Content taller than this scrolls inside the card.
 */
export function expandedCardMaxHeight(viewportHeight: number, cardTop: number, gap = EXPANDED_CARD_VIEWPORT_GAP): number {
  if (!Number.isFinite(viewportHeight) || !Number.isFinite(cardTop) || !Number.isFinite(gap)) return 0;
  return Math.max(0, viewportHeight - cardTop - gap);
}

/** Height an expanded card takes: its content height, capped at the maximum. */
export function expandedCardHeight(contentHeight: number, maxHeight: number): number {
  if (!Number.isFinite(contentHeight) || !Number.isFinite(maxHeight)) return 0;
  return Math.max(0, Math.min(contentHeight, maxHeight));
}

/** Accessible name template for a day's "+N" control: "Show all 12 events on 30 Oct", or the singular form for one. */
export function dayOverflowLabelTemplate(total: number): string {
  return total === 1 ? CALENDAR_EVENTS_COPY.showOneEvent : CALENDAR_EVENTS_COPY.showAllEvents;
}
