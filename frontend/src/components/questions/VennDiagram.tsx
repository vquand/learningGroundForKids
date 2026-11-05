import { useEffect, useState } from 'react';
import { transparentKidAvatarSource } from '../../lib/avatarBackdrop';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiMessage, uiText } from '../../i18n/uiText';
import type { PublicQuestion } from '../../../../server/src/questions/projection.ts';
import type { Language } from '../../../../server/src/questions/types.ts';
import { promptText } from '../../../../server/src/questions/text.ts';

type VennQuestionCard = Extract<PublicQuestion['card'], { kind: 'venn' }>;
type Friend = VennQuestionCard['friend'];

const FRIENDS: Record<Friend, { readonly name: string; readonly file?: string }> = {
  star: { name: 'stars' },
  capybara: { name: 'capybaras', file: 'capybara-calm' },
  cow: { name: 'dairy cows', file: 'dairy-cow' },
  highland: { name: 'Highland cows', file: 'highland-cow' },
  chick: { name: 'chicks', file: 'yellow-chick' },
  penguin: { name: 'penguins', file: 'penguin-blue' },
};

interface VennDiagramProps {
  readonly question: PublicQuestion;
  readonly input?: string;
  readonly language?: Language;
  readonly className?: string;
}

function isVennQuestion(question: PublicQuestion): question is Omit<PublicQuestion, 'card'> & { readonly card: VennQuestionCard } {
  return question.card.kind === 'venn';
}

export function VennDiagram({ question, input = '', language = 'en', className = '' }: VennDiagramProps) {
  if (!isVennQuestion(question)) return null;
  return <VennDiagramCard question={question} input={input} language={language} className={className} />;
}

function VennDiagramCard({ question, input, language, className = '' }: {
  readonly question: Omit<PublicQuestion, 'card'> & { readonly card: VennQuestionCard };
  readonly input?: string;
  readonly language: Language;
  readonly className?: string;
}) {
  useUiLanguage();
  const { friend, items } = question.card;
  const [faceSources, setFaceSources] = useState<Record<string, string>>({});
  const faceFiles = [...new Set(items.flatMap((item) => {
    const file = FRIENDS[item.kind].file;
    return file ? [file] : [];
  }))].sort().join('|');
  useEffect(() => {
    let active = true;
    if (faceFiles) void Promise.all(faceFiles.split('|').map(async (file) => [file, await transparentKidAvatarSource(`/avatars/kids/${file}.webp`)] as const)).then((entries) => {
      if (active) setFaceSources((previous) => ({ ...previous, ...Object.fromEntries(entries) }));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [faceFiles]);
  return <div className={`question-venn ${className}`.trim()} aria-live="polite">
    <p className="question-venn-prompt infinidrill-venn-prompt">{promptText(question.card, language)}</p>
    <svg className="question-venn-svg infinidrill-venn" viewBox="0 0 520 238" role="img" aria-label={uiMessage('Venn diagram: Team A on the left, {friends} on the right. Shared friends belong to both groups.', { friends: uiText(FRIENDS[friend].name) })}>
      <rect x="8" y="32" width="310" height="198" rx="40" fill="#f5d2d9" fillOpacity=".6" stroke="#95646b" strokeWidth="3" />
      <rect x="202" y="32" width="310" height="198" rx="40" fill="#d7e6ca" fillOpacity=".6" stroke="#64835d" strokeWidth="3" />
      <text x="120" y="22" textAnchor="middle">{uiText('Team A')}</text><text x="404" y="22" textAnchor="middle">{uiText(FRIENDS[friend].name)}</text>
      {items.map((item, index) => {
        const slot = items.slice(0, index).filter((other) => other.region === item.region).length;
        const shared = item.region === 'shared';
        const x = (shared ? 236 : item.region === 'leftOnly' ? 45 : 355) + slot % (shared ? 2 : 3) * (shared ? 48 : 55);
        const y = 72 + Math.floor(slot / (shared ? 2 : 3)) * 54;
        const file = FRIENDS[item.kind].file;
        const face = file ? faceSources[file] : undefined;
        return <g key={index} transform={`translate(${x} ${y})`} data-region={item.region}>
          {file ? <image href={face} x="-22" y="-22" width="44" height="44" /> : <path d="M0-13 4-4 14-3 7 4 9 14 0 9-9 14-7 4-14-3-4-4Z" fill="#efd176" stroke="#704b36" strokeWidth="2" strokeLinejoin="round" />}
        </g>;
      })}
    </svg>
    <div className="question-venn-answer infinidrill-venn-answer">{uiText('Answer')} <span className="question-answer-line">{input || '?'}</span></div>
  </div>;
}
