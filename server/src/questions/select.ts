import { enumerateLevelCards, level, supportsOperatorFilter } from './ladder.ts';
import { choose, DEFAULT_RANDOM } from './random.ts';
import { questionKey } from './identity.ts';
import type { Card, LevelId, RandomSource } from './types.ts';
import type { GeneratorOptions } from './ladder.ts';

export interface SelectOptions extends GeneratorOptions {
  readonly maxRandomAttempts?: number;
}

function ids(levels: LevelId | readonly LevelId[]): readonly LevelId[] {
  return typeof levels === 'string' ? [levels] : levels;
}

/** Randomly sample a bounded number of cards, then deterministically exhaust each finite pool. */
export function selectQuestion(
  levels: LevelId | readonly LevelId[],
  random: RandomSource = DEFAULT_RANDOM,
  seen: ReadonlySet<string> = new Set(),
  options?: SelectOptions,
): Card | null {
  const selected = ids(levels);
  if (selected.length === 0) return null;
  const attempts = Math.max(0, Math.floor(options?.maxRandomAttempts ?? 24));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const id = choose(random, selected);
    if (!supportsOperatorFilter(id, options?.operators)) continue;
    let candidate: Card;
    try {
      candidate = level(id).generator(random, options);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      // A requested operand blank can be invalid for a generated equation
      // (for example, a zero factor). Keep sampling before using the finite
      // enumeration fallback rather than biasing all draws toward its order.
      continue;
    }
    if (!options?.filter || options.filter(candidate)) if (!seen.has(questionKey(candidate))) return candidate;
  }
  for (const id of selected) {
    if (!supportsOperatorFilter(id, options?.operators)) continue;
    for (const candidate of enumerateLevelCards(id, options)) {
      if (options?.filter && !options.filter(candidate)) continue;
      if (!seen.has(questionKey(candidate))) return candidate;
    }
  }
  return null;
}
