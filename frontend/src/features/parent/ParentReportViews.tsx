import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useParentReport } from './parentQueries';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { ActivityProgressCard as GameCard } from '../../components/ActivityProgressCard';
import { aggregateActivityGames } from '../../lib/activityReports';
import { ChildFriendCode } from '../../components/ChildFriendCode';
import { AchievementBadgeArt } from '../achievements/AchievementBadgeArt';
import type { ChildReport } from '../../api/parentReports';
import { parentChildCalendarRoute } from '../../api/calendarParent';

export function ParentHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  useUiLanguage();
  return <div className="parent-page-heading"><div><p className="parent-eyebrow">{uiText('A view of their world')}</p><h1>{uiText(title)}</h1><p>{uiText(description)}</p></div>{action}</div>;
}
export function ParentReportStatus({ children }: { children: (report: NonNullable<ReturnType<typeof useParentReport>['data']>) => React.ReactNode }) {
  useUiLanguage();
  const query = useParentReport();
  if (query.isPending) return <div className="parent-panel parent-loading" role="status">{uiText('Gathering your family’s progress…')}</div>;
  if (query.error || !query.data) return <div className="parent-panel parent-empty"><h2>{uiText('Reports could not be loaded')}</h2><p role="alert">{query.error instanceof Error ? query.error.message : uiText('Please try again.')}</p><button className="parent-button" onClick={() => void query.refetch()}>{uiText('Try again')}</button></div>;
  return children(query.data);
}
export function ParentStat({ label, value, note }: { label: string; value: number; note?: string }) {
  useUiLanguage();
  return <div className="parent-stat"><span>{uiText(label)}</span><strong>{value.toLocaleString()}</strong>{note && <small>{uiText(note)}</small>}</div>;
}
export function ChildAvatar({ child }: { child: ChildReport }) {
  return <ProfileAvatar size="lg" profile={{ emoji: child.emoji, color: child.color, avatar_type: child.avatar_type, ...(child.avatar_url ? { avatar_url: child.avatar_url } : {}), avatar_frame: child.avatar_frame }} />;
}
export { ActivityProgressCard as GameCard } from '../../components/ActivityProgressCard';

export function ParentDashboard() {
  useUiLanguage();
  return <><ParentHeading title="Family dashboard" description="Their discoveries, practice, and little victories — together." action={<Link className="parent-button" to="/parent/children">{uiText('Manage children')} <span aria-hidden="true">↗</span></Link>} />
    <ParentReportStatus>{report => <>
      <div className="parent-stats"><ParentStat label="Children" value={report.totals.children} /><ParentStat label="Items explored" value={report.totals.exploring_completed} /><ParentStat label="Badges earned" value={report.totals.earned_badges} note="Earned across all recorded games" /><ParentStat label="Quizzes passed" value={report.totals.quiz_passes} note="Saved quiz results" /></div>
      <section className="parent-panel"><div className="parent-section-heading"><h2>{uiText('Each child, their own journey')}</h2><span>{uiText('Open a report for the full picture')}</span></div>
        {!report.children.length ? <div className="parent-empty"><p>{uiText('Add your first child to begin their learning journey.')}</p><Link className="parent-button" to="/parent/children">{uiText('Add Child')}</Link></div> : <div className="parent-child-list">{report.children.map(child => <article className="parent-child-row" key={child.id}><Link className="parent-child-summary" to={`/parent/children/${encodeURIComponent(child.id)}`}><ChildAvatar child={child} /><div><strong>{child.name}</strong><span>{child.exploring_completed} {uiText('items explored')} · {child.earned_badges} {uiText('badges earned')}</span></div></Link><ChildFriendCode name={child.name} code={child.public_id} /><Link className="parent-child-link" to={`/parent/children/${encodeURIComponent(child.id)}`}>{uiText('View report')} <span aria-hidden="true">↗</span></Link></article>)}</div>}
      </section>
      <section><div className="parent-section-heading"><div><h2>{uiText('Across their activities')}</h2><p>{uiText('Family totals from saved progress. Expedition figures cover each child’s current run.')}</p></div><Link to="/parent/achievements">{uiText('View achievements')} ↗</Link></div>
        <div className="parent-game-grid">{aggregateActivityGames(report.children).map(game => <GameCard key={game.id} game={{ ...game, metrics: game.metrics.slice(0, 1) }} family/>)}</div>
      </section>
      <p className="parent-report-note">{uiText('Reports show saved progress. Cooking and Burger reports are not available yet.')}</p>
    </>}</ParentReportStatus></>;
}

