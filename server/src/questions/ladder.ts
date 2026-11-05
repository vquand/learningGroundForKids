import { equationCard, withBlank } from './equation.ts';
import { countingCard } from './counting.ts';
import { compareCard } from './compare.ts';
import { ANIMAL_IDS, pictureCard } from './picture.ts';
import { choose, DEFAULT_RANDOM, int } from './random.ts';
import { enumerateVenn, vennCard } from './venn.ts';
import type { Blank, Card, CardKind, EquationCard, LevelId, Operator, RandomSource } from './types.ts';

export interface GeneratorOptions {
  readonly operators?: readonly Operator[];
  readonly blank?: Blank | 'any' | readonly Blank[];
  readonly filter?: (card: Card) => boolean;
}

export type CardGenerator = (random: RandomSource, options?: GeneratorOptions) => Card;
export interface DifficultyLevel {
  readonly id: LevelId;
  readonly rank: number | null;
  readonly kind: CardKind;
  readonly labels: { readonly en: string; readonly vi: string };
  readonly generator: CardGenerator;
  readonly enumerate: (options?: GeneratorOptions) => Generator<Card>;
}

const OPS = ['+', '−', '×', '÷'] as const;
const ADD_SUB = ['+', '−'] as const;
const repeated = (operator: Operator, length: number): Operator[] => Array.from({ length }, () => operator);
const mixedPattern = (length: number): Operator[] => Array.from({ length }, (_, index) => index % 2 === 0 ? '+' : '−');
const allPatterns = (length: number): Operator[][] => Array.from(
  { length: 2 ** length },
  (_, mask) => Array.from({ length }, (_, index) => mask & (1 << index) ? '−' : '+'),
);
function blankCandidates(card: EquationCard, request: GeneratorOptions['blank']): readonly Blank[] {
  if (request === undefined) return ['result'];
  if (request === 'any') return [...card.operands.map((_, index) => index), 'result'];
  if (Array.isArray(request)) return [...new Set(request)];
  if (request === 'result' || typeof request === 'number') return [request];
  return [];
}

function add(
  level: LevelId,
  operands: readonly number[],
  operators: readonly Operator[],
  options?: GeneratorOptions,
  random: RandomSource = DEFAULT_RANDOM,
  deterministic = false,
): EquationCard | null {
  const base = equationCard(level, operands, operators);
  const candidates = blankCandidates(base, options?.blank);
  const start = deterministic || candidates.length < 2 ? 0 : int(random, 0, candidates.length - 1);
  for (let offset = 0; offset < candidates.length; offset += 1) {
    const candidate = candidates[(start + offset) % candidates.length]!;
    const variant = withBlank(base, candidate);
    if (variant) return variant;
  }
  return null;
}
const allowed = (options: GeneratorOptions | undefined, operators: readonly Operator[]): boolean =>
  !options?.operators || operators.every((operator) => options.operators!.includes(operator));
const filter = (options: GeneratorOptions | undefined): readonly Operator[] => options?.operators && options.operators.length > 0 ? options.operators : OPS;
const pickOperator = (random: RandomSource, options: GeneratorOptions | undefined, operators: readonly Operator[]): Operator => {
  const choices = operators.filter((operator) => filter(options).includes(operator));
  if (choices.length === 0) throw new RangeError('Operator filter excludes this level');
  return choose(random, choices);
};
const equation = (
  level: LevelId,
  operands: readonly number[],
  operators: readonly Operator[],
  options?: GeneratorOptions,
  random: RandomSource = DEFAULT_RANDOM,
): EquationCard => {
  if (!allowed(options, operators)) throw new RangeError('Operator filter excludes this equation');
  const card = add(level, operands, operators, options, random);
  if (!card) throw new RangeError('Requested blank has no unique solution');
  return card;
};
const pairs = function* (
  level: LevelId,
  operator: Operator,
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
  valid: (a: number, b: number) => boolean,
  options?: GeneratorOptions,
): Generator<Card> {
  if (!allowed(options, [operator])) return;
  for (let a = aMin; a <= aMax; a += 1) for (let b = bMin; b <= bMax; b += 1) {
    if (!valid(a, b)) continue;
    const card = add(level, [a, b], [operator], options, DEFAULT_RANDOM, true);
    if (card) yield card;
  }
};

