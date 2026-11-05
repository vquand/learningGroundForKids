import { createLatestRequestGuard } from "./latestRequestGuard.ts";

export function createJourneyReplayRequestController() {
  const guard = createLatestRequestGuard();
  let mounted = true;

  return {
    mount(): void { mounted = true; },
    begin(): number | null { return mounted ? guard.begin() : null; },
    invalidate(): void { guard.invalidate(); },
    isCurrent(generation: number): boolean { return mounted && guard.isCurrent(generation); },
    unmount(): void {
      mounted = false;
      guard.invalidate();
    },
  };
}
