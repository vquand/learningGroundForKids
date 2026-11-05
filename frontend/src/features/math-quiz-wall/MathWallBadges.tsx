import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useQuery } from '@tanstack/react-query';
import { fetchMathWall, type MathAchievement, type MathLanguage } from '../../api/mathWall';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { useFamilyStore } from '../../stores/familyStore';
import { getUiLanguage } from '../../lib/uiLanguage';
import { AchievementBadgeArt } from '../achievements/AchievementBadgeArt';
import './mathWall.css';
import { BadgeCard, BadgeCollection } from '../achievements/BadgeCollection';

export function MathBadgeArt({ index, size = 95 }: { index: number; size?: number }) {
  const scientist = index === 6;
  return <AchievementBadgeArt source={scientist ? '/minigames/math-quiz-wall/math-scientist.png' : '/minigames/math-quiz-wall/badges.png'} index={scientist ? 0 : index} columns={scientist ? 1 : 3} rows={scientist ? 1 : 2} size={size} className="math-badge-art" />;
}
export function MathBadgeList({ achievements, language = getUiLanguage(), collection = false }: { achievements: MathAchievement[]; language?: MathLanguage; collection?: boolean }) {
  useUiLanguage();
  if (collection) return <BadgeCollection>{achievements.map(a => <BadgeCard key={a.id}
    art={<MathBadgeArt index={a.logo} size={96}/>}
    name={language === 'vi' ? a.nameVi : a.name} description={language === 'vi' ? a.descriptionVi : a.description} earned={a.earned}
    status={a.earned ? language === 'vi' ? '★ Đã đạt' : uiText("★ Unlocked") : `${Math.min(a.current, a.target)} / ${a.target}`}
  />)}</BadgeCollection>;
  return <div className="math-badge-grid">{achievements.map(a => <article key={a.id} className={`math-badge ${a.earned ? 'earned' : 'locked'}`}>
    <MathBadgeArt index={a.logo} />
    <h3>{language === 'vi' ? a.nameVi : a.name}</h3>
    <p>{language === 'vi' ? a.descriptionVi : a.description}</p>
    <strong>{a.earned ? language === 'vi' ? '★ Đã đạt' : uiText("★ Unlocked") : `${Math.min(a.current, a.target)} / ${a.target}`}</strong>
  </article>)}</div>;
}
export function MathWallBadges({ profileId }: { profileId: string }) {
  useUiLanguage();
  const familyId = useFamilyStore(s => s.familyId);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: familyQueryKey('math-wall', familyId, profileId), queryFn: familyScopedQuery(familyId, () => fetchMathWall(profileId)), enabled: Boolean(familyId && profileId) });
  return <section className="mb-8" aria-labelledby="math-wall-badges">
    <h2 id="math-wall-badges" className="text-xl font-bold text-slate-800">{uiText("Waddle Wall")}</h2>
    <p className="mb-4 mt-1 text-sm text-slate-600">{uiText("Little steps, clever sums, and big hearts.")}</p>
    {isLoading && <p role="status">{uiText("Loading your wall adventures…")}</p>}
    {error && <p role="alert">{error.message} <button onClick={() => void refetch()}>{uiText("Try again")}</button></p>}
    {data && <MathBadgeList achievements={data.achievements} collection />}
  </section>;
}
