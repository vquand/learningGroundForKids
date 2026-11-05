import { RacingAchievements } from '../features/animal-racing/RacingAchievements';
import { useUiLanguage } from '../hooks/useUiLanguage';
import { KidBackButton } from '../components/KidBackButton';
import { uiText } from '../i18n/uiText';
import { TownAchievements } from '../features/town-building/TownAchievements';
import { InfinidrillAchievements } from "../features/infinidrill/InfinidrillAchievements";
import { UfoAchievements } from '../features/ufo/UfoAchievements';
import { MathWallBadges } from '../features/math-quiz-wall/MathWallBadges';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchBadges } from '../api/profiles';
import type { BadgeInfo } from '../types/profile';
import { AppShell } from '../components/Layout/AppShell';
import { familyQueryKey, familyScopedQuery } from '../lib/familyQueries';
import { useFamilyStore } from '../stores/familyStore';
import { BadgeCard, BadgeCollection } from '../features/achievements/BadgeCollection';
import { CabbageRollAchievements } from '../features/cooking/cabbage-rolls/CabbageRollAchievements';
import { fetchProfileAchievementGroups } from '../api/achievementCatalog';
import { AchievementBadgeArt } from '../features/achievements/AchievementBadgeArt';

function FishingAchievements({ profileId }: { profileId: string }) {
  const familyId = useFamilyStore(state => state.familyId);
  const query = useQuery({
    queryKey: familyQueryKey('profile-achievement-groups', familyId, profileId),
    queryFn: familyScopedQuery(familyId, () => fetchProfileAchievementGroups(profileId)),
    enabled: Boolean(familyId),
  });
  const group = query.data?.find(value => value.id === 'fishing');
  return <section id="fishing" className="mb-8" aria-labelledby="fishing-badges-title">
    <h2 id="fishing-badges-title" className="mb-3 text-lg font-bold text-gray-800">{uiText('Fishing Friends')}</h2>
    {query.isPending ? <p role="status">{uiText('Loading fishing badges…')}</p>
      : query.isError || !group ? <p role="alert">{uiText('Unable to load fishing badges.')}</p>
        : <BadgeCollection>{group.achievements.map(badge => <BadgeCard
          key={badge.id}
          art={<AchievementBadgeArt source={badge.badge} index={badge.badgeIndex ?? 0} columns={badge.badgeColumns ?? 1} rows={badge.badgeRows ?? 1} />}
          name={uiText(badge.name)} difficulty={uiText(badge.difficulty)} description={uiText(badge.description)} earned={badge.earned}
          status={group.earning === 'catalog-only' ? uiText('Not yet earnable') : badge.earned ? uiText('Earned') : uiText('Locked')}
        />)}</BadgeCollection>}
  </section>;
}

