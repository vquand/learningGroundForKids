import { numericChoiceResponse } from '../questions/choices.ts';
import { compareChoiceResponse } from '../questions/compare.ts';
import { answerForCard, makeQuestion as buildQuestion } from '../questions/identity.ts';
import { selectQuestion } from '../questions/select.ts';
import { animalName, ANIMAL_CATALOG, ANIMAL_IDS, pictureChoiceResponse } from '../questions/picture.ts';
import { promptText } from '../questions/text.ts';
import type { Card, Language, Question, RandomSource } from '../questions/types.ts';

export type { Language } from '../questions/types.ts';

/** The seven animals that can appear in the playable race roster. */
export const ANIMALS = ['capybara', 'crocodile', 'duck', 'goose', 'cow', 'highland', 'chicken'] as const;
export type Animal = typeof ANIMALS[number];

export const ANIMAL_NAMES = Object.fromEntries(
  ANIMALS.map((animal) => [animal, [animalName(animal, 'en'), animalName(animal, 'vi')]]),
) as Record<Animal, [string, string]>;

// Keep these exports as a thin compatibility/configuration layer for roster,
// art, setup and browser-preview modules. The bilingual catalog itself lives
// in the shared picture question module.
export const QUESTION_ANIMAL_NAMES = Object.fromEntries(
  ANIMAL_IDS.map((animal) => [animal, [animalName(animal, 'en'), animalName(animal, 'vi')]]),
) as Record<(typeof ANIMAL_IDS)[number], [string, string]>;
export type QuestionAnimal = keyof typeof QUESTION_ANIMAL_NAMES;
export const QUESTION_ANIMALS = [...ANIMAL_IDS] as QuestionAnimal[];
export function questionAnimalImage(animal: QuestionAnimal): string | undefined {
  return ANIMAL_CATALOG[animal].imagePath ?? undefined;
}

export type { Card, Question } from '../questions/types.ts';

const ROAD_KINDS = ['compare', 'arithmetic', 'picture', 'venn'] as const;
type RoadKind = typeof ROAD_KINDS[number];

function opaqueQuestionId(sequence: number): string {
  return `road-question-${sequence}`;
}

function cardForKind(kind: RoadKind, sequence: number, random: RandomSource, seen: ReadonlySet<string>): Card | null {
  if (kind === 'compare') return selectQuestion('compare-100', random, seen);
  if (kind === 'picture') return selectQuestion('picture-animals', random, seen);
  if (kind === 'venn') return selectQuestion('venn-small', random, seen);

  const multiplication = Math.floor(sequence / 4) % 2 === 1;
  if (multiplication) {
    return selectQuestion(['mul-2to5', 'mul-1d'], random, seen, {
      blank: 'result',
      filter: (candidate) => candidate.kind === 'equation'
        && candidate.operands.every((operand) => operand >= 1 && operand <= 9),
    });
  }
  return selectQuestion(['addsub-2d1d', 'addsub-2d1d-regroup'], random, seen, {
    operators: ['+', '−'],
    blank: 'any',
  });
}

function fallbackKinds(kind: RoadKind): readonly RoadKind[] {
  // Picture is the historically exhausted pool. The remaining order keeps
  // the old picture → compare behaviour and gives every future pool a bounded
  // fallback without risking an infinite retry loop.
  return kind === 'picture' ? ['picture', 'compare', 'arithmetic', 'venn'] : [kind, 'compare', 'arithmetic', 'picture', 'venn'];
}

function responseForCard(card: Card, language: Language, random: RandomSource): Question['response'] {
  switch (card.kind) {
    case 'compare': return compareChoiceResponse(card, random);
    case 'picture': return pictureChoiceResponse(card.subject, language, random);
    case 'equation': {
      const answer = answerForCard(card);
      if (typeof answer !== 'number') throw new RangeError('Road Racing equation answer must be numeric');
      return numericChoiceResponse(answer, { count: 3, min: 0, random });
    }
    case 'venn': {
      const answer = answerForCard(card);
      if (typeof answer !== 'number') throw new RangeError('Road Racing Venn answer must be numeric');
      return numericChoiceResponse(answer, { count: 3, min: 0, max: 9, random });
    }
    case 'counting': throw new RangeError('Road Racing does not use counting questions');
  }
}

/** Issue a server-owned Road Racing question from the shared engine. */
export function makeQuestion(language: Language, sequence: number, seen: readonly string[], random: RandomSource): Question {
  const known = new Set(seen);
  const requested = ROAD_KINDS[sequence % ROAD_KINDS.length] ?? 'compare';
  for (const kind of fallbackKinds(requested)) {
    const card = cardForKind(kind, sequence, random, known);
    if (!card) continue;
    return buildQuestion(card, opaqueQuestionId(sequence), responseForCard(card, language, random));
  }
  throw new RangeError('Road Racing question pools are exhausted');
}

export function questionPrompt(question: Question, language: Language): string {
  return promptText(question.card, language);
}
