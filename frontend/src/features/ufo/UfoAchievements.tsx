import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useQuery } from '@tanstack/react-query';
import { fetchUfo } from '../../api/ufo';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { useFamilyStore } from '../../stores/familyStore';
import { BadgeLogo } from './UfoArt';
import { BadgeCard, BadgeCollection } from '../achievements/BadgeCollection';
export function UfoAchievements({ profileId }: { profileId: string }) {
  useUiLanguage();

  const familyId = useFamilyStore(s => s.familyId);

  const { data, isLoading, error, refetch } = useQuery({ queryKey: familyQueryKey('ufo', familyId, profileId), queryFn: familyScopedQuery(familyId, () => fetchUfo(profileId)), enabled: Boolean(familyId && profileId) });

  return <section id="shoo-shoo-ufo" className="mb-8" aria-labelledby="ufo-badge-title">
    <h2 id="ufo-badge-title" className="text-xl font-bold text-slate-800">Shoo Shoo UFO</h2>
    <p className="mb-4 mt-1 text-sm text-slate-600">{uiText("Words, space trips, and animal friends. Your progress stays with you!")}</p>
    {isLoading && <p role="status">{uiText("Loading your animal adventures…")}</p>}
    {error && <div role="alert">{error.message}
      <button onClick={() => void refetch()}>{uiText("Try again")}</button>
    </div>}
    <BadgeCollection>{data?.achievements.map(a => <BadgeCard key={a.id}
      art={<BadgeLogo index={a.logo} size={96} />} name={uiText(a.name)} description={uiText(a.description)} earned={a.earned}
      status={a.earned ? uiText("★ Unlocked") : `${Math.min(a.current, a.target)} / ${a.target}`}
    />)}</BadgeCollection>
  </section>;

}
