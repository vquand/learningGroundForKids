import { equationAnswer } from './equation.ts';
import { vennAnswer } from './venn.ts';
import type { Card, Question } from './types.ts';

export function questionKey(card: Card | Question): string {
  const value = 'card' in card ? card.card : card;
  switch (value.kind) {
    case 'equation': {
      const commutative = value.operators.every((operator) => operator === '+') || value.operators.every((operator) => operator === '×');
      const operands = commutative ? [...value.operands].sort((left, right) => left - right) : value.operands;
      return `${value.operators.join(',')}:${operands.join(',')}`;
    }
    case 'venn':
      return `venn:${value.target}:${value.regions.leftOnly},${value.regions.shared},${value.regions.rightOnly}`;
    case 'counting':
      return `count:${value.count}`;
    case 'compare':
      return `compare:${value.left},${value.right}`;
    case 'picture':
      return `picture:${value.subject}`;
  }
}

export function answerForCard(card: Card): string | number {
  switch (card.kind) {
    case 'equation': return equationAnswer(card);
    case 'venn': return vennAnswer(card);
    case 'counting': return card.count;
    case 'compare': return card.left < card.right ? '<' : card.left > card.right ? '>' : '=';
    case 'picture': return card.subject;
  }
}

export function makeQuestion(card: Card, id: string, response: Question['response'] = { mode: 'typed' }): Question {
  return { id, card, response, answer: answerForCard(card), key: questionKey(card) };
}

export function gradeQuestion(question: Question, submitted: string | number): boolean {
  return question.response.mode === 'choice'
    ? typeof submitted === 'number' && submitted === question.response.correct
    : submitted === question.answer;
}
