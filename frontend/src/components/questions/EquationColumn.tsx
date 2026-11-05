import type { Language } from '../../../../server/src/questions/types.ts';
import type { PublicQuestion } from '../../../../server/src/questions/projection.ts';

interface EquationColumnProps {
  readonly question: PublicQuestion;
  readonly input?: string;
  readonly className?: string;
  readonly variant?: 'column' | 'inline';
  readonly language?: Language;
  readonly answerLabel?: string;
}

export function EquationColumn({ question, input = '', className = '', variant = 'column', language = 'en', answerLabel }: EquationColumnProps) {
  if (question.card.kind !== 'equation') return null;
  const { values, operators, result } = question.card;
  const missing = language === 'vi' ? 'số còn thiếu' : 'missing number';
  const equals = language === 'vi' ? 'bằng' : 'equals';
  const expression = values.map((value, index) => `${index === 0 ? '' : `${operators[index - 1] ?? ''} `}${value === null ? missing : value}`).join(' ');
  const label = `${expression} ${equals} ${result === null ? missing : result}`;
  if (variant === 'inline') return <span className={`question-equation-inline ${className}`.trim()} role="img" aria-label={label}>{expression} = {result === null ? '?' : result}</span>;
  return <div className={`question-equation-column ${className}`.trim()} role="img" aria-live="polite" aria-label={label}>
    {values.map((value, index) => {
      const missing = value === null;
      const answer = missing ? input || '?' : value;
      return <div className="question-math-row infinidrill-math-row" key={index}>
        <span className="question-math-operator">{operators[index - 1] ?? ''}</span>
        <span className={`question-math-number infinidrill-math-number${missing ? ' is-missing question-answer-line' : ''}`}>{missing && answerLabel ? <output aria-label={answerLabel}>{answer}</output> : answer}</span>
      </div>;
    })}
    {(() => {
      const missing = result === null;
      const answer = missing ? input || '?' : result;
      return <div className="question-math-row question-result-row infinidrill-math-row is-result">
        <span className="question-math-operator" />
        <span className={`question-math-number infinidrill-math-number${missing ? ' question-answer-line' : ''}`}>{missing && answerLabel ? <output aria-label={answerLabel}>{answer}</output> : answer}</span>
      </div>;
    })()}
  </div>;
}
