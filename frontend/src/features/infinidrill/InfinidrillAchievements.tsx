import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useQuery } from '@tanstack/react-query';
import { getInfinidrill } from '../../api/infinidrill';
import { useFamilyStore } from '../../stores/familyStore';
import { AchievementBadgeArt } from '../achievements/AchievementBadgeArt';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { BadgeCard, BadgeCollection } from '../achievements/BadgeCollection';
export function InfinidrillAchievements({ profileId }: { profileId: string }) {
  useUiLanguage();
  const familyId = useFamilyStore(s => s.familyId);
  const { data, isPending, isError } = useQuery({ queryKey: familyQueryKey('infinidrill-badges', familyId, profileId), queryFn: familyScopedQuery(familyId, () => getInfinidrill(profileId)), enabled: !!familyId });
  return <section className="mb-8" aria-labelledby="infinidrill-badges-title">
    <h2 id="infinidrill-badges-title" className="mb-3 text-lg font-bold text-gray-800">{uiText("Infinidrill · Earth Expedition")}</h2>
    {isPending ? <p role="status">{uiText("Loading drill badges…")}</p> : isError ? <p role="alert">{uiText("Unable to load drill badges.")}</p> : <BadgeCollection>{data.achievements.map((a, index) => <BadgeCard key={a.id}
      art={<AchievementBadgeArt source={a.badge} index={index} columns={5} rows={2} />}
      name={uiText(a.name)} difficulty={uiText(a.difficulty)} description={uiText(a.description)} earned={!!a.earnedAt}
      status={a.earnedAt ? <>{uiText('Earned')}<br />{new Date(a.earnedAt).toLocaleDateString()}</> : uiText("Locked")}
    />)}</BadgeCollection>}
  </section>;
}
