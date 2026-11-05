import { targetIndexFromPointer } from './calendarHelpers.ts';

/** Pixels the pointer must travel before a press becomes a row drag. */
export const ROW_DRAG_THRESHOLD_PX = 4;

export interface RowDragState {
  pointerId: number;
  from: number;
  count: number;
  startX: number;
  startY: number;
  /** Pointer Y minus the dragged row centre at press time, so the row keeps its grip point. */
  grabOffset: number;
  /** Distance between neighbouring rows. */
  step: number;
  /** Centres of every row except the dragged one, in list order. */
  otherCenters: readonly number[];
  /** False until the pointer crosses the threshold; a pending press never moves a row. */
  active: boolean;
  target: number;
  dy: number;
}

export interface RowDragView { from: number; target: number; dy: number; step: number; }

export type RowDragEvent =
  | {
    type: 'press';
    pointerId: number;
    index: number;
    count: number;
    x: number;
    y: number;
    grabOffset: number;
    step: number;
    otherCenters: readonly number[];
  }
  | { type: 'move'; pointerId: number; x: number; y: number }
  | { type: 'release'; pointerId: number }
  /** Without a pointer id (Escape, window blur, unmount) any drag in progress is cancelled. */
  | { type: 'cancel'; pointerId?: number };

export interface RowDragTransition {
  state: RowDragState | null;
  /** The pointer whose drag ended with this transition, so the view can release its capture. */
  endedPointerId: number | null;
  /** Returned once, when an active drag is released at a new position: move `from` to `to`. */
  commit: { from: number; to: number } | null;
}

function unchanged(state: RowDragState | null): RowDragTransition {
  return { state, endedPointerId: null, commit: null };
}

/**
 * Row drag state machine. The view feeds it press, move, release and cancel events and applies the result:
 * it releases pointer capture for `endedPointerId`, commits `commit` once, and clears its drag UI when
 * `state` is null. Only the pointer that pressed can move or end a drag.
 */
export function reduceRowDrag(state: RowDragState | null, event: RowDragEvent): RowDragTransition {
  switch (event.type) {
    case 'press': {
      if (state) return unchanged(state);
      return {
        state: {
          pointerId: event.pointerId,
          from: event.index,
          count: event.count,
          startX: event.x,
          startY: event.y,
          grabOffset: event.grabOffset,
          step: event.step,
          otherCenters: [...event.otherCenters],
          active: false,
          target: event.index,
          dy: 0,
        },
        endedPointerId: null,
        commit: null,
      };
    }
    case 'move': {
      if (!state || event.pointerId !== state.pointerId) return unchanged(state);
      let next = state;
      if (!next.active) {
        if (Math.hypot(event.x - next.startX, event.y - next.startY) < ROW_DRAG_THRESHOLD_PX) return unchanged(state);
        next = { ...next, active: true };
      }
      const minDy = -next.from * next.step;
      const maxDy = (next.count - 1 - next.from) * next.step;
      return {
        state: {
          ...next,
          dy: Math.min(maxDy, Math.max(minDy, event.y - next.startY)),
          target: targetIndexFromPointer(next.otherCenters, event.y - next.grabOffset),
        },
        endedPointerId: null,
        commit: null,
      };
    }
    case 'release': {
      if (!state || event.pointerId !== state.pointerId) return unchanged(state);
      const moved = state.active && state.target !== state.from;
      return {
        state: null,
        endedPointerId: state.pointerId,
        commit: moved ? { from: state.from, to: state.target } : null,
      };
    }
    case 'cancel': {
      if (!state) return unchanged(null);
      if (event.pointerId !== undefined && event.pointerId !== state.pointerId) return unchanged(state);
      return { state: null, endedPointerId: state.pointerId, commit: null };
    }
  }
}

/** The drag UI to draw: only an active drag shows row offsets. */
export function rowDragView(state: RowDragState | null): RowDragView | null {
  if (!state || !state.active) return null;
  return { from: state.from, target: state.target, dy: state.dy, step: state.step };
}
