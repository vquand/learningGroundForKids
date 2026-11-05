import type { ItemSummary } from '../../src/types/item.ts';
import type { ExploreLeaves, ExploreView } from '../../src/types/explore.ts';
export function preparedMapFixture(url: URL, items: (Omit<ItemSummary, 'has_quiz'> & { has_quiz?: boolean })[]): Promise<ExploreView | ExploreLeaves | { version: string; validator: string; not_modified: true }>;
