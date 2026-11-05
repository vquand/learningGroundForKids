import type { EquationCard, Operator, Blank, LevelId } from './types.ts';

function calculateRaw(operands: readonly number[], operators: readonly Operator[]): readonly number[] {
  if (operands.length === 0 || operators.length !== operands.length - 1) throw new RangeError('Invalid equation shape');
  const results: number[] = [];
  let value = operands[0]!;
  for (let index = 0; index < operators.length; index += 1) {
    const right = operands[index + 1]!;
    const operator = operators[index]!;
    if (operator === '+') value += right;
    else if (operator === '−') value -= right;
    else if (operator === '×') value *= right;
    else {
      if (right === 0) throw new RangeError('Division by zero');
      value /= right;
    }
    results.push(value);
  }
  return results;
}

export function evaluate(operands: readonly number[], operators: readonly Operator[]): readonly number[] {
  if (!operands.every((operand) => Number.isSafeInteger(operand) && operand >= 0)) throw new RangeError('Equation operands must be nonnegative integers');
  const results = calculateRaw(operands, operators);
  if (!results.every((value) => Number.isSafeInteger(value) && value >= 0)) throw new RangeError('Equation results must be nonnegative integers');
  return results;
}

export function format(operands: readonly number[], operators: readonly Operator[]): string {
  if (operands.length === 0 || operators.length !== operands.length - 1) throw new RangeError('Invalid equation shape');
  return operands.map((operand, index) => `${index === 0 ? '' : `${operators[index - 1]!} `}${operand}`).join(' ');
}

function withBlankValue(card: EquationCard, blank: Blank): EquationCard {
  return { ...card, blank };
}

/** Hide one operand only when the completed equation has one safe solution. */
export function withBlank(card: EquationCard, position: Blank): EquationCard | null {
  if (position !== 'result' && (position < 0 || position >= card.operands.length)) return null;
  let complete: readonly number[];
  try {
    complete = evaluate(card.operands, card.operators);
  } catch {
    return null;
  }
  if (position === 'result') return withBlankValue(card, position);
  if (card.operators.includes('×') && card.operands.some((value, index) => index !== position && value === 0)) return null;
  if (card.operators.includes('÷') && position === 1 && card.operands[0] === 0) return null;

  const target = complete.at(-1)!;
  if (card.operators.length === 1 && card.operators[0] === '÷' && position === 1) {
    if (target === 0 || !Number.isSafeInteger(card.operands[0]! / target) || card.operands[0]! / target < 0) return null;
    return card.operands[0]! / target === card.operands[1] ? withBlankValue(card, position) : null;
  }
  const atZero = [...card.operands];
  const atOne = [...card.operands];
  atZero[position] = 0;
  atOne[position] = 1;
  let zeroResult: number;
  let oneResult: number;
  try {
    zeroResult = calculateRaw(atZero, card.operators).at(-1)!;
    oneResult = calculateRaw(atOne, card.operators).at(-1)!;
  } catch {
    return null;
  }
  const coefficient = oneResult - zeroResult;
  if (!Number.isFinite(coefficient) || coefficient === 0) return null;
  const candidate = (target - zeroResult) / coefficient;
  if (!Number.isSafeInteger(candidate) || candidate < 0) return null;
  const verify = [...card.operands];
  verify[position] = candidate;
  try {
    if (calculateRaw(verify, card.operators).at(-1) !== target) return null;
  } catch {
    return null;
  }
  return withBlankValue(card, position);
}

export function equationCard(level: LevelId, operands: readonly number[], operators: readonly Operator[], blank: Blank = 'result'): EquationCard {
  const card: EquationCard = { kind: 'equation', level, operands: [...operands], operators: [...operators], blank };
  if (withBlank(card, blank) === null) throw new RangeError('Equation does not have a unique nonnegative blank solution');
  return card;
}

export function equationAnswer(card: EquationCard): number {
  return card.blank === 'result' ? evaluate(card.operands, card.operators).at(-1)! : card.operands[card.blank]!;
}
