import type { RacingState } from '../../api/roadRacing';
import { useState } from 'react';
import { RacingQuestionAnimal } from './RacingArt';
import { QuestionView } from '../../components/questions/QuestionView';
import { promptText } from '../../../../server/src/questions/text.ts';
import { uiText } from '../../i18n/uiText';

type Question = NonNullable<RacingState['race']>['question'];

export function RacingQuestion({ question, language, compact = false }: { question: Question; language: 'en' | 'vi'; compact?: boolean }) {
  return <div className="racing-question">
    {!compact && <p className="racing-prompt">{promptText(question.card, language)}</p>}
    <QuestionView
      question={question}
      language={language}
      className={compact ? 'is-compact' : ''}
      renderAnimal={(animal) => <RacingQuestionAnimal animal={animal} />}
    />
  </div>;
}

export function RacingQuiz(props: { race: NonNullable<RacingState['race']>; busy: boolean; answer: (choice: number) => void }) {
  return <RacingQuizCard key={`${props.race.id}:${props.race.question.id}`} {...props} />;
}

function RacingQuizCard({ race, busy, answer }: { race: NonNullable<RacingState['race']>; busy: boolean; answer: (choice: number) => void }) {
  // A stationary pointer or sticky touch hover is not a new answer selection.
  // Keyboard focus remains independently visible.
  const [hovered, setHovered] = useState<number | null>(null);
  const choices = race.question.response.mode === 'choice' ? race.question.response.choices : [];
  return <section className="racing-quiz" aria-label={uiText('Race question')}>
    <div className="racing-quiz-bubble" aria-live="polite" key={race.feedback ? `${race.feedback.question.id}:${race.feedback.kind}:${race.feedback.at}` : 'ready'}>
      {race.feedback
        ? race.feedback.kind === 'retry'
          ? <><span aria-hidden="true">↺</span><span>{uiText('Try again!')}</span></>
          : <><span aria-hidden="true">{race.feedback.correct ? '✓' : '♡'}</span><span>{race.feedback.kind === 'retry-correct' ? uiText('Got it!') : race.feedback.correct ? uiText('A little push!') : uiText('Now you know!')}</span><RacingQuestion question={race.feedback.question} language={race.language} compact /><strong>{race.feedback.answer}{race.feedback.kind === 'forced' && <> · <em>{uiText('Slowed down!')}</em></>}</strong></>
        : <span>{uiText('Every right answer gives your friend a push!')}</span>}
    </div>
    <div className="racing-card" key={race.question.id}>
      <RacingQuestion question={race.question} language={race.language} />
      <div className="racing-answers" role="group" aria-label={uiText('Choose an answer')}>
        {choices.map((choice, index) => { const triedWrong = race.triedChoices.includes(index); return <button
          type="button"
          key={index}
          className={[hovered === index ? 'is-hovered' : '',triedWrong ? 'is-tried-wrong' : ''].filter(Boolean).join(' ')}
          disabled={busy || race.status !== 'racing'}
          onPointerMove={(event) => { if (event.pointerType === 'mouse' && !busy) setHovered(index); }}
          onPointerLeave={() => setHovered(null)}
          onClick={() => { setHovered(null); answer(index); }}
        ><span className="racing-answer-key" aria-hidden="true">{index + 1}</span>{choice}{triedWrong&&<span className="racing-tried-label">{uiText('Tried, not correct')}</span>}</button>; })}
      </div>
    </div>
  </section>;
}