function* chain(
  level: LevelId,
  counts: readonly number[],
  patterns: readonly (readonly Operator[])[],
  firstMin: number,
  firstMax: number,
  operandMin: number,
  operandMax: number,
  minimum: number,
  maximum: number,
  options?: GeneratorOptions,
): Generator<Card> {
  for (const count of counts) for (const pattern of patterns.filter((operators) => operators.length === count - 1 && allowed(options, operators))) {
    function* extend(operands: number[], value: number): Generator<Card> {
      if (operands.length === count) {
        const isTwoDigitChain = level === 'chain-2d-3' || level === 'chain-2d-4';
        const hasSmallOperand = operands.slice(1).some((operand) => operand < 10);
        const hasLargeOperand = operands.slice(1).some((operand) => operand >= 10);
        if (isTwoDigitChain && !(hasSmallOperand && hasLargeOperand)) return;
        const card = add(level, operands, pattern, options, DEFAULT_RANDOM, true);
        if (card) yield card;
        return;
      }
      const operator = pattern[operands.length - 1]!;
      for (let operand = operandMin; operand <= operandMax; operand += 1) {
        const next = operator === '+' ? value + operand : value - operand;
        if (next >= minimum && next <= maximum) yield* extend([...operands, operand], next);
      }
    }
    for (let first = firstMin; first <= firstMax; first += 1) yield* extend([first], first);
  }
}

function generateEquation(level: LevelId, random: RandomSource, options?: GeneratorOptions): EquationCard {
  const make = (operands: readonly number[], operators: readonly Operator[]): EquationCard => equation(level, operands, operators, options, random);
  switch (level) {
    case 'add-1d': {
      const left = int(random, 0, 9); return make([left, int(random, 0, 9 - left)], ['+']);
    }
    case 'sub-1d': { const left = int(random, 0, 9); return make([left, int(random, 0, left)], ['−']); }
    case 'add-chain-1d': {
      const count = int(random, 3, 4); const operands = [int(random, 0, 9)]; let value = operands[0]!;
      for (let index = 1; index < count; index += 1) { const operand = int(random, 0, Math.min(9, 30 - value)); operands.push(operand); value += operand; }
      return make(operands, repeated('+', count - 1));
    }
    case 'sub-chain-1d': {
      const count = int(random, 3, 4); const operands = [int(random, 0, 9)]; let value = operands[0]!;
      for (let index = 1; index < count; index += 1) { const operand = int(random, 0, Math.min(9, value)); operands.push(operand); value -= operand; }
      return make(operands, repeated('−', count - 1));
    }
    case 'mixed-chain-1d': {
      const count = int(random, 3, 4); const operators = ['+', '−', '+'] as const; const operands = [int(random, 0, 9)]; let value = operands[0]!;
      for (let index = 1; index < count; index += 1) {
        const operator = operators[index - 1]!;
        const operand = operator === '+'
          ? int(random, 0, Math.min(9, 30 - value))
          : int(random, 0, Math.min(9, value));
        operands.push(operand);
        value = operator === '+' ? value + operand : value - operand;
      }
      return make(operands, operators.slice(0, count - 1));
    }
    case 'addsub-20': {
      const operator = pickOperator(random, options, ADD_SUB);
      const left = int(random, 0, 20);
      const right = operator === '+' ? int(random, 0, 20 - left) : int(random, 0, left);
      return make([left, right], [operator]);
    }
    case 'addsub-2d1d': {
      const operator = pickOperator(random, options, ADD_SUB);
      if (operator === '+') { const left = int(random, 10, 98); return make([left, int(random, 0, Math.min(9, 9 - left % 10))], [operator]); }
      const left = int(random, 10, 99); return make([left, int(random, 0, left % 10)], [operator]);
    }
    case 'addsub-2d1d-regroup': {
      const operator = pickOperator(random, options, ADD_SUB);
      if (operator === '+') {
        const left = int(random, 1, 8) * 10 + int(random, 1, 8);
        return make([left, int(random, Math.max(10 - left % 10, 1), 9)], [operator]);
      }
      const left = int(random, 2, 9) * 10 + int(random, 0, 8); return make([left, int(random, left % 10 + 1, 9)], [operator]);
    }
    case 'add-2d': { const left = int(random, 10, 89); return make([left, int(random, 10, 99 - left)], ['+']); }
    case 'sub-2d': { const left = int(random, 10, 99); return make([left, int(random, 10, left)], ['−']); }
    case 'chain-2d-3':
    case 'chain-2d-4': {
      const count = level === 'chain-2d-3' ? 3 : 4;
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const operands = [int(random, 20, 79)]; const operators: Operator[] = []; let value = operands[0]!;
        for (let index = 1; index < count; index += 1) {
          const operator = pickOperator(random, options, ADD_SUB);
          const maximum = operator === '+' ? 99 - value : value;
          const minimum = int(random, 0, 1) === 0 ? 0 : 10;
          if (maximum < minimum) break;
          const operand = int(random, minimum, Math.min(maximum, minimum === 0 ? 9 : 99));
          operands.push(operand);
          operators.push(operator);
          value = operator === '+' ? value + operand : value - operand;
        }
        const hasSmallOperand = operands.slice(1).some((operand) => operand < 10);
        const hasLargeOperand = operands.slice(1).some((operand) => operand >= 10);
        if (operands.length === count && hasSmallOperand && hasLargeOperand) return make(operands, operators);
      }
      return make(level === 'chain-2d-3' ? [32, 14, 8] : [25, 16, 12, 7], level === 'chain-2d-3' ? ['+', '−'] : ['+', '−', '+']);
    }
    case 'mul-2to5': return make([int(random, 2, 5), int(random, 2, 5)], ['×']);
    case 'mul-1d': { const left = int(random, 0, 9); return make([left, int(random, left === 0 ? 1 : 0, 9)], ['×']); }
    case 'mul-teens-small': return make([int(random, 10, 19), int(random, 1, 5)], ['×']);
    case 'mul-teens-large': return make([int(random, 10, 19), int(random, 6, 10)], ['×']);
    case 'div-1d': {
      const divisor = int(random, 1, 9);
      const quotient = int(random, 0, Math.floor(99 / divisor));
      return make([divisor * quotient, divisor], ['÷']);
    }
    case 'addsub-3d1d': {
      const operator = pickOperator(random, options, ADD_SUB);
      const left = int(random, 100, 999);
      const right = operator === '+'
        ? int(random, 0, Math.min(9, 999 - left))
        : int(random, 0, Math.min(9, left - 100));
      return make([left, right], [operator]);
    }
    case 'addsub-3d2d': {
      const operator = pickOperator(random, options, ADD_SUB);
      const left = operator === '+' ? int(random, 100, 899) : int(random, 110, 999);
      const maximum = operator === '+' ? 999 - left : left - 100;
      return make([left, int(random, 10, Math.min(99, maximum))], [operator]);
    }
    case 'chain-3d-3':
    case 'chain-3d-4': {
      const count = level === 'chain-3d-3' ? 3 : 4;
      for (let attempt = 0; attempt < 160; attempt += 1) {
        const operands = [int(random, 100, 899)];
        const operators: Operator[] = [];
        let value = operands[0]!;
        for (let index = 1; index < count; index += 1) {
          const operator = pickOperator(random, options, ADD_SUB);
          const maximum = operator === '+' ? Math.min(99, 999 - value) : Math.min(99, value - 100);
          if (maximum < 10) break;
          const operand = int(random, 10, maximum);
          operands.push(operand);
          operators.push(operator);
          value = operator === '+' ? value + operand : value - operand;
        }
        if (operands.length === count && value >= 100 && value <= 999) return make(operands, operators);
      }
      return make(level === 'chain-3d-3' ? [345, 24, 18] : [426, 35, 28, 16], level === 'chain-3d-3' ? ['+', '−'] : ['−', '+', '−']);
    }
    default: throw new RangeError(`Not an equation level: ${level}`);
  }
}

