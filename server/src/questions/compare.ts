import { choiceResponse } from './choices.ts';
import type { CompareCard, RandomSource } from './types.ts';

export function compareCard(left: number, right: number, level: CompareCard['level'] = 'compare-100'): CompareCard {
  if (!Number.isInteger(left) || !Number.isInteger(right) || left < 1 || left > 99 || right < 1 || right > 99) throw new RangeError('Compare cards use 1–99');
  return { kind: 'compare', level, left, right };
}

export function* enumerateCompare(): Generator<CompareCard> {
  for (let left = 1; left <= 99; left += 1) for (let right = 1; right <= 99; right += 1) yield compareCard(left, right);
}

export function compareAnswer(card: CompareCard): '<' | '=' | '>' {
  return card.left < card.right ? '<' : card.left > card.right ? '>' : '=';
}

/** Compare choices keep the historical fixed order so the three signs stay visually stable. */
export function compareChoiceResponse(card: CompareCard, random: RandomSource) {
  const answer = compareAnswer(card);
  choiceResponse(answer, ['<', '=', '>'].filter((sign) => sign !== answer), random, false);
  const choices = ['<', '=', '>'];
  return { mode: 'choice' as const, choices, correct: choices.indexOf(answer) };
}
