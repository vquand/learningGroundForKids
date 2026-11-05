import { equationAnswer } from './equation.ts';
import { makeQuestion, questionKey } from './identity.ts';
import { ANIMAL_CATALOG } from './picture.ts';
import { compareCard } from './compare.ts';
import { countingCard } from './counting.ts';
import { equationCard } from './equation.ts';
import { vennAnswer } from './venn.ts';
import type { AnimalId, Blank, Card, Operator, PictureCard, Question, VennCard, VennFriend, VennItem, VennRegion, VennTarget } from './types.ts';

type RecordValue = Record<string, unknown>;
type EquationLevel = Exclude<Card['level'], 'picture-animals'>;
type LegacyBaitId = 'baby' | 'beginner' | 'leafy' | 'chewy' | 'bouncy' | 'crunchy' | 'master';
const INFINDRILL_LEVELS: readonly EquationLevel[] = [
  'add-1d', 'sub-1d', 'add-chain-1d', 'sub-chain-1d', 'mixed-chain-1d',
  'addsub-2d1d', 'addsub-2d1d-regroup', 'add-2d', 'sub-2d', 'chain-2d-3',
  'chain-2d-4', 'mul-1d', 'mul-teens-small', 'mul-teens-large', 'addsub-3d1d',
  'addsub-3d2d', 'chain-3d-3', 'chain-3d-4',
];
const record = (value: unknown): RecordValue | null =>
  value !== null && typeof value === 'object' ? value as RecordValue : null;
