import type { Card, Language, VennTarget } from './types.ts';
import type { PublicCard } from './projection.ts';

const targetText: Record<Language, Record<VennTarget, string>> = {
  en: {
    leftOnly: 'How many are only in A?', shared: 'How many are in both groups?',
    rightOnly: 'How many are only in B?', left: 'How many are in A?',
    right: 'How many are in B?', union: 'How many are in either group?',
  },
  vi: {
    leftOnly: 'Có bao nhiêu chỉ trong A?', shared: 'Có bao nhiêu trong cả hai?',
    rightOnly: 'Có bao nhiêu chỉ trong B?', left: 'Có bao nhiêu trong A?',
    right: 'Có bao nhiêu trong B?', union: 'Có bao nhiêu trong hai nhóm?',
  },
};

export function promptText(card: Card | PublicCard, language: Language): string {
  switch (card.kind) {
    case 'equation': {
      const missingOperand = 'blank' in card ? card.blank !== 'result' : card.values.some((value) => value === null);
      if (missingOperand) return language === 'en' ? 'Find the missing number' : 'Điền số còn thiếu';
      const multiplicationResult = card.operators.length === 1 && card.operators[0] === '×'
        && ('blank' in card ? card.blank === 'result' : card.result === null);
      if (multiplicationResult) return language === 'en' ? 'Multiply the numbers' : 'Nhân hai số';
      return language === 'en' ? 'Solve the equation' : 'Giải phép tính';
    }
    case 'venn': return targetText[language][card.target];
    case 'counting': return language === 'en' ? 'How many stars?' : 'Có bao nhiêu ngôi sao?';
    case 'compare': return language === 'en' ? 'Choose the sign' : 'Chọn dấu đúng';
    case 'picture': return language === 'en' ? 'What animal is this?' : 'Đây là con gì?';
  }
}

