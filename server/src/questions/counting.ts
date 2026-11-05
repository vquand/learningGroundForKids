import type { CountingCard, LevelId } from './types.ts';

export function countingCard(count: number, level: LevelId = 'count-10'): CountingCard {
  if (!Number.isInteger(count) || count < 1 || count > 10) throw new RangeError('Counting cards use 1–10 stars');
  return { kind: 'counting', level, count, picture: 'star' };
}

export function* enumerateCounting(): Generator<CountingCard> {
  for (let count = 1; count <= 10; count += 1) yield countingCard(count);
}
