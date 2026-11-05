import type { MathSession } from '../../api/mathWall';

/** Reveal a passage only after server grading; lane choice alone stays hidden. */
export function wallOpeningFrame(session: Pick<MathSession, 'result' | 'correctLane'> | null): number {
  const lane = session?.correctLane;
  return session?.result && lane !== null && lane !== undefined && Number.isInteger(lane) && lane >= 0 && lane <= 2 ? lane + 1 : 0;
}
