import { choose, int } from './random.ts';
import type { RandomSource, VennCard, VennFriend, VennItem, VennTarget } from './types.ts';

export const VENN_FRIENDS: readonly VennFriend[] = ['star', 'capybara', 'cow', 'highland', 'chick', 'penguin'];
export const VENN_TARGETS: readonly VennTarget[] = ['leftOnly', 'shared', 'rightOnly', 'left', 'right', 'union'];
const REGIONS = ['leftOnly', 'shared', 'rightOnly'] as const;

export function vennCard(maxPerRegion: number, random: RandomSource, level: VennCard['level'] = maxPerRegion <= 3 ? 'venn-small' : 'venn-large'): VennCard {
  if (!Number.isInteger(maxPerRegion) || maxPerRegion < 1) throw new RangeError('Venn region maximum must be positive');
  const counts = REGIONS.map(() => int(random, 0, maxPerRegion)) as [number, number, number];
  if (counts.every((count) => count === 0)) counts[0] = 1;
  const friend = choose(random, VENN_FRIENDS);
  const target = choose(random, VENN_TARGETS);
  const items: VennItem[] = [];
  for (const [index, region] of REGIONS.entries()) {
    for (let item = 0; item < counts[index]!; item += 1) {
      const kind = region === 'leftOnly' ? choose(random, VENN_FRIENDS.filter((candidate) => candidate !== friend)) : friend;
      items.push({ region, pink: region !== 'rightOnly', kind });
    }
  }
  return { kind: 'venn', level, regions: { leftOnly: counts[0], shared: counts[1], rightOnly: counts[2] }, target, friend, items };
}

export function* enumerateVenn(maxPerRegion: 3 | 6, level: VennCard['level'] = maxPerRegion === 3 ? 'venn-small' : 'venn-large'): Generator<VennCard> {
  for (let leftOnly = 0; leftOnly <= maxPerRegion; leftOnly += 1) {
    for (let shared = 0; shared <= maxPerRegion; shared += 1) {
      for (let rightOnly = 0; rightOnly <= maxPerRegion; rightOnly += 1) {
        if (leftOnly + shared + rightOnly === 0) continue;
        for (const target of VENN_TARGETS) {
          yield {
            kind: 'venn', level, regions: { leftOnly, shared, rightOnly }, target,
            friend: 'star', items: [
              ...Array.from({ length: leftOnly }, () => ({
                region: 'leftOnly' as const, pink: true, kind: 'capybara' as const,
              })),
              ...Array.from({ length: shared }, () => ({
                region: 'shared' as const, pink: true, kind: 'star' as const,
              })),
              ...Array.from({ length: rightOnly }, () => ({
                region: 'rightOnly' as const, pink: false, kind: 'star' as const,
              })),
            ],
          };
        }
      }
    }
  }
}

export function vennAnswer(card: VennCard): number {
  const { leftOnly, shared, rightOnly } = card.regions;
  return card.target === 'leftOnly' ? leftOnly : card.target === 'shared' ? shared : card.target === 'rightOnly' ? rightOnly
    : card.target === 'left' ? leftOnly + shared : card.target === 'right' ? rightOnly + shared : leftOnly + shared + rightOnly;
}