const number = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);
const string = (value: unknown): value is string => typeof value === 'string';
const BAIT_IDS: readonly LegacyBaitId[] = ['baby','beginner','leafy','chewy','bouncy','crunchy','master'];
const isBaitId = (value: unknown): value is LegacyBaitId => BAIT_IDS.some((candidate) => candidate === value);
const isAnimalId = (value: unknown): value is AnimalId => string(value) && value in ANIMAL_CATALOG;
const safe = <T>(callback: () => T): T | null => { try { return callback(); } catch { return null; } };
function op(value: unknown): Operator | null {
  if (value === '-') return '−';
  return value === '+' || value === '−' || value === '×' || value === '÷' ? value : null;
}
const VENN_REGIONS: readonly VennRegion[] = ['leftOnly', 'shared', 'rightOnly'];
const VENN_TARGETS: readonly VennTarget[] = [...VENN_REGIONS, 'left', 'right', 'union'];
const VENN_FRIENDS: readonly VennFriend[] = ['star', 'capybara', 'cow', 'highland', 'chick', 'penguin'];
const isVennRegion = (value: unknown): value is VennRegion => VENN_REGIONS.some((candidate) => candidate === value);
const isVennTarget = (value: unknown): value is VennTarget => VENN_TARGETS.some((candidate) => candidate === value);
const isVennFriend = (value: unknown): value is VennFriend => VENN_FRIENDS.some((candidate) => candidate === value);
const LEVEL_IDS: readonly Card['level'][] = [
  'count-10', 'add-1d', 'sub-1d', 'add-chain-1d', 'sub-chain-1d', 'mixed-chain-1d', 'venn-small', 'addsub-20',
  'addsub-2d1d', 'addsub-2d1d-regroup', 'venn-large', 'add-2d', 'sub-2d', 'compare-100', 'chain-2d-3',
  'chain-2d-4', 'mul-2to5', 'mul-1d', 'mul-teens-small', 'mul-teens-large', 'div-1d', 'addsub-3d1d',
  'addsub-3d2d', 'chain-3d-3', 'chain-3d-4', 'picture-animals',
];
const isLevelId = (value: unknown): value is Card['level'] => LEVEL_IDS.some((candidate) => candidate === value);
/** Legacy question IDs are public handles; never derive them from card data. */
function opaqueLegacyId(_key: string, prefix = 'legacy-question'): string {
  return `${prefix}-legacy-0`;
}
function responseFromNew(value: RecordValue): Question['response'] {
  const response = record(value.response);
  if (response?.mode === 'choice' && Array.isArray(response.choices) && response.choices.every(string) && number(response.correct)
    && response.correct >= 0 && response.correct < response.choices.length) {
    return { mode: 'choice', choices: response.choices, correct: response.correct };
  }
  return { mode: 'typed' };
}
function fromNewInfinidrillQuestion(value: RecordValue): Question | null {
  const sourceCard = record(value.card);
  if (!sourceCard || !string(sourceCard.kind) || !isLevelId(sourceCard.level)) return null;
  const level = sourceCard.level as Card['level'];
  const card = safe((): Card | null => {
    if (sourceCard.kind === 'equation' && Array.isArray(sourceCard.operands) && sourceCard.operands.every(number)
      && Array.isArray(sourceCard.operators)) {
      const operators = sourceCard.operators.map(op);
      if (operators.some((operator) => operator === null)) return null;
      const blank: Blank | null = sourceCard.blank === 'result' || number(sourceCard.blank) ? sourceCard.blank as Blank : null;
      if (blank === null) return null;
      return equationCard(level, sourceCard.operands, operators.filter((operator): operator is Operator => operator !== null), blank);
    }
    if (sourceCard.kind === 'venn') {
      const regions = record(sourceCard.regions);
      const items = sourceCard.items;
      if (!regions || !number(regions.leftOnly) || !number(regions.shared) || !number(regions.rightOnly)
        || regions.leftOnly < 0 || regions.shared < 0 || regions.rightOnly < 0 || !isVennTarget(sourceCard.target)
        || !isVennFriend(sourceCard.friend) || !Array.isArray(items)) return null;
      const cleanItems = items.flatMap((item) => {
        const row = record(item);
        return row && isVennRegion(row.region) && isVennFriend(row.kind)
          ? [{ region: row.region, pink: row.pink === true, kind: row.kind }]
          : [];
      });
      if (cleanItems.length !== items.length) return null;
      return { kind: 'venn', level: level, regions: { leftOnly: regions.leftOnly, shared: regions.shared, rightOnly: regions.rightOnly }, target: sourceCard.target, friend: sourceCard.friend, items: cleanItems };
    }
    if (sourceCard.kind === 'counting' && number(sourceCard.count) && sourceCard.picture === 'star') return countingCard(sourceCard.count, level);
    if (sourceCard.kind === 'compare' && number(sourceCard.left) && number(sourceCard.right)) return compareCard(sourceCard.left, sourceCard.right, level);
    if (sourceCard.kind === 'picture' && isAnimalId(sourceCard.subject)) return { kind: 'picture', level: 'picture-animals', subject: sourceCard.subject };
    return null;
  });
  return card ? makeQuestion(card, string(value.id) ? value.id : opaqueLegacyId(questionKey(card), 'earth-question'), responseFromNew(value)) : null;
}
function makeVennItems(leftOnly: number, shared: number, rightOnly: number): VennItem[] {
  const items: VennItem[] = [];
  for (let index = 0; index < leftOnly; index += 1) {
    items.push({ region: 'leftOnly', pink: true, kind: 'capybara' });
  }
  for (let index = 0; index < shared; index += 1) {
    items.push({ region: 'shared', pink: true, kind: 'star' });
  }
  for (let index = 0; index < rightOnly; index += 1) {
    items.push({ region: 'rightOnly', pink: false, kind: 'star' });
  }
  return items;
}
const oldLevel = (level: unknown): EquationLevel | null => {
  if (!number(level) || level < 1 || level > 18) return null;
  return INFINDRILL_LEVELS[level - 1] ?? null;
};
const vennLevel = (level: unknown): 'venn-small' | 'venn-large' | null =>
  number(level) && level >= 1 && level <= 2
    ? 'venn-small'
    : number(level) && level >= 3 && level <= 11 ? 'venn-large' : null;

function responseFrom(value: RecordValue, fallback: Question['response'] = { mode: 'typed' }): Question['response'] {
  const choices = value.choices;
  const correct = value.correct ?? value.correctLane;
  if (Array.isArray(choices) && number(correct) && choices.every(string)
    && correct >= 0 && correct < choices.length) {
    return { mode: 'choice', choices, correct };
  }
  if (Array.isArray(choices) && number(correct) && choices.every((item) => number(item))
    && correct >= 0 && correct < choices.length) {
    return { mode: 'choice', choices: choices.map(String), correct };
  }
  return fallback;
}

