import { int } from './random.ts';
import type { RandomSource, Response } from './types.ts';

export interface NumericChoiceOptions {
  readonly count: number;
  readonly min?: number;
  readonly max?: number;
  readonly random: RandomSource;
}

/** Choose distractors randomly from the nearest 2×count candidates. */
export function numericChoices(answer: number, options: NumericChoiceOptions): number[] {
  const minimum = Math.max(0, options.min ?? 0);
  const maximum = options.max ?? Math.max(answer + options.count * 2, 10);
  if (!Number.isInteger(answer) || answer < minimum || answer > maximum) throw new RangeError('Answer is outside the choice range');
  if (!Number.isInteger(options.count) || options.count < 1 || maximum - minimum + 1 < options.count) {
    throw new RangeError('Not enough distinct numeric choices');
  }
  const candidates: number[] = [];
  for (let value = minimum; value <= maximum; value += 1) if (value !== answer) candidates.push(value);
  candidates.sort((left, right) => Math.abs(left - answer) - Math.abs(right - answer) || left - right);
  const nearest = candidates.slice(0, Math.min(candidates.length, options.count * 2));
  const ordered: number[] = [answer];
  for (; ordered.length < options.count; nearest.length -= 1) {
    const index = int(options.random, 0, nearest.length - 1);
    ordered.push(nearest.splice(index, 1)[0]!);
  }
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const swap = int(options.random, 0, index);
    [ordered[index], ordered[swap]] = [ordered[swap]!, ordered[index]!];
  }
  return ordered;
}

export function choiceResponse(
  answer: string | number,
  distractors: readonly (string | number)[],
  random: RandomSource,
  shuffle = true,
): Extract<Response, { mode: 'choice' }> {
  const values = [String(answer), ...distractors.map(String)];
  if (new Set(values).size !== values.length) throw new RangeError('Choices must be distinct');
  if (shuffle) {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const swap = int(random, 0, index);
      [values[index], values[swap]] = [values[swap]!, values[index]!];
    }
  }
  return { mode: 'choice', choices: values, correct: values.indexOf(String(answer)) };
}

export function numericChoiceResponse(answer: number, options: NumericChoiceOptions): Extract<Response, { mode: 'choice' }> {
  const choices = numericChoices(answer, options);
  return choiceResponse(answer, choices.filter((choice) => choice !== answer), options.random);
}
