import type { ReactNode } from 'react';
import { promptText } from '../../../../server/src/questions/text.ts';
import { ANIMAL_CATALOG } from '../../../../server/src/questions/picture.ts';
import type { Language, AnimalId } from '../../../../server/src/questions/types.ts';
import type { PublicQuestion } from '../../../../server/src/questions/projection.ts';

interface AnimalPictureProps {
  readonly question: PublicQuestion;
  readonly language: Language;
  readonly renderAnimal?: (animal: AnimalId) => ReactNode;
  readonly className?: string;
}

export function AnimalPicture({ question, language, renderAnimal, className = '' }: AnimalPictureProps) {
  if (question.card.kind !== 'picture') return null;
  const subject = question.card.subject;
  const imagePath = ANIMAL_CATALOG[subject].imagePath;
  const art = renderAnimal
    ? renderAnimal(subject)
    : imagePath
      ? <img src={imagePath} alt="" />
      : <span aria-hidden="true" className="question-picture-placeholder">●</span>;
  return <div className={`question-animal-picture ${className}`.trim()} role="img" aria-label={promptText(question.card, language)}>{art}</div>;
}
