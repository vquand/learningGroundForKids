import type { PublicQuestion } from '../../../../server/src/questions/projection.ts';
import { EquationColumn } from './EquationColumn';
import { VennDiagram } from './VennDiagram';
import { CountingStars } from './CountingStars';
import { CompareSigns } from './CompareSigns';
import { AnimalPicture } from './AnimalPicture';
import type { AnimalId, Language } from '../../../../server/src/questions/types.ts';
import type { ReactNode } from 'react';
import './questions.css';

export interface QuestionViewProps {
  readonly question: PublicQuestion;
  readonly input?: string;
  readonly language: Language;
  readonly className?: string;
  readonly variant?: 'default' | 'inline';
  readonly answerLabel?: string;
  readonly renderAnimal?: (animal: AnimalId) => ReactNode;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported question kind: ${String(value)}`);
}

export function QuestionView({ question, input, language, className = '', variant = 'default', answerLabel, renderAnimal }: QuestionViewProps) {
  const content = (() => {
    switch (question.card.kind) {
      case 'equation': return <EquationColumn question={question} input={input} language={language} answerLabel={answerLabel} variant={variant === 'inline' ? 'inline' : 'column'} />;
      case 'venn': return <VennDiagram question={question} input={input} language={language} />;
      case 'counting': return <CountingStars question={question} language={language} />;
      case 'compare': return <CompareSigns question={question} />;
      case 'picture': return <AnimalPicture question={question} language={language} renderAnimal={renderAnimal} />;
      default: return assertNever(question.card);
    }
  })();
  return variant === 'inline' ? content : <div className={`question-view ${className}`.trim()}>{content}</div>;
}
