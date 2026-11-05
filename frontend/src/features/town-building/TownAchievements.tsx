import {WOMENS_DAY_ACHIEVEMENTS,WOMENS_DAY_GROUP_ID} from '../../../../server/src/town-building/events/womensDayAchievements';
import {womensDayProgress} from '../../../../server/src/town-building/events/womensDayProgress';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useQuery } from '@tanstack/react-query';
import { fetchTown } from '../../api/town';
import { useFamilyStore } from '../../stores/familyStore';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { HALLOWEEN_ACHIEVEMENTS } from '../../../../server/src/town-building/events/halloweenAchievements';
import { halloweenProgress } from '../../../../server/src/town-building/events/halloweenProgress';
import { uiMessage } from '../../i18n/uiText';
import { AchievementBadgeArt } from '../achievements/AchievementBadgeArt';
import { TownBadgeArt } from './TownArt';
import { BadgeCard, BadgeCollection } from '../achievements/BadgeCollection';
export function TownAchievements({ profileId }: {
    profileId: string;
}) {
  useUiLanguage();
    const family = useFamilyStore(s => s.familyId);
    const query = useQuery({ queryKey: familyQueryKey('town', family, profileId), queryFn: familyScopedQuery(family, () => fetchTown(profileId)), enabled: !!family, retry: false });
    const halloween=halloweenProgress(query.data),womensDay=womensDayProgress(query.data);
    return <><section id="town-building" className="mb-8"><h2 className="font-bold text-lg">{uiText("Town Building · Little Town")}</h2>{query.isError ? <p role="alert">{uiText("Town keepsakes could not be loaded.")}</p> : !query.data ? <p role="status">{uiText("Loading town keepsakes…")}</p> : <BadgeCollection>{query.data.badges.map((b, index) => <BadgeCard key={b.id}
      art={<TownBadgeArt index={index} style={{ width: 96, height: 96 }} />}
      name={uiText(b.name)} difficulty={uiText(b.difficulty)} description={uiText(b.description)} earned={!!query.data!.earned[b.id]}
      status={query.data!.earned[b.id] ? uiText("Earned") : uiText("Locked")}
    />)}</BadgeCollection>}</section>
    {query.data&&<section id="halloween" className="mb-8" aria-label={uiText('Halloween')}><h2 className="font-bold text-lg">{uiText('Halloween')}</h2>
      <p className="my-2 text-sm">{uiMessage('Halloween lanterns created: {count}',{count:halloween.total})}</p>
      {halloween.records.map(record=><p key={record.year} className="text-sm">{uiMessage('{year}: {count} lanterns created',record)}</p>)}
      <BadgeCollection>{HALLOWEEN_ACHIEVEMENTS.map(badge=><BadgeCard key={badge.id}
        art={<AchievementBadgeArt source={badge.badge} index={0} columns={1} rows={1}/>}
        name={uiText(badge.name)} description={uiText(badge.description)} difficulty={uiText(badge.difficulty)} earned={!!query.data!.earned[badge.id]}
        status={query.data!.earned[badge.id]?uiText('Earned'):uiMessage('{count}/{target} lanterns in one Halloween',{count:Math.min(badge.target,halloween.best),target:badge.target})}
      />)}</BadgeCollection>
    </section>}
    {query.data&&<section id={WOMENS_DAY_GROUP_ID} className="mb-8" aria-label="20/10/2026"><h2 className="font-bold text-lg">20/10/2026</h2>
      <BadgeCollection>{WOMENS_DAY_ACHIEVEMENTS.map(badge=><BadgeCard key={badge.id}
        art={<AchievementBadgeArt source={badge.badge} index={badge.badgeIndex!} columns={2} rows={2}/>}
        name={uiText(badge.name)} description={uiText(badge.description)} difficulty={uiText(badge.difficulty)} earned={!!query.data!.earned[badge.id]}
        status={query.data!.earned[badge.id]?uiText('Earned'):uiMessage('{count}/{target}',{count:Math.min(badge.target,womensDay.metrics[badge.metric as keyof typeof womensDay.metrics]??0),target:badge.target})}
      />)}</BadgeCollection>
    </section>}</>;
}
