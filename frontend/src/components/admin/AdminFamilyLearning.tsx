import type { UseQueryResult } from '@tanstack/react-query';
import type { ChildReport, ParentReport } from '../../api/parentReports';
import { aggregateActivityGames, hasRecordedLearning, latestSavedActivity } from '../../lib/activityReports';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { ActivityProgressCard } from '../ActivityProgressCard';
import { AchievementBadgeArt } from '../../features/achievements/AchievementBadgeArt';
import './adminFamilyLearning.css';

type ReportQuery = UseQueryResult<ParentReport, Error>;

export function SavedActivityTime({ at }: { at: string | null }) {
  const language = useUiLanguage();
  return <p className="admin-learning-recency">{uiText('Last saved activity')}: {at
    ? <time dateTime={at}>{new Date(at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB')}</time>
    : uiText('No saved activity yet.')}</p>;
}

export function LearningStats({ values }: { values: Array<[string, number]> }) {
  useUiLanguage();
  return <dl className="admin-learning-stats">{values.map(([label, value]) => <div key={label}><dt>{uiText(label)}</dt><dd>{value.toLocaleString()}</dd></div>)}</dl>;
}

export function AdminFamilyLearning({ query }: { query: ReportQuery }) {
  useUiLanguage();
  if (query.isPending) return <section className="admin-learning-region" role="status">{uiText('Loading learning progress…')}</section>;
  if (query.error || !query.data) return <section className="admin-learning-region" role="alert">
    <h3>{uiText('Learning report unavailable')}</h3><p>{uiText('Learning progress could not be loaded. This does not mean the family has no progress.')}</p>
    <button className="admin-learning-refresh" type="button" onClick={() => void query.refetch()}>{uiText('Retry')}</button>
  </section>;
  const report = query.data;
  return <section className="admin-learning-region" aria-label={uiText('Family learning overview')}>
    <div className="admin-learning-heading"><div><h3>{uiText('Family learning overview')}</h3><p>{uiText('Saved learning progress across every child and activity.')}</p></div>
      <button className="admin-learning-refresh" type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>{uiText('Refresh learning report')}</button></div>
    <LearningStats values={[
      ['Children with recorded learning', report.children.filter(hasRecordedLearning).length],
      ['Items explored', report.totals.exploring_completed], ['Badges earned', report.totals.earned_badges],
      ['Quiz attempts', report.totals.quiz_attempts], ['Quizzes passed', report.totals.quiz_passes], ['Study sessions', report.totals.study_sessions],
    ]}/>
    <SavedActivityTime at={latestSavedActivity(report.children)}/>
    {!report.children.length ? <p>{uiText('No child profiles to report yet.')}</p> : <details className="admin-learning-details">
      <summary>{uiText('Across their activities')}</summary>
      <p>{uiText('Family totals from saved progress. Expedition figures cover each child’s current run.')}</p>
      <div className="admin-learning-games family-games">{aggregateActivityGames(report.children).map(game => <ActivityProgressCard key={game.id} game={game} family/>)}</div>
    </details>}
  </section>;
}

export function AdminChildLearning({ child }: { child: ChildReport }) {
  useUiLanguage();
  return <section className="admin-learning-child" aria-label={uiText('Selected child learning progress')}>
    <LearningStats values={[
      ['Items explored', child.exploring_completed], ['Badges earned', child.earned_badges],
      ['Quiz attempts', child.quiz_attempts], ['Quizzes passed', child.quiz_passes],
    ]}/>
    <p>{uiText(hasRecordedLearning(child) ? 'Learning progress recorded' : 'No saved learning progress yet.')}</p>
    <SavedActivityTime at={child.last_activity_at}/>
    <h4>{uiText('Game by game')}</h4>
    <div className="admin-learning-games">{child.games.map(game => <ActivityProgressCard key={game.id} game={game}/>)}</div>
    <p className="admin-learning-recency">{uiText('Reports show saved progress. Cooking and Burger reports are not available yet.')}</p>
    <details className="admin-learning-details"><summary>{uiText('Achievement collection')}</summary>
      <p>{uiText('Exploring badges')}: {child.exploring_badges}</p>
      {child.games.filter(game => game.achievements.length).map(game => <section key={game.id} className="admin-learning-badge-group">
        <h4>{uiText(game.name)}</h4>
        {game.earning === 'catalog-only' && <p>{uiText('Catalog only — not earnable yet')}</p>}
        <div className="admin-learning-badges">{game.achievements.map(badge => <article key={badge.id} className={badge.earned ? 'is-earned' : 'is-locked'}>
          <AchievementBadgeArt className="admin-learning-badge-art" size={56} source={badge.badge} index={badge.badgeIndex ?? 0} columns={badge.badgeColumns ?? 1} rows={badge.badgeRows ?? 1}/>
          <div><strong>{uiText(badge.name)}</strong><p>{uiText(badge.difficulty)} · {game.earning === 'catalog-only' ? uiText('Catalog only') : uiText(badge.earned ? 'Earned' : 'Not earned yet')}</p><p>{uiText(badge.description)}</p>{badge.current !== undefined && <p>{badge.current}/{badge.target}</p>}</div>
        </article>)}</div>
      </section>)}
    </details>
  </section>;
}