function generateLevel(id: LevelId, random: RandomSource = DEFAULT_RANDOM, options?: GeneratorOptions): Card {
  if (id === 'count-10') return countingCard(int(random, 1, 10));
  if (id === 'compare-100') return compareCard(int(random, 1, 99), int(random, 1, 99));
  if (id === 'picture-animals') return pictureCard(choose(random, ANIMAL_IDS));
  if (id === 'venn-small') return vennCard(3, random, id);
  if (id === 'venn-large') return vennCard(6, random, id);
  return generateEquation(id, random, options);
}

function* enumerateLevel(id: LevelId, options?: GeneratorOptions): Generator<Card> {
  if (id === 'count-10') {
    for (let count = 1; count <= 10; count += 1) yield countingCard(count);
    return;
  }
  if (id === 'compare-100') {
    for (let left = 1; left <= 99; left += 1) {
      for (let right = 1; right <= 99; right += 1) yield compareCard(left, right);
    }
    return;
  }
  if (id === 'picture-animals') { for (const subject of ANIMAL_IDS) yield pictureCard(subject); return; }
  if (id === 'venn-small') { yield* enumerateVenn(3, id); return; }
  if (id === 'venn-large') { yield* enumerateVenn(6, id); return; }
  if (id === 'add-1d') { yield* pairs(id, '+', 0, 9, 0, 9, (a, b) => a + b <= 9, options); return; }
  if (id === 'sub-1d') { yield* pairs(id, '−', 0, 9, 0, 9, (a, b) => a >= b, options); return; }
  if (id === 'addsub-20') {
    yield* pairs(id, '+', 0, 20, 0, 20, (a, b) => a + b <= 20, options);
    yield* pairs(id, '−', 0, 20, 0, 20, (a, b) => a >= b, options);
    return;
  }
  if (id === 'addsub-2d1d') {
    yield* pairs(id, '+', 10, 98, 0, 9, (a, b) => a % 10 + b < 10, options);
    yield* pairs(id, '−', 10, 99, 0, 9, (a, b) => a % 10 >= b, options);
    return;
  }
  if (id === 'addsub-2d1d-regroup') {
    yield* pairs(id, '+', 10, 88, 0, 9, (a, b) => a % 10 >= 1 && a % 10 <= 8 && a % 10 + b >= 10, options);
    yield* pairs(id, '−', 20, 99, 0, 9, (a, b) => a % 10 < b, options);
    return;
  }
  if (id === 'add-2d') { yield* pairs(id, '+', 10, 89, 10, 89, (a, b) => a + b <= 99, options); return; }
  if (id === 'sub-2d') { yield* pairs(id, '−', 10, 99, 10, 99, (a, b) => a >= b, options); return; }
  if (id === 'mul-2to5') { yield* pairs(id, '×', 2, 5, 2, 5, () => true, options); return; }
  if (id === 'mul-1d') { yield* pairs(id, '×', 0, 9, 0, 9, (a, b) => a !== 0 || b !== 0, options); return; }
  if (id === 'mul-teens-small') { yield* pairs(id, '×', 10, 19, 1, 5, () => true, options); return; }
  if (id === 'mul-teens-large') { yield* pairs(id, '×', 10, 19, 6, 10, () => true, options); return; }
  if (id === 'div-1d') { yield* pairs(id, '÷', 0, 99, 1, 9, (a, b) => a % b === 0, options); return; }
  if (id === 'addsub-3d1d') {
    yield* pairs(id, '+', 100, 999, 0, 9, (a, b) => a + b <= 999, options);
    yield* pairs(id, '−', 100, 999, 0, 9, (a, b) => a - b >= 100, options);
    return;
  }
  if (id === 'addsub-3d2d') {
    yield* pairs(id, '+', 100, 899, 10, 99, (a, b) => a + b <= 999, options);
    yield* pairs(id, '−', 110, 999, 10, 99, (a, b) => a - b >= 100, options);
    return;
  }
  const counts = id === 'add-chain-1d' || id === 'sub-chain-1d' || id === 'mixed-chain-1d' ? [3, 4] : [id === 'chain-2d-3' || id === 'chain-3d-3' ? 3 : 4];
  const patterns = id === 'add-chain-1d'
    ? counts.map((count) => repeated('+', count - 1))
    : id === 'sub-chain-1d'
      ? counts.map((count) => repeated('−', count - 1))
      : id === 'mixed-chain-1d'
        ? counts.map((count) => mixedPattern(count - 1))
        : counts.flatMap((count) => allPatterns(count - 1));
  const isSmall = id === 'add-chain-1d' || id === 'sub-chain-1d' || id === 'mixed-chain-1d';
  const isThreeDigit = id === 'chain-3d-3' || id === 'chain-3d-4';
  const firstMin = isThreeDigit ? 100 : isSmall ? 0 : 20;
  const firstMax = isThreeDigit ? 899 : isSmall ? 9 : 79;
  const operandMin = isThreeDigit ? 10 : 0;
  const operandMax = isThreeDigit ? 99 : isSmall ? 9 : 99;
  const resultMin = isThreeDigit ? 100 : 0;
  const resultMax = isThreeDigit ? 999 : isSmall ? id === 'sub-chain-1d' ? 9 : 30 : 99;
  yield* chain(
    id, counts, patterns, firstMin, firstMax, operandMin, operandMax, resultMin, resultMax, options,
  );
}