const BADGE_TYPE_EMOJI: Record<string, string> = {
  global: '🌍',
  food: '🍳',
  monument: '🏛️',
  landmark: '📍',
  music: '🎵',
  movie: '🎬',
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sectionTitle(badgeType: string): string {
  if (badgeType === 'global') return 'Explorer Badges';
  return `${capitalize(badgeType)} Badges`;
}

const WISDOM_BADGE_EMOJIS: Record<string, string> = {
  quiz_first: '🎯',
  quiz_explorer: '📚',
  quiz_master: '🏆',
  quiz_daily_scholar: '🌟',
};

const ALL_WISDOM_BADGES = [
  { key: 'quiz_first', name: 'First Quiz 🎯', description: 'Passed your very first quiz!', milestone: 1 },
  { key: 'quiz_explorer', name: 'Quiz Explorer 📚', description: 'Passed 5 quizzes!', milestone: 5 },
  { key: 'quiz_master', name: 'Quiz Master 🏆', description: 'Passed 50 quizzes — true wisdom!', milestone: 50 },
  { key: 'quiz_daily_scholar', name: 'Daily Scholar 🌟', description: 'Completed 5 daily quizzes!', milestone: 5 },
];

function groupByType(badges: BadgeInfo[]): Map<string, BadgeInfo[]> {
  const grouped = new Map<string, BadgeInfo[]>();
  // Global first
  for (const badge of badges) {
    if (badge.badge_type === 'global') {
      if (!grouped.has('global')) grouped.set('global', []);
      grouped.get('global')!.push(badge);
    }
  }
  // Then category groups (excluding wisdom)
  for (const badge of badges) {
    if (badge.badge_type !== 'global' && badge.badge_type !== 'wisdom') {
      if (!grouped.has(badge.badge_type)) grouped.set(badge.badge_type, []);
      grouped.get(badge.badge_type)!.push(badge);
    }
  }
  return grouped;
}

export function BadgeDisplayPage() {
  useUiLanguage();
  const { profileId } = useParams<{ profileId: string }>();
  const familyId = useFamilyStore((state) => state.familyId);

  const { data: badges = [], isLoading } = useQuery({
    queryKey: familyQueryKey('badges', familyId, profileId),
    queryFn: familyScopedQuery(familyId, () => fetchBadges(profileId!)),
    enabled: Boolean(familyId && profileId),
  });

  const explorationBadges = badges.filter(b => b.badge_type !== 'wisdom');
  const wisdomBadges = badges.filter(b => b.badge_type === 'wisdom');
  const grouped = groupByType(explorationBadges);

  return (
    <AppShell>
      <div className="h-full overflow-y-auto bg-white">
        {/* Header */}
        <div className="kid-nav sticky top-0 bg-white border-b border-gray-100 flex z-10">
          <KidBackButton/>
          <h1 className="text-xl font-bold text-gray-800">{uiText("My Badges")}</h1>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
          {profileId && <UfoAchievements profileId={profileId} />}
          {profileId && <MathWallBadges profileId={profileId} />}
          {profileId && <InfinidrillAchievements profileId={profileId} />}
          {profileId && <TownAchievements profileId={profileId} />}
          {profileId && <CabbageRollAchievements profileId={profileId} />}
          {profileId && <RacingAchievements profileId={profileId} />}
          {profileId && <FishingAchievements profileId={profileId} />}
          {isLoading && (
            <div className="flex items-center justify-center h-32">
              <p className="text-gray-500 text-lg">{uiText("Loading badges...")}</p>
            </div>
          )}

          {!isLoading && badges.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <span className="text-7xl mb-4">🗺️</span>
              <h2 className="text-xl font-bold text-gray-700 mb-2">{uiText("No badges yet!")}</h2>
              <p className="text-gray-500">{uiText("Keep exploring to earn badges!")}</p>
            </div>
          )}

          {!isLoading && badges.length > 0 && (
            <div className="pt-4">
              {Array.from(grouped.entries()).map(([badgeType, typeBadges]) => (
                <div key={badgeType} className="mb-6">
                  <h2 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span>{BADGE_TYPE_EMOJI[badgeType] ?? '🏆'}</span>
                    <span>{sectionTitle(badgeType)}</span>
                  </h2>
                  <BadgeCollection>
                    {typeBadges.map((badge) => (
                      <BadgeCard
                        key={badge.id}
                        art={<span className="text-6xl">{BADGE_TYPE_EMOJI[badge.badge_type] ?? '🏆'}</span>}
                        name={uiText(badge.name)} description={uiText(badge.description)} earned
                        status={<>{badge.milestone} {uiText("items")}</>}
                      />
                    ))}
                  </BadgeCollection>
                </div>
              ))}

              {/* Wisdom Section */}
              <div className="mb-6 mt-2">
                <h2 className="text-lg font-bold text-violet-700 mb-3 flex items-center gap-2">
                  <span>🧠</span>
                  <span>{uiText("Wisdom")}</span>
                </h2>
                <BadgeCollection>
                  {ALL_WISDOM_BADGES.map((def) => {
                    const earned = wisdomBadges.find(b => b.badge_key === def.key);
                    return (
                      <BadgeCard
                        key={def.key}
                        art={<span className="text-6xl">{WISDOM_BADGE_EMOJIS[def.key] ?? '🏆'}</span>}
                        name={uiText(def.name)} description={uiText(def.description)} earned={!!earned}
                        status={<>{def.milestone} {def.key === 'quiz_daily_scholar' ? 'daily' : 'quizzes'}</>}
                      />
                    );
                  })}
                </BadgeCollection>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
