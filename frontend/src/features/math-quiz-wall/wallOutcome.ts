export const WALL_STOP_PERCENT = 72;
export function wallOutcome(result: 'pass' | 'splash', progress: number) {
  const advance = Math.min(1, Math.max(0, progress) * 5);
  const fade = Math.min(1, Math.max(0, (progress - .2) / .45));
  return { bottom: 65 + advance * (WALL_STOP_PERCENT - 65), opacity: result === 'pass' ? 1 - fade * fade * (3 - 2 * fade) : 1 };
}
