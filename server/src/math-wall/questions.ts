import { answerForCard, makeQuestion } from '../questions/identity.ts';
import { choiceResponse, numericChoices } from '../questions/choices.ts';
import { fromBoundedRandom } from '../questions/random.ts';
import { selectQuestion as selectSharedQuestion } from '../questions/select.ts';
import type { Card, Question, RandomSource } from '../questions/types.ts';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type { Question } from '../questions/types.ts';
export { questionKey } from '../questions/identity.ts';

export function difficultyOf(question: Question): Difficulty {
  switch (question.card.level) {
    case 'count-10': case 'add-1d': return 'easy';
    case 'addsub-20': return 'medium';
    default: return 'hard';
  }
}

const HARD_LEVELS = ['add-2d', 'sub-2d', 'mul-1d'] as const;

function simpleAddSub(card: Card): boolean {
  return card.kind === 'equation'
    && card.operators.every((operator) => operator === '+' || operator === '−')
    && card.operands.some((operand) => operand < 2);
}

function selectCard(difficulty: Difficulty, random: RandomSource, seen: ReadonlySet<string>): Card | null {
  const countingFirst = difficulty === 'easy' && random() < 0.2;
  const primary = difficulty === 'easy' ? (countingFirst ? 'count-10' : 'add-1d') : difficulty === 'medium' ? 'addsub-20' : null;
  const fallback = difficulty === 'easy' ? (countingFirst ? 'add-1d' : 'count-10') : null;
  const simpleFirst = difficulty !== 'hard' && random() < 0.1;
  const wanted = simpleFirst ? simpleAddSub : (card: Card) => !simpleAddSub(card);
  const selectFrom = (level: Card['level']): Card | null => {
    const filtered = difficulty !== 'hard' && level !== 'count-10'
      ? selectSharedQuestion([level], random, seen, { blank: 'result', filter: wanted })
      : selectSharedQuestion([level], random, seen, { blank: 'result' });
    return filtered ?? selectSharedQuestion([level], random, seen, { blank: 'result' });
  }
  if (primary) {
    const selected = selectFrom(primary);
    if (selected) return selected;
  } else {
    const selected = selectSharedQuestion(HARD_LEVELS, random, seen, { blank: 'result' });
    if (selected) return selected;
  }
  return fallback ? selectFrom(fallback) : null;
}

function choiceRange(difficulty: Difficulty): number {
  return difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 99;
}

/** Build one server-held result-blank choice question from the shared engine. */
export function generateQuestion(
  difficulty: Difficulty,
  pick: (maximumExclusive: number) => number,
  seen: ReadonlySet<string> = new Set(),
  id = 'waddle-question-1',
): Question {
  const random = fromBoundedRandom(pick);
  const card = selectCard(difficulty, random, seen);
  if (!card) throw new RangeError(`No Waddle Wall question remains for ${difficulty}`);
  const answer = answerForCard(card);
  if (typeof answer !== 'number') throw new RangeError('Waddle Wall requires numeric answers');
  const choices = numericChoices(answer, { count: 3, min: 0, max: choiceRange(difficulty), random });
  return makeQuestion(card, id, choiceResponse(answer, choices.filter((choice) => choice !== answer), random));
}

/** Bounded selection used when a saved session needs a replacement question. */
export function selectQuestion(
  difficulty: Difficulty,
  pick: (maximumExclusive: number) => number,
  seen: ReadonlySet<string>,
  id: string,
): Question | null {
  const order: Difficulty[] = [difficulty, ...(['easy', 'medium', 'hard'] as Difficulty[]).filter((value) => value !== difficulty)];
  for (const candidateDifficulty of order) {
    try {
      return generateQuestion(candidateDifficulty, pick, seen, id);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      /* Try the next curriculum group. */
    }
  }
  return null;
}
