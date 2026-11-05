import type { ItemSummary } from '../../src/types/item.ts';
type FixtureItem = Omit<ItemSummary, 'has_quiz'> & { has_quiz?: boolean };
export function exploreFixtures(): Promise<{ catalog: FixtureItem[]; dense: FixtureItem[] }>;
export function apiFixture(path: string, items: FixtureItem[]): unknown;
