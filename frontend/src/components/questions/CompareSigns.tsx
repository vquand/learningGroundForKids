import { uiText } from '../../i18n/uiText';
import type { PublicQuestion } from '../../../../server/src/questions/projection.ts';

interface CompareSignsProps {
  readonly question: PublicQuestion;
  readonly className?: string;
}

export function CompareSigns({ question, className = '' }: CompareSignsProps) {
  if (question.card.kind !== 'compare') return null;
  const { left, right } = question.card;
  return <div className={`question-compare-signs ${className}`.trim()} role="img" aria-label={`${left} ${uiText('Missing sign')} ${right}`}>
    <span>{left}</span>
    <span className="question-empty-square" aria-hidden="true" />
    <span>{right}</span>
  </div>;
}
