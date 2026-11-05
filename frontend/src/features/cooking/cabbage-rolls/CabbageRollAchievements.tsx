import { useQuery } from '@tanstack/react-query';
import { fetchProfileAchievementGroups } from '../../../api/achievementCatalog';
import { useUiLanguage } from '../../../hooks/useUiLanguage';
import { uiText } from '../../../i18n/uiText';
import { familyQueryKey, familyScopedQuery } from '../../../lib/familyQueries';
import { useFamilyStore } from '../../../stores/familyStore';
import { AchievementBadgeArt } from '../../achievements/AchievementBadgeArt';
import { BadgeCard, BadgeCollection } from '../../achievements/BadgeCollection';

export function CabbageRollAchievements({ profileId }: { profileId: string }) {
  useUiLanguage();
  const familyId = useFamilyStore(state => state.familyId);
  const query = useQuery({
    queryKey: familyQueryKey('profile-achievement-groups', familyId, profileId),
    queryFn: familyScopedQuery(familyId, () => fetchProfileAchievementGroups(profileId)),
    enabled: Boolean(familyId),
  });
  const group = query.data?.find(value => value.id === 'cabbage-rolls');
  return <section id="cabbage-rolls" className="mb-8" aria-labelledby="cabbage-roll-badges-title">
    <h2 id="cabbage-roll-badges-title" className="mb-3 text-lg font-bold text-gray-800">{uiText('Cabbage Roll Kitchen')}</h2>
    {query.isPending ? <p role="status">{uiText('Loading cabbage-roll badges…')}</p>
      : query.isError || !group ? <p role="alert">{uiText('Unable to load cabbage-roll badges.')}</p>
        : <>{group.earning==='catalog-only'&&<p className="mb-3 text-sm text-gray-600">{uiText('Catalog only — not earnable yet')}</p>}<BadgeCollection>{group.achievements.map(badge => <BadgeCard
          key={badge.id}
          art={<AchievementBadgeArt source={badge.badge} index={badge.badgeIndex ?? 0} columns={badge.badgeColumns ?? 1} rows={badge.badgeRows ?? 1} />}
          name={uiText(badge.name)} difficulty={uiText(badge.difficulty)} description={uiText(badge.description)} earned={badge.earned}
          status={<>{uiText(group.earning==='catalog-only'?'Catalog only':badge.earned?'Earned':'Not yet earned')}{badge.earned && badge.earned_at && <><br />{new Date(badge.earned_at).toLocaleDateString()}</>}{badge.current !== undefined && <> · {badge.current}/{badge.target}</>}</>}
        />)}</BadgeCollection></>}
  </section>;
}
