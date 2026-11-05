/** Lifetime counters written only by the server's verified serve transition. */
export interface CabbageRollAchievements {
  completed: number;
  undercooked: number;
  okay: number;
  perfect: number;
  burnt: number;
  earned: Record<string,string>;
}
const keys = ['completed','undercooked','okay','perfect','burnt'] as const;
export function cabbageRollAchievements(value: unknown): CabbageRollAchievements {
  const raw = value && typeof value === 'object' ? value as Record<string,unknown> : {};
  const count = (key: typeof keys[number]) => Number.isSafeInteger(raw[key]) && (raw[key] as number) >= 0 ? raw[key] as number : 0;
  const earned: Record<string,string> = {};
  const saved = raw.earned && typeof raw.earned === 'object' ? raw.earned as Record<string,unknown> : {};
  for (const key of ['completed','undercooked','perfect','burnt']) {
    const id = `cabbage-rolls-${key}`, stamp = saved[id];
    if (typeof stamp === 'string' && Number.isFinite(Date.parse(stamp))) earned[id] = new Date(stamp).toISOString();
  }
  return {completed:count('completed'),undercooked:count('undercooked'),okay:count('okay'),perfect:count('perfect'),burnt:count('burnt'),earned};
}
export function cabbageRollAchievementMetrics(value: unknown) {
  const progress = cabbageRollAchievements(value);
  return {cabbageRollsCompleted:progress.completed,cabbageRollsUndercooked:progress.undercooked,
    cabbageRollsBurnt:progress.burnt,cabbageRollsPerfect:progress.perfect};
}
export function awardCabbageRollServe(value: unknown, outcome: 'undercooked'|'okay'|'perfect'|'burnt', now: number): CabbageRollAchievements {
  const progress = cabbageRollAchievements(value);
  progress.completed++;
  progress[outcome]++;
  const stamp = new Date(now).toISOString();
  progress.earned['cabbage-rolls-completed'] ??= stamp;
  if (outcome !== 'okay') progress.earned[`cabbage-rolls-${outcome}`] ??= stamp;
  return progress;
}