const definitions: readonly [LevelId, number | null, CardKind, string, string][] = [
  ['count-10', 1, 'counting', 'Count 1–10 stars', 'Đếm 1–10 ngôi sao'],
  ['add-1d', 2, 'equation', 'Single-digit addition', 'Phép cộng một chữ số'],
  ['sub-1d', 3, 'equation', 'Single-digit subtraction', 'Phép trừ một chữ số'],
  ['add-chain-1d', 4, 'equation', 'Addition chains', 'Chuỗi phép cộng'],
  ['sub-chain-1d', 5, 'equation', 'Subtraction chains', 'Chuỗi phép trừ'],
  ['mixed-chain-1d', 6, 'equation', 'Mixed one-digit chains', 'Chuỗi cộng trừ một chữ số'],
  ['venn-small', 7, 'venn', 'Small Venn sets', 'Tập hợp Venn nhỏ'],
  ['addsub-20', 8, 'equation', 'Add or subtract within 20', 'Cộng hoặc trừ trong phạm vi 20'],
  ['addsub-2d1d', 9, 'equation', 'Two-digit plus or minus one digit', 'Số có hai chữ số cộng hoặc trừ một chữ số'],
  ['addsub-2d1d-regroup', 10, 'equation', 'Carrying and borrowing', 'Cộng có nhớ và trừ có mượn'],
  ['venn-large', 11, 'venn', 'Large Venn sets', 'Tập hợp Venn lớn'],
  ['add-2d', 12, 'equation', 'Two-digit addition', 'Phép cộng hai chữ số'],
  ['sub-2d', 13, 'equation', 'Two-digit subtraction', 'Phép trừ hai chữ số'],
  ['compare-100', 14, 'compare', 'Compare two numbers', 'So sánh hai số'],
  ['chain-2d-3', 15, 'equation', 'Three-number mixed chains', 'Chuỗi ba số'],
  ['chain-2d-4', 16, 'equation', 'Four-number mixed chains', 'Chuỗi bốn số'],
  ['mul-2to5', 17, 'equation', 'Multiply 2–5', 'Nhân từ 2–5'],
  ['mul-1d', 18, 'equation', 'Single-digit multiplication', 'Phép nhân một chữ số'],
  ['mul-teens-small', 19, 'equation', 'Teens times 1–5', 'Số 10–19 nhân 1–5'],
  ['mul-teens-large', 20, 'equation', 'Teens times 6–10', 'Số 10–19 nhân 6–10'],
  ['div-1d', 21, 'equation', 'Exact division', 'Phép chia hết'],
  ['addsub-3d1d', 22, 'equation', 'Three-digit plus or minus one digit', 'Số có ba chữ số cộng hoặc trừ một chữ số'],
  ['addsub-3d2d', 23, 'equation', 'Three-digit plus or minus two digits', 'Số có ba chữ số cộng hoặc trừ hai chữ số'],
  ['chain-3d-3', 24, 'equation', 'Three-digit chains of three', 'Chuỗi ba số có ba chữ số'],
  ['chain-3d-4', 25, 'equation', 'Three-digit chains of four', 'Chuỗi bốn số có ba chữ số'],
  ['picture-animals', null, 'picture', 'Name the animal', 'Gọi tên con vật'],
];

