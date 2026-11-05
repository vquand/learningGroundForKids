import { DEFAULT_RANDOM, int } from '../questions/random.ts';
import { withBlank } from '../questions/equation.ts';
import { makeQuestion } from '../questions/identity.ts';
import { selectQuestion } from '../questions/select.ts';
import type { LevelId, RandomSource } from '../questions/types.ts';
import type { InfinidrillLevel, InfinidrillQuestion } from './types.ts';

/** The authored labels belong to InfiniDrill; question construction belongs to the shared engine. */
export const QUESTION_LEVEL_DESCRIPTIONS: Readonly<Record<InfinidrillLevel, string>> = {
  1: 'Single-digit addition',
  2: 'Single-digit subtraction',
  3: 'Addition chains',
  4: 'Subtraction chains',
  5: 'Mixed addition and subtraction',
  6: 'Two-digit plus or minus one digit',
  7: 'Carrying and borrowing',
  8: 'Two-digit addition',
  9: 'Two-digit subtraction',
  10: 'Three-number mixed chains',
  11: 'Four-number mixed chains',
  12: 'Easy multiplication',
  13: 'Multiplication with 10–19',
  14: 'Multiplication and exact division',
  15: 'Three-digit plus or minus one digit',
  16: 'Three-digit plus or minus two digits',
  17: 'Three-digit mixed chains',
  18: 'Long three-digit mixed chains',
};

/** InfiniDrill's stage numbering is intentionally separate from the shared ladder rank. */
export const INFINIDRILL_STAGE_LEVELS: Readonly<Record<InfinidrillLevel, readonly LevelId[]>> = {
  1: ['add-1d'],
  2: ['sub-1d'],
  3: ['add-chain-1d'],
  4: ['sub-chain-1d'],
  5: ['mixed-chain-1d'],
  6: ['addsub-2d1d'],
  7: ['addsub-2d1d-regroup'],
  8: ['add-2d'],
  9: ['sub-2d'],
  10: ['chain-2d-3'],
  11: ['chain-2d-4'],
  12: ['mul-1d'],
  13: ['mul-teens-small'],
  14: ['mul-teens-large', 'div-1d'],
  15: ['addsub-3d1d'],
  16: ['addsub-3d2d'],
  17: ['chain-3d-3'],
  18: ['chain-3d-4'],
};

function vennLevel(stage: InfinidrillLevel): 'venn-small' | 'venn-large' {
  return stage <= 2 ? 'venn-small' : 'venn-large';
}

export function generateInfinidrillCard(
  stage: InfinidrillLevel,
  random: RandomSource,
  seen: ReadonlySet<string> = new Set(),
): ReturnType<typeof selectQuestion> {
  const isVenn = stage <= 11 && random() < 0.2;
  if (isVenn) return selectQuestion(vennLevel(stage), random, seen);
  if (random() >= 0.35) return selectQuestion(INFINIDRILL_STAGE_LEVELS[stage], random, seen, { blank: 'result' });

  // Choose the missing operand uniformly from the generated equation's
  // operands. `blank: 'any'` would also select the result and would therefore
  // under-sample operand blanks on chains.
  const result = selectQuestion(INFINIDRILL_STAGE_LEVELS[stage], random, seen, { blank: 'result' });
  if (!result || result.kind !== 'equation') return result;
  const blank = int(random, 0, result.operands.length - 1);
  return withBlank(result, blank) ?? result;
}

/** Generate a standalone shared Question for tests and saved-data fixtures. */
export function generateInfinidrillQuestion(
  stage: InfinidrillLevel,
  random: RandomSource = DEFAULT_RANDOM,
): InfinidrillQuestion {
  const card = generateInfinidrillCard(stage, random);
  if (!card) throw new RangeError(`No InfiniDrill question is available for stage ${stage}`);
  return makeQuestion(card, `infinidrill-${stage}`) as InfinidrillQuestion;
}

/** Select an unused shared card while preserving InfiniDrill's mix and stage pools. */
export function selectInfinidrillQuestion(
  stage: InfinidrillLevel,
  random: RandomSource = DEFAULT_RANDOM,
  seen: ReadonlySet<string> = new Set(),
): InfinidrillQuestion | null {
  const card = generateInfinidrillCard(stage, random, seen);
  return card ? makeQuestion(card, `infinidrill-${stage}`) as InfinidrillQuestion : null;
}