export function ParentChildReport() {
  const language = useUiLanguage();
  const { profileId } = useParams();
  return <ParentReportStatus>{report => {
    const child = report.children.find(child => child.id === profileId);
    if (!child) return <div className="parent-panel parent-empty"><h1>{uiText('Child profile not found')}</h1><Link to="/parent/children">{uiText('Back to children')}</Link></div>;
    return <><Link className="parent-back" to="/parent/children">← {uiText('Children')}</Link><div className="parent-child-heading"><ChildAvatar child={child} /><div><p className="parent-eyebrow">{uiText('Child report')}</p><h1>{child.name}</h1><p>{uiText('A closer look at their saved progress.')}</p></div><Link className="parent-button parent-button-quiet" to={parentChildCalendarRoute(child.id)}>{uiText('View calendar')}</Link><Link className="parent-button parent-button-quiet" to={`/parent/achievements?child=${encodeURIComponent(child.id)}`}>{uiText('View achievements')}</Link></div>
      <div className="parent-stats"><ParentStat label="Items explored" value={child.exploring_completed} /><ParentStat label="Badges earned" value={child.earned_badges} /><ParentStat label="Quiz attempts" value={child.quiz_attempts} /><ParentStat label="Quizzes passed" value={child.quiz_passes} /></div>
      <section><div className="parent-section-heading"><h2>{uiText('Game by game')}</h2></div><div className="parent-game-grid">{child.games.map(game => <GameCard key={game.id} game={game} />)}</div></section>
      <section className="parent-panel"><h2>{uiText('Recent exploring')}</h2>{child.latest_items.length ? <ul className="parent-recent-items">{child.latest_items.map(item => <li key={item.item_id}><Link to={`/parent/lists/exploring/${encodeURIComponent(item.item_id)}`}>{item.title}</Link><span>{uiText(item.category)} · {new Date(item.completed_at).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-GB')}</span></li>)}</ul> : <p className="parent-report-note">{uiText('No completed lessons recorded yet.')}</p>}</section>
      <p className="parent-report-note">{uiText('Exploring badges')}: {child.exploring_badges}. {uiText('Based on saved learning and game progress.')}</p>
    </>;
  }}</ParentReportStatus>;
}

export function ParentAchievements() {
  useUiLanguage();
  const [params, setParams] = useSearchParams();
  return <><ParentHeading title="Achievement collection" description="Celebrate earned badges, and see what they can discover next." /><ParentReportStatus>{report => {
    const selection = params.get('child') ?? '';
    const children = report.children.filter(child => !selection || child.id === selection);
    return <><label className="parent-filter">{uiText('Child')}<select aria-label={uiText('Child')} value={selection} onChange={event => setParams(event.target.value ? { child: event.target.value } : {})}><option value="">{uiText('All children')}</option>{report.children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}</select></label>
      {!children.length && <div className="parent-panel parent-empty"><p>{uiText('No child reports to show.')}</p><Link to="/parent/children">{uiText('Manage children')}</Link></div>}
      {children.map(child => <section className="parent-panel" key={child.id}><div className="parent-section-heading"><h2>{child.name}</h2><span>{child.earned_badges} {uiText('badges earned')}</span></div><p>{uiText('Exploring badges')}: <strong>{child.exploring_badges}</strong></p>
        {child.games.filter(game => game.achievements.length).map(game => <section className="parent-badge-group" key={game.id}><h3>{uiText(game.name)}</h3>{game.earning === 'catalog-only' && <p className="parent-catalog-note">{uiText('Catalog only — not earnable yet')}</p>}<div className="parent-badge-grid">{game.achievements.map(badge => <article className={`parent-badge ${badge.earned ? 'is-earned' : 'is-locked'}`} key={badge.id}><AchievementBadgeArt source={badge.badge} index={badge.badgeIndex ?? 0} columns={badge.badgeColumns ?? 1} rows={badge.badgeRows ?? 1} /><div><h4>{uiText(badge.name)}</h4><span>{uiText(badge.difficulty)} · {game.earning === 'catalog-only' ? uiText('Catalog only') : badge.earned ? uiText('Earned') : uiText('Not earned yet')}</span><p>{uiText(badge.description)}</p>{badge.current !== undefined && <p>{badge.current}/{badge.target}</p>}</div></article>)}</div></section>)}
      </section>)}</>;
    }}</ParentReportStatus></>;
}
