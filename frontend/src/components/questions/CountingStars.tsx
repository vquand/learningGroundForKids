import type { Language } from '../../../../server/src/questions/types.ts';
import type { PublicQuestion } from '../../../../server/src/questions/projection.ts';

interface CountingStarsProps {
  readonly question: PublicQuestion;
  readonly language: Language;
  readonly className?: string;
}

export function CountingStars({ question, language, className = '' }: CountingStarsProps) {
  if (question.card.kind !== 'counting') return null;
  const stars = language === 'vi' ? 'ngôi sao' : 'stars';
  return <div className={`math-counting ${className}`.trim()} lang={language} role="img" aria-label={`${question.card.count} ${stars}`}>
    {Array.from({ length: question.card.count }, (_, index) => <span key={index} aria-hidden="true">★</span>)}
  </div>;
}