export const DIFFICULTY_LADDER: readonly DifficultyLevel[] = definitions.map(([id, rank, kind, en, vi]) => {
  const generator: CardGenerator = (random = DEFAULT_RANDOM, options) => generateLevel(id, random, options);
  const enumerate = (options?: GeneratorOptions) => enumerateLevel(id, options);
  return { id, rank, kind, labels: { en, vi }, generator, enumerate };
});

export function level(id: LevelId): DifficultyLevel {
  const result = DIFFICULTY_LADDER.find((entry) => entry.id === id);
  if (!result) throw new RangeError(`Unknown level ${id}`);
  return result;
}

export function enumerateLevelCards(id: LevelId, options?: GeneratorOptions): Generator<Card> {
  return enumerateLevel(id, options);
}

export function supportsOperatorFilter(id: LevelId, operators: readonly Operator[] | undefined): boolean {
  const nonEquation = id === 'count-10' || id === 'venn-small' || id === 'venn-large'
    || id === 'compare-100' || id === 'picture-animals';
  if (!operators || operators.length === 0 || nonEquation) return true;
  const allowedOperators = id === 'add-1d' || id === 'add-chain-1d' || id === 'add-2d'
    ? ['+' as const]
    : id === 'sub-1d' || id === 'sub-chain-1d' || id === 'sub-2d'
      ? ['−' as const]
      : id === 'mul-2to5' || id === 'mul-1d'
      ? ['×' as const]
        : id === 'mul-teens-small' || id === 'mul-teens-large'
          ? ['×' as const]
        : id === 'div-1d' ? ['÷' as const] : ['+', '−'] as const;
  if (id === 'mixed-chain-1d') return operators.includes('+') && operators.includes('−');
  return allowedOperators.some((operator) => operators.includes(operator));
}
