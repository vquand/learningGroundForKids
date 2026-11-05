import { evaluate } from './equation.ts';
import type { Card, Operator, Question, Response, VennFriend, VennItem, VennTarget, AnimalId } from './types.ts';

export type PublicResponse =
  | { readonly mode: 'typed' }
  | { readonly mode: 'choice'; readonly choices: readonly string[] };

export type PublicCard =
  | {
      readonly kind: 'equation'; readonly level: Card['level']; readonly values: readonly (number | null)[];
      readonly operators: readonly Operator[]; readonly result: number | null;
    }
  | { readonly kind: 'venn'; readonly level: Card['level']; readonly target: VennTarget; readonly friend: VennFriend; readonly items: readonly VennItem[] }
  | { readonly kind: 'counting'; readonly level: Card['level']; readonly count: number; readonly picture: 'star' }
  | { readonly kind: 'compare'; readonly level: Card['level']; readonly left: number; readonly right: number }
  | { readonly kind: 'picture'; readonly level: 'picture-animals'; readonly subject: AnimalId };

export interface PublicQuestion {
  readonly id: string;
  readonly card: PublicCard;
  readonly response: PublicResponse;
}

// Picture subjects and star counts are display data: the client needs the
// subject to draw the animal and the count to draw the stars. They are not
// private grading fields. Venn region labels on pictograms are also retained
// for rendering; explicit region counts remain private.

function publicResponse(response: Response): PublicResponse {
  return response.mode === 'typed' ? response : { mode: 'choice', choices: [...response.choices] };
}

export function publicQuestion(question: Question): PublicQuestion {
  let card: PublicCard;
  switch (question.card.kind) {
    case 'equation': {
      const equation = question.card;
      const result = evaluate(equation.operands, equation.operators).at(-1)!;
      card = {
        kind: 'equation',
        level: equation.level,
        values: equation.operands.map((value, index) => equation.blank === index ? null : value),
        operators: [...equation.operators],
        result: equation.blank === 'result' ? null : result,
      };
      break;
    }
    case 'venn': {
      const regionOrder = { leftOnly: 0, shared: 1, rightOnly: 2 } as const;
      const items = [...question.card.items].sort((left, right) => regionOrder[left.region] - regionOrder[right.region] || left.kind.localeCompare(right.kind));
      card = { kind: 'venn', level: question.card.level, target: question.card.target, friend: question.card.friend, items };
      break;
    }
    case 'counting': card = { ...question.card }; break;
    case 'compare': card = { ...question.card }; break;
    case 'picture': card = { ...question.card }; break;
  }
  return { id: question.id, card, response: publicResponse(question.response) };
}
