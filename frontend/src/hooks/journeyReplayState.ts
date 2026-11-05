import type { AnimationState } from "../types/journey";

type Ref<T> = { current: T };
type TimeoutId = number;

export interface JourneyStateThrottleRefs {
  statePublishedAtRef: Ref<number>;
  pendingAnimationStateRef: Ref<AnimationState | null>;
  stateUpdateTimeoutRef: Ref<TimeoutId | null>;
}

export function createJourneyStateThrottle(
  refs: JourneyStateThrottleRefs,
  publish: (state: AnimationState) => void,
  intervalMs: number,
  now: () => number = Date.now,
  schedule: (callback: () => void, delayMs: number) => TimeoutId = (callback, delayMs) => window.setTimeout(callback, delayMs),
  cancel: (timeoutId: TimeoutId) => void = (timeoutId) => window.clearTimeout(timeoutId),
) {
  const cancelPending = () => {
    if (refs.stateUpdateTimeoutRef.current !== null) {
      cancel(refs.stateUpdateTimeoutRef.current);
      refs.stateUpdateTimeoutRef.current = null;
    }
    refs.pendingAnimationStateRef.current = null;
  };

  const reset = () => {
    cancelPending();
    refs.statePublishedAtRef.current = 0;
  };

  const publishNow = (state: AnimationState) => {
    refs.statePublishedAtRef.current = now();
    publish(state);
  };

  const handle = (state: AnimationState) => {
    const elapsed = now() - refs.statePublishedAtRef.current;
    if (state.status !== "playing" || elapsed >= intervalMs) {
      cancelPending();
      publishNow(state);
      return;
    }

    refs.pendingAnimationStateRef.current = state;
    if (refs.stateUpdateTimeoutRef.current === null) {
      refs.stateUpdateTimeoutRef.current = schedule(() => {
        refs.stateUpdateTimeoutRef.current = null;
        const pending = refs.pendingAnimationStateRef.current;
        refs.pendingAnimationStateRef.current = null;
        if (pending) publishNow(pending);
      }, Math.max(0, intervalMs - elapsed));
    }
  };

  return { handle, reset, dispose: reset };
}