function legacyVennCard(venn: RecordValue, level: unknown): VennCard | null {
  const vennLevelId = vennLevel(level);
  if (!vennLevelId || !isVennTarget(venn.target) || !isVennFriend(venn.friend) || !Array.isArray(venn.items)) return null;
  const counts = { leftOnly: 0, shared: 0, rightOnly: 0 };
  const cleanItems = venn.items.flatMap((item) => {
    const row = record(item); const region = row?.region; const kind = row?.kind;
    if (!row || !isVennRegion(region) || !isVennFriend(kind)) return [];
    counts[region] += 1;
    return [{ region, pink: row.pink === true, kind }];
  });
  if (cleanItems.length !== venn.items.length) return null;
  return { kind: 'venn', level: vennLevelId, regions: counts, target: venn.target, friend: venn.friend, items: cleanItems };
}

export function fromInfinidrillQuestion(value: unknown): Question | null {
  const source = record(value);
  if (!source) return null;
  if (source.card) return fromNewInfinidrillQuestion(source);
  const venn = record(source.venn);
  if (venn) {
    const card = legacyVennCard(venn, source.level);
    if (!card) return null;
    const id = string(source.id) ? source.id : opaqueLegacyId(questionKey(card), 'earth-question');
    return {
      id, card, response: { mode: 'typed' },
      answer: number(source.answer) ? source.answer : vennAnswer(card), key: questionKey(card),
    };
  }
  const level = oldLevel(source.level);
  if (!level) return null;
  if (!Array.isArray(source.operands) || !Array.isArray(source.operators)) return null;
  const operands = source.operands.filter(number);
  if (operands.length !== source.operands.length) return null;
  const cleanOperators = source.operators.map(op);
  if (cleanOperators.some((value) => value === null)) return null;
  const operationList = cleanOperators.filter((value): value is Operator => value !== null);
  if (operands.length !== operationList.length + 1) return null;
  const blank = number(source.missingOperand) ? source.missingOperand : 'result';
  const equationLevel: EquationLevel = source.level === 14 && operationList[0] === '÷' ? 'div-1d' : level;
  const card = safe(() => equationCard(equationLevel, operands, operationList, blank));
  if (!card) return null;
  const answer = number(source.answer) ? source.answer : equationAnswer(card);
  const id = string(source.id) ? source.id : opaqueLegacyId(questionKey(card), 'earth-question');
  return { id, card, response: { mode: 'typed' }, answer, key: questionKey(card) };
}

export function questionKeyFromInfinidrill(value: unknown): string | null {
  if (string(value)) {
    const vennKey = value.match(/^venn:(leftOnly|shared|rightOnly|left|right|union):(\d+),(\d+),(\d+)$/);
    if (vennKey) return `venn:${vennKey[1]}:${vennKey[2]},${vennKey[3]},${vennKey[4]}`;
    const arithmeticKey = value.match(/^([+−×÷](?:,[+−×÷])*):([0-9]+(?:,[0-9]+)*)$/);
    if (!arithmeticKey) return null;
    const cleanOperators = arithmeticKey[1]!.split(',').map(op);
    const operands = arithmeticKey[2]!.split(',').map(Number);
    const operationList = cleanOperators.filter((operator): operator is Operator => operator !== null);
    if (operationList.length !== cleanOperators.length
      || operands.some((operand) => !Number.isSafeInteger(operand))
      || operands.length !== operationList.length + 1) return null;
    return questionKey({ kind: 'equation', level: 'add-1d', operands, operators: operationList, blank: 'result' });
  }
  const source = record(value); if (!source) return null;
  if (source.card) return fromNewInfinidrillQuestion(source)?.key ?? null;
  const venn = record(source.venn);
  if (venn) {
    const card = legacyVennCard(venn, source.level);
    return card ? questionKey(card) : null;
  }
  if (!Array.isArray(source.operands) || !source.operands.every(number) || !Array.isArray(source.operators)) return null;
  const level = oldLevel(source.level);
  if (!level) return null;
  const operands = source.operands.filter(number);
  if (operands.length !== source.operands.length) return null;
  const clean = source.operators.map(op);
  const operationList = clean.filter((value): value is Operator => value !== null);
  if (operationList.length !== clean.length || operands.length !== operationList.length + 1) return null;
  return questionKey({ kind: 'equation', level, operands, operators: operationList, blank: 'result' });
}

