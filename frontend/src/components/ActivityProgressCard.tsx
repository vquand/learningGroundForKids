import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiText } from '../i18n/uiText';
import { ActivityIcon } from './ActivityIcon';
import type { GameReport } from '../api/parentReports';
import './activityProgressCard.css';

export function ActivityProgressCard({ game, family = false }: { game: GameReport; family?: boolean }) {
  useUiLanguage();
  const scopes = { lifetime: 'Recorded totals', 'current-expedition': 'Current expedition', 'current-town': 'Current town', 'recorded-study': 'Recorded study', unavailable: 'Progress not recorded yet' };
  return <article className="parent-game-card activity-progress-card" data-game={game.id}>
    <div className="parent-game-heading"><span aria-hidden="true" className="parent-game-icon"><ActivityIcon activity={game.id}/></span><div><h3>{uiText(game.name)}</h3><span>{uiText(game.scope !== 'unavailable' && !game.recorded ? 'No saved progress yet' : scopes[game.scope])}</span></div></div>
    <dl>{game.metrics.map(metric => <div key={metric.key}><dt>{uiText(metric.label)}</dt><dd>{metric.value === null ? '—' : metric.value.toLocaleString()}</dd></div>)}</dl>
    {game.earning === 'catalog-only' ? <p className="parent-catalog-note">{uiText('Badge designs are available; these badges are not earnable yet.')}</p> : game.achievements.length > 0 ? <p className="parent-game-footer">{game.achievements.filter(badge => badge.earned).length}{!family && <> / {game.achievements.length}</>} {uiText(family ? 'badges earned across children' : 'badges earned')}</p> : game.id === 'flashcards' ? <p className="parent-game-footer">{uiText('Study records, not a graded mastery score.')}</p> : null}
  </article>;
}
