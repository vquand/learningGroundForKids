import { useQuery } from '@tanstack/react-query';
import { fetchProfileAchievementGroups } from '../../api/achievementCatalog';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { useFamilyStore } from '../../stores/familyStore';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { BadgeCollection, BadgeCard } from '../achievements/BadgeCollection';
import { AchievementBadgeArt } from '../achievements/AchievementBadgeArt';
export function RacingAchievements({profileId}:{profileId:string}) {
  useUiLanguage();const familyId=useFamilyStore(s=>s.familyId);
  const query=useQuery({queryKey:familyQueryKey('profile-achievement-groups',familyId,profileId),queryFn:familyScopedQuery(familyId,()=>fetchProfileAchievementGroups(profileId)),enabled:Boolean(familyId)});
  const group=query.data?.find(g=>g.id==='road-racing');
  return <section id="road-racing" className="mb-8"><h2 className="mb-3 text-lg font-bold">{uiText('Road Racing')}</h2>
    {query.isPending?<p role="status">{uiText('Loading badges...')}</p>:!group?<p role="alert">{uiText('Could not load badges. Please try again.')}</p>:<BadgeCollection>{group.achievements.map(badge=><BadgeCard key={badge.id}
      art={<AchievementBadgeArt source={badge.badge} index={badge.badgeIndex!} columns={badge.badgeColumns??1} rows={badge.badgeRows??1}/>} name={uiText(badge.name)} description={uiText(badge.description)} difficulty={uiText(badge.difficulty)} earned={badge.earned}
      status={<>{uiText(badge.earned?'Earned':'Not yet earned')} · {badge.current??0}/{badge.target}</>}/>)}</BadgeCollection>}
  </section>;
}