function mathWallCard(source: RecordValue): { card: Card; answer: number } | null {
  try {
    const counting = source.counting;
    if (number(counting)) return { card: countingCard(counting), answer: counting };
    if (!string(source.expression)) return null;
    const match = source.expression.trim().match(/^(\d+)\s*([+−×-])\s*(\d+)$/);
    if (!match) return null;
    const left = Number(match[1]);
    const right = Number(match[3]);
    const operator = op(match[2]);
    if (!operator) return null;
    const difficulty = source.difficulty;
    if (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard') return null;
    const level: Card['level'] = difficulty === 'easy'
      ? 'add-1d'
      : difficulty === 'medium'
        ? 'addsub-20'
        : operator === '+' ? 'add-2d' : operator === '−' ? 'sub-2d' : 'mul-1d';
    const card = equationCard(level, [left, right], [operator]);
    return { card, answer: number(source.answer) ? source.answer : equationAnswer(card) };
  } catch { return null; }
}

export function fromMathWallQuestion(value: unknown): Question | null {
  const source = record(value);
  if (!source) return null;
  if (source.card) return fromNewInfinidrillQuestion(source);
  const parsed = mathWallCard(source);
  if (!parsed) return null;
  return makeQuestion(parsed.card, string(source.id) ? source.id : opaqueLegacyId(questionKey(parsed.card), 'waddle-question'), responseFrom(source));
}

export function questionKeyFromMathWall(value: unknown): string | null {
  if (string(value)) return mathWallSeenKey(value);
  const source = record(value); if (!source) return null;
  const parsed = mathWallCard(source); return parsed ? questionKey(parsed.card) : null;
}

export function mathWallSeenKey(value: unknown): string | null {
  if (!string(value)) return null;
  const count = value.match(/^count:(\d+)$/); if (count) return safe(() => questionKey(countingCard(Number(count[1]))));
  const canonical = value.match(/^([+−×÷](?:,[+−×÷])*):([0-9]+(?:,[0-9]+)*)$/);
  if (canonical) {
    const operators = canonical[1]!.split(',').map(op);
    const operands = canonical[2]!.split(',').map(Number);
    if (operators.some((operator) => operator === null) || operands.length !== operators.length + 1) return null;
    const operatorList = operators.filter((operator): operator is Operator => operator !== null);
    const level: EquationLevel = operatorList[0] === '+' ? 'add-1d' : operatorList[0] === '−' ? 'sub-1d' : operatorList[0] === '×' ? 'mul-1d' : 'div-1d';
    return safe(() => questionKey(equationCard(level, operands, operatorList)));
  }
  const match = value.match(/^(\d+)([+−×-])(\d+)$/); if (!match) return null;
  const operator = op(match[2]); if (!operator) return null;
  const level = operator === '+' ? 'add-1d' : operator === '−' ? 'sub-1d' : 'mul-1d';
  return safe(() => questionKey(equationCard(level, [Number(match[1]), Number(match[3])], [operator])));
}

export function fromRoadRacingQuestion(value: unknown): Question | null {
  const source = record(value); if (!source) return null;
  if (source.card) return fromNewRoadRacingQuestion(source);
  if (!string(source.kind)) return null;
  const id = string(source.id) ? source.id : opaqueLegacyId(string(source.key) ? source.key : source.kind);
  if (source.kind === 'compare' && Array.isArray(source.numbers) && source.numbers.length === 2 && source.numbers.every(number)) {
    const numbers = source.numbers.filter(number);
    const card = safe(() => compareCard(numbers[0]!, numbers[1]!)); if (!card) return null; return makeQuestion(card, id, responseFrom(source));
  }
  if (source.kind === 'picture' && isAnimalId(source.animal)) {
    const subject = source.animal;
    const response = responseFrom(source);
    const card: PictureCard = { kind: 'picture', level: 'picture-animals', subject };
    return { id, card, response, answer: subject, key: questionKey(card) };
  }
  const venn = record(source.venn);
  if (source.kind === 'venn' && venn && source.target !== undefined) {
    const counts = ['leftOnly','shared','rightOnly'].map((key) => venn[key]);
    if (counts.every((value): value is number => number(value) && value >= 0) && isVennTarget(source.target)) {
      const target = source.target;
      const card: VennCard = {
        kind: 'venn', level: 'venn-small',
        regions: { leftOnly: counts[0]!, shared: counts[1]!, rightOnly: counts[2]! },
        target, friend: 'star', items: makeVennItems(counts[0]!, counts[1]!, counts[2]!),
      };
      return makeQuestion(card, id, responseFrom(source));
    }
  }
  if (source.kind === 'arithmetic' && Array.isArray(source.values) && source.values.length === 3 && string(source.operator)) {
    const operator = op(source.operator);
    if (!operator || !['+', '−', '×'].includes(operator)
      || !source.values.every((item) => item === null || number(item))) return null;
    const values = source.values.filter((item): item is number | null => item === null || number(item));
    if (values.length !== source.values.length) return null;
    const missing = values.findIndex((item) => item === null);
    let operands: [number, number];
    let blank: number | 'result';
    if (missing === 0 && number(values[1]) && number(values[2])) {
      const left = operator === '+'
        ? values[2]! - values[1]!
        : operator === '−' ? values[2]! + values[1]! : values[2]! / values[1]!;
      operands = [left, values[1]!];
      blank = 0;
    } else if (missing === 1 && number(values[0]) && number(values[2])) {
      const right = operator === '+'
        ? values[2]! - values[0]!
        : operator === '−' ? values[0]! - values[2]! : values[2]! / values[0]!;
      operands = [values[0]!, right];
      blank = 1;
    } else if (missing === 2 && number(values[0]) && number(values[1])) {
      operands = [values[0]!, values[1]!];
      blank = 'result';
    } else return null;
    if (!operands.every((item) => Number.isSafeInteger(item) && item >= 0)) return null;
    const card = safe(() => equationCard(operator === '×' ? 'mul-1d' : 'addsub-2d1d', operands, [operator], blank)); if (!card) return null;
    return makeQuestion(card, id, responseFrom(source));
  }
  return null;
}

export function roadRacingSeenKey(value: unknown): string | null {
  if (!string(value)) return null;
  const canonicalCompare = value.match(/^compare:(\d+),(\d+)$/);
  if (canonicalCompare) return safe(() => questionKey(compareCard(Number(canonicalCompare[1]), Number(canonicalCompare[2]))));
  const canonicalPicture = value.match(/^picture:([a-z]+)$/);
  if (canonicalPicture && isAnimalId(canonicalPicture[1])) return questionKey({ kind: 'picture', level: 'picture-animals', subject: canonicalPicture[1] });
  const canonicalVenn = value.match(/^venn:(leftOnly|shared|rightOnly|left|right|union):(\d+),(\d+),(\d+)$/);
  if (canonicalVenn) {
    const target = canonicalVenn[1] as VennTarget;
    return safe(() => questionKey({ kind: 'venn', level: 'venn-small', regions: { leftOnly: Number(canonicalVenn[2]), shared: Number(canonicalVenn[3]), rightOnly: Number(canonicalVenn[4]) }, target, friend: 'star', items: makeVennItems(Number(canonicalVenn[2]), Number(canonicalVenn[3]), Number(canonicalVenn[4])) }));
  }
  const canonicalEquation = value.match(/^([+−×÷-](?:,[+−×÷-])*):([0-9]+(?:,[0-9]+)*)$/);
  if (canonicalEquation) {
    const operators = canonicalEquation[1]!.split(',').map(op);
    const operands = canonicalEquation[2]!.split(',').map(Number);
    if (operators.some((operator) => operator === null) || operands.length !== operators.length + 1) return null;
    const clean = operators.filter((operator): operator is Operator => operator !== null);
    const level: EquationLevel = clean[0] === '×' ? 'mul-1d' : clean[0] === '÷' ? 'div-1d' : clean[0] === '−' ? 'sub-2d' : 'add-2d';
    return safe(() => questionKey(equationCard(level, operands, clean)));
  }
  let match = value.match(/^c:(\d+):(\d+)$/);
  if (match) {
    const current = match;
    return safe(() => questionKey(compareCard(Number(current[1]), Number(current[2]))));
  }
  match = value.match(/^([am]):(\d+):(\d+)(?::(true|false):(\d+))?$/);
  if (match) {
    const current = match;
    const operator = current[1] === 'm' ? '×' : current[4] === 'true' ? '−' : '+';
    const level = operator === '×' ? 'mul-1d' : 'addsub-2d1d';
    return safe(() => questionKey(equationCard(level, [Number(current[2]), Number(current[3])], [operator])));
  }
  match = value.match(/^p:([a-z]+)$/);
  if (match && isAnimalId(match[1])) {
    return questionKey({ kind: 'picture', level: 'picture-animals', subject: match[1] });
  }
  match = value.match(/^v:(\d+):(\d+):(\d+):(leftOnly|shared|rightOnly|left|right|union)$/);
  if (match) return `venn:${match[4]}:${match[1]},${match[2]},${match[3]}`;
  return null;
}

function fromNewRoadRacingQuestion(source: RecordValue): Question | null {
  const card = record(source.card);
  if (!card || !isLevelId(card.level)) return null;
  const id = string(source.id) ? source.id : opaqueLegacyId(JSON.stringify(card), 'road-question');
  if (card.kind === 'compare' && number(card.left) && number(card.right)) {
    return makeQuestion(compareCard(card.left, card.right), id, responseFromNew(source));
  }
  if (card.kind === 'picture' && isAnimalId(card.subject)) {
    const picture: PictureCard = { kind: 'picture', level: 'picture-animals', subject: card.subject };
    return makeQuestion(picture, id, responseFromNew(source));
  }
  if (card.kind === 'venn') {
    const regions = record(card.regions);
    if (!isVennTarget(card.target) || !isVennFriend(card.friend) || !Array.isArray(card.items)) return null;
    const items = card.items.flatMap((item) => {
      const row = record(item);
      return row && isVennRegion(row.region) && isVennFriend(row.kind)
        ? [{ region: row.region, pink: row.pink === true, kind: row.kind }]
        : [];
    });
    if (items.length !== card.items.length) return null;
    const counts = regions && number(regions.leftOnly) && number(regions.shared) && number(regions.rightOnly)
      ? { leftOnly: regions.leftOnly, shared: regions.shared, rightOnly: regions.rightOnly }
      : items.reduce((result, item) => ({ ...result, [item.region]: result[item.region] + 1 }), { leftOnly: 0, shared: 0, rightOnly: 0 });
    const venn: VennCard = { kind: 'venn', level: card.level, regions: counts, target: card.target, friend: card.friend, items };
    return makeQuestion(venn, id, responseFromNew(source));
  }
  if (card.kind === 'equation' && Array.isArray(card.operators)) {
    const operators = card.operators.map(op);
    if (operators.some((operator) => operator === null)) return null;
    const cleanOperators = operators.filter((operator): operator is Operator => operator !== null);
    let operands: number[];
    let blank: Blank;
    if (Array.isArray(card.operands) && card.operands.every(number)) {
      if (card.blank !== 'result' && !number(card.blank)) return null;
      operands = [...card.operands];
      blank = card.blank as Blank;
    } else if (Array.isArray(card.values) && card.values.length === cleanOperators.length + 1
      && card.values.every((item) => item === null || number(item))) {
      const values = card.values as (number | null)[];
      const missing = values.findIndex((item) => item === null);
      if (card.result === null && values.every(number)) {
        operands = values.filter((item): item is number => number(item));
        blank = 'result';
      } else if (number(card.result)) {
        if (missing < 0) return null;
        if (missing === 0 && number(values[1])) {
          const right = cleanOperators[0] === '+' ? card.result - values[1] : cleanOperators[0] === '−' ? card.result + values[1] : card.result / values[1];
          operands = [right, values[1]]; blank = 0;
        } else if (missing === 1 && number(values[0])) {
          const right = cleanOperators[0] === '+' ? card.result - values[0] : cleanOperators[0] === '−' ? values[0] - card.result : card.result / values[0];
          operands = [values[0], right]; blank = 1;
        } else return null;
      } else return null;
    } else return null;
    if (!operands.every((item) => Number.isSafeInteger(item) && item >= 0)) return null;
    return safe(() => makeQuestion(equationCard(card.level as Card['level'], operands, cleanOperators, blank), id, responseFromNew(source)));
  }
  return null;
}

export type FishingQuestionLevels = Readonly<Record<LegacyBaitId, {
  readonly level: EquationLevel;
  readonly operators: readonly [Operator];
}>>;

export function fromFishingQuestion(value: unknown, baitLevels: FishingQuestionLevels): Question | null {
  const outer = record(value);
  const nested = record(outer?.question);
  const source = nested ?? outer;
  if (!outer || !source) return null;
  const baitValue = outer.baitId ?? source.baitId;
  if (!isBaitId(baitValue)) return null;
  const baitId = baitValue;
  const { level, operators } = baitLevels[baitId];
  const expectedOperator = operators[0];
  const sourceCard = record(source.card);
  if (sourceCard?.kind === 'equation' && Array.isArray(sourceCard.operands) && sourceCard.operands.length === 2
    && sourceCard.operands.every(number) && Array.isArray(sourceCard.operators) && sourceCard.operators.length === 1) {
    const cardOperator = op(sourceCard.operators[0]);
    const cardBlank: Blank | null = sourceCard.blank === 'result' || number(sourceCard.blank) ? sourceCard.blank as Blank : null;
    if (cardOperator !== expectedOperator || cardBlank === null) return null;
    const card = safe(() => equationCard(level, sourceCard.operands as number[], [cardOperator], cardBlank));
    if (!card) return null;
    const id = string(source.id) ? source.id : string(outer.id) ? outer.id : opaqueLegacyId(`${baitId}:${questionKey(card)}`, 'fishing-question');
    return makeQuestion(card, id, { mode: 'typed' });
  }
  const expression = string(source.expression) ? source.expression.trim() : null;
  const expressionMatch = expression?.match(/^(\?|\d+)\s*([+−×÷-])\s*(\?|\d+)(?:\s*=\s*(\?|\d+))?$/);
  const layout = record(source.layout);
  const layoutValues = Array.isArray(layout?.values) && layout.values.length === 2
    && layout.values.every((item) => item === null || number(item)) ? layout.values as [number | null, number | null] : null;
  const layoutResult = layout && (layout.result === null || number(layout.result)) ? layout.result as number | null : null;
  const operator = op(layout?.operator ?? expressionMatch?.[2]);
  if (!operator || operator !== expectedOperator) return null;

  let blank: number | 'result' = 'result';
  if (layoutValues && (layoutResult !== null || layout?.result === null)) {
    const blankValue = [layoutResult, ...layoutValues].findIndex((item) => item === null);
    blank = blankValue === 1 ? 0 : blankValue === 2 ? 1 : 'result';
  } else if (expressionMatch) {
    blank = expressionMatch[1] === '?' ? 0 : expressionMatch[3] === '?' ? 1 : expressionMatch[4] === '?' ? 'result' : 'result';
  }

  const savedOperands = Array.isArray(source.operands) && source.operands.length === 2 && source.operands.every(number)
    ? source.operands as [number, number] : null;
  let operands: [number, number] | null = savedOperands;
  const visibleLeft = expressionMatch && expressionMatch[1] !== '?' ? Number(expressionMatch[1]) : layoutValues?.[0] ?? null;
  const visibleRight = expressionMatch && expressionMatch[3] !== '?' ? Number(expressionMatch[3]) : layoutValues?.[1] ?? null;
  const visibleResult = expressionMatch?.[4] && expressionMatch[4] !== '?' ? Number(expressionMatch[4]) : layoutResult !== null ? layoutResult : null;
  if (!operands && visibleLeft !== null && visibleRight !== null) operands = [visibleLeft, visibleRight];
  if (!operands && blank === 0 && visibleRight !== null && visibleResult !== null) {
    const left = operator === '+' ? visibleResult - visibleRight : operator === '−' ? visibleResult + visibleRight : operator === '×' ? visibleResult / visibleRight : visibleResult * visibleRight;
    if (Number.isSafeInteger(left)) operands = [left, visibleRight];
  }
  if (!operands && blank === 1 && visibleLeft !== null && visibleResult !== null) {
    const right = operator === '+' ? visibleResult - visibleLeft : operator === '−' ? visibleLeft - visibleResult : operator === '×' ? visibleResult / visibleLeft : visibleLeft / visibleResult;
    if (Number.isSafeInteger(right)) operands = [visibleLeft, right];
  }
  if (!operands) return null;
  const card = safe(() => equationCard(level, operands, [operator], blank));
  if (!card) return null;
  const id = string(source.id) ? source.id : string(outer.id) ? outer.id : opaqueLegacyId(`${baitId}:${questionKey(card)}`, 'fishing-question');
  return makeQuestion(card, id, { mode: 'typed' });
}

export function fishingSeenKey(value: unknown): string | null {
  if (!string(value)) return null;
  const match = value.match(/^([+−×÷-]):(\d+)(?::|,)(\d+)$/);
  if (!match) return null;
  const operator = op(match[1]);
  if (!operator) return null;
  const level = operator === '+'
    ? 'addsub-2d1d'
    : operator === '−' ? 'sub-2d' : operator === '×' ? 'mul-1d' : 'div-1d';
  return safe(() => questionKey(equationCard(level, [Number(match[2]), Number(match[3])], [operator])));
}

