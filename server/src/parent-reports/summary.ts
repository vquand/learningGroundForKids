import { dailyMetrics } from '../daily-quiz/game.ts';
import { cabbageRollAchievements, cabbageRollAchievementMetrics } from '../town-building/cabbage-roll-achievements.ts';
import { ROAD_ACHIEVEMENTS } from '../road-racing/achievements.ts';
import { ANIMALS as RACING_ANIMALS } from '../road-racing/questions.ts';
import {womensDayProgress} from '../town-building/events/womensDayProgress.ts';
import {WOMENS_DAY_GROUP_ID} from '../town-building/events/womensDayAchievements.ts';
import { xmasProgress } from '../town-building/events/xmasProgress.ts';
import { XMAS_GROUP_ID } from '../town-building/events/xmasAchievements.ts';
import { ACHIEVEMENT_GROUPS, type AchievementGroup } from '../achievement-catalog.ts';
import { countDerivedBadges } from '../badges.ts';
import { businessFor } from '../town-building/civCatalog.ts';
import { BLUEPRINTS } from '../town-building/game.ts';
import { halloweenProgress } from '../town-building/events/halloweenProgress.ts';
import { fishingAchievementMetrics } from '../fishing/achievements.ts';
import {lakeMetrics,LAKE_GROUP_ID} from '../town-building/maps/lake/achievements.ts';
import type {LakeState} from '../town-building/maps/lake/types.ts';
import type { ChildReport, GameReport, ParentReport, ReportMetric } from './contracts.js';

export interface ReportRow {
  id: string; name: string; emoji: string; color: string;
  avatar_type?: string | null; avatar_url?: string | null; avatar_frame?: string | null; public_id?: string | null;
  exploring_completed?: number; category_counts?: number[]; item_passes?: number; daily_passes?: number;
  quiz_attempts?: number; quiz_passes?: number; study_sessions?: number; cards_reviewed?: number;
  drink_completions?: number; last_activity_at?: Date | string | null;
  latest_items?: unknown;
  daily_quiz?: unknown; cabbage_rolls?: unknown; road_racing?: unknown; ufo?: unknown; math_wall?: unknown; infinidrill?: unknown; miniku?: unknown; fishing?: unknown; town?: unknown;
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function count(value: unknown): number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0; }
function path(value: unknown, keys: string): unknown { return keys.split('.').reduce<unknown>((current, key) => object(current)[key], value); }
function date(value: unknown): string | null {
  if (!(value instanceof Date) && typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}
const metric = (key: string, label: string, value: unknown): ReportMetric => ({ key, label, value: count(value) });
function game(group: AchievementGroup, scope: GameReport['scope'], recorded: boolean, metrics: ReportMetric[],
  earned: unknown = {}, graded: Record<string, number> = {}): GameReport {
  return { id: group.id, name: group.name, scope, recorded, metrics, earning: group.earning,
    achievements: group.achievements.map(definition => {
      const earnedAt = date(object(earned)[definition.awardId ?? definition.id]);
      const unlocked = group.earning === 'server-verified'
        && (earnedAt !== null || (graded[definition.metric] ?? 0) >= definition.target);
      return { ...definition, earned: unlocked, earned_at: unlocked ? earnedAt : null };
    }),
  };
}
function group(id: string) { return ACHIEVEMENT_GROUPS.find(group => group.id === id)!; }

export function summarizeChild(row: ReportRow): ChildReport {
  const ufo = object(row.ufo), wordStats = object(ufo.stats);
  const wall = object(row.math_wall), wallStats = object(wall.stats);
  const drill = object(row.infinidrill), expedition = object(drill.game);
  const miniku = object(row.miniku), sizes = object(miniku.completedBySize);
  const fishing = object(row.fishing), fishingStats = object(fishing.stats);
  const fishingMetrics = fishingAchievementMetrics(fishing);
  const town = object(row.town);
  const lake=object(object(town.maps).lake);
  const lakeState=Array.isArray(lake.settled)&&Array.isArray(lake.built)?lake as unknown as LakeState:undefined;
  const lakeProgress=lakeMetrics(lakeState);
  const halloween=halloweenProgress(town),womensDay=womensDayProgress(town),xmas=xmasProgress(town);
  const entities = Array.isArray(town.entities) ? town.entities : [];
  const roads = entities.filter(entity => BLUEPRINTS.some(blueprint => blueprint.id === object(entity).blueprintId && blueprint.kind === 'road')).length;
  const structures = entities.filter(entity => BLUEPRINTS.some(blueprint => blueprint.id === object(entity).blueprintId && (blueprint.kind === 'building'||blueprint.kind==='tree'))).length;
  const ufoMetrics: Record<string, number> = {};
  for (const definition of group('shoo-shoo-ufo').achievements) ufoMetrics[definition.metric] = count(path(wordStats, definition.metric));
  ufoMetrics['friends.each'] = Math.min(...['cow', 'highland', 'sheep', 'capybara'].map(animal => count(path(wordStats, `friends.${animal}`))));
  const wallMetrics = Object.fromEntries(['passed', 'medium', 'hard', 'streak'].map(key => [key, count(wallStats[key])]));
  const racing = object(row.road_racing), raceStats = object(racing.stats);
  const cabbage = cabbageRollAchievements(row.cabbage_rolls), cabbageMetrics = cabbageRollAchievementMetrics(cabbage);
  const cabbageGame = game(group('cabbage-rolls'), 'lifetime', row.cabbage_rolls != null,
    [metric('completed','Cabbage roll batches served',cabbage.completed),metric('undercooked','Undercooked batches',cabbage.undercooked),
      metric('burnt','Burnt batches',cabbage.burnt),metric('perfect','Perfect batches',cabbage.perfect)], cabbage.earned, cabbageMetrics);
  cabbageGame.achievements = cabbageGame.achievements.map(badge=>({...badge,current:cabbageMetrics[badge.metric as keyof typeof cabbageMetrics] ?? 0}));
  const daily = object(row.daily_quiz), dailyStats = object(daily.stats);
  const dailyProgress = { stats: { completed: count(dailyStats.completed), bestWeekStreak: count(dailyStats.bestWeekStreak), perfectWeeks: count(dailyStats.perfectWeeks), hardMath: count(dailyStats.hardMath) }, categories: Object.fromEntries(Object.entries(object(daily.categories)).map(([key,value]) => [key,count(value)])) };
  const dailyValues = dailyMetrics(dailyProgress);
  const dailyGame = game(group('daily-quiz'), 'lifetime', row.daily_quiz != null,
    [metric('completed', 'Daily quizzes completed', dailyStats.completed), metric('bestWeekStreak', 'Best weekly streak', dailyStats.bestWeekStreak), metric('hardMath', 'Hard math questions answered correctly', dailyStats.hardMath)], daily.earned, dailyValues);
  dailyGame.achievements = dailyGame.achievements.map(badge => ({ ...badge, current: dailyValues[badge.metric] ?? 0 }));
  const games: GameReport[] = [
    dailyGame,

    game(group(LAKE_GROUP_ID),'lifetime',!!lakeState,
      [metric('harvested','Nursery fish harvested',lake.harvested),metric('species','Lake fish types settled',lakeProgress.lakeSpecies),metric('collections','Lake growth collections',lake.collections),metric('stage','Lake development stage',lake.stage)],lake.earned,lakeProgress),
    cabbageGame,
    game(group('road-racing'), 'lifetime', row.road_racing != null,
      [metric('finished','Races finished',raceStats.finished),metric('wins','Races won',raceStats.wins),metric('podiums','Podium finishes',raceStats.podiums),metric('bestStreak','Best winning streak',raceStats.bestStreak),metric('slowed','Races finished after a slowdown',raceStats.slowed),metric('snailPodiums','Top-three races with two slowdowns',raceStats.snailPodiums)],racing.earned),
    { id: 'exploring', name: 'Exploring', scope: 'lifetime', recorded: count(row.exploring_completed) > 0, earning: 'server-verified', achievements: [],
      metrics: [metric('completed', 'Items explored', row.exploring_completed), metric('attempts', 'Quiz attempts', row.quiz_attempts), metric('passes', 'Quizzes passed', row.quiz_passes)] },
    { id: 'flashcards', name: 'Flashcards', scope: 'recorded-study', recorded: count(row.study_sessions) > 0, earning: 'none', achievements: [],
      metrics: [metric('sessions', 'Study sessions', row.study_sessions), metric('cards', 'Cards reviewed', row.cards_reviewed)] },
    game(group('shoo-shoo-ufo'), 'lifetime', row.ufo != null,
      [metric('words', 'Words solved', wordStats.solved), metric('medium', 'Medium words', wordStats.medium), metric('hard', 'Hard words', wordStats.hard)], {}, ufoMetrics),
    game(group('waddle-wall'), 'lifetime', row.math_wall != null,
      [metric('walls', 'Walls passed', wallStats.passed), metric('best', 'Best score', wall.best), metric('streak', 'Best streak', wallStats.streak)], {}, wallMetrics),
    game(group('infinidrill-earth'), 'current-expedition', drill.game != null,
      [metric('questions', 'Math puzzles solved', expedition.mainQuestionsCompleted), metric('depth', 'Depth in metres', expedition.depthMetres), metric('parts', 'Upgrade parts owned', Array.isArray(expedition.ownedUpgradeIds) ? expedition.ownedUpgradeIds.length : 0)], drill.earned),
    game(group('miniku'), 'lifetime', row.miniku != null,
      [metric('boards', 'Boards completed', miniku.completed), metric('3', '3 × 3 boards', sizes['3']), metric('4', '4 × 4 boards', sizes['4']), metric('5', '5 × 5 boards', sizes['5'])], miniku.earned),
    game(group('fishing'), 'lifetime', row.fishing != null,
      [metric('caught', 'Fish caught', fishingStats.caught), metric('questions', 'Bait questions solved', fishingStats.questions),
        metric('casts', 'Fishing casts', fishingStats.casts), metric('pondPoints', 'Pond fishing points', fishingMetrics.fishingPondPoints),
        metric('riverPoints', 'River fishing points', fishingMetrics.fishingRiverPoints), metric('pondSpecies', 'Pond catches discovered', fishingMetrics.fishingPondSpecies),
        metric('riverSpecies', 'River catches discovered', fishingMetrics.fishingRiverSpecies), metric('baits', 'Bait types earned', fishingMetrics.fishingBaits),
        metric('friends', 'Fishing friends with catches', fishingMetrics.fishingFriends)], fishing.earned, fishingMetrics),
    game(group('town-building'), 'current-town', row.town != null,
      [metric('structures', 'Buildings and trees', structures), metric('roads', 'Road tiles', roads),metric('patches','Vegetable patches',entities.filter(e=>object(e).blueprintId==='vegetable-patch').length),metric('harvests','Vegetables harvested',object(town.gardening).harvests),
        metric('neighbors','Neighbors moved in',entities.reduce((sum:number,e)=>sum+(object(object(e).civ).phase==='ready'?(businessFor(String(object(e).blueprintId))?.workers.length??0):0),0)),
        metric('helpedTypes','Kinds of neighbor helped',new Set((Array.isArray(object(town.civ).helpedTypes)?object(town.civ).helpedTypes as unknown[]:[]).filter(id=>typeof id==='string'&&businessFor(id))).size),
        ...['stamina', 'wood', 'rock', 'sand', 'metal', 'wool'].map(key => metric(key, key, key==='wool'?object(town.storage).wool:object(town.materials)[key]))], town.earned),
    game(group('halloween'),'lifetime',halloween.records.length>0,[metric('lanterns','Halloween lanterns created',halloween.total),metric('bestHalloween','Most lanterns in one Halloween',halloween.best)],town.earned),
    game(group(WOMENS_DAY_GROUP_ID),'lifetime',womensDay.visits>0,[metric('visit','Celebration attended',womensDay.visits),metric('greeted','Different flower friends greeted',womensDay.greeted)],town.earned,womensDay.metrics),
    game(group(XMAS_GROUP_ID),'lifetime',xmas.total>0,[
      metric('sculptures','Snow sculptures built',xmas.total),
      metric('distinctTypes','Different sculpture types built',xmas.distinctTypes),
      metric('maxSimultaneous','Most sculptures at once',xmas.maxSimultaneous),
      metric('snowmen','Snowmen built',xmas.snowmen),
      metric('rabbits','Snow rabbits built',xmas.rabbits),
      metric('owls','Snow owls built',xmas.owls),
      metric('penguins','Snow penguins built',xmas.penguins),
    ],town.earned,xmas.metrics),
    game(group('food-and-drink'), 'lifetime', count(row.drink_completions) > 0, [metric('drinks', 'Drinks completed', row.drink_completions)]),
    // New catalog-only games must appear in both parent and admin child reports.
    // Food and Drink already has its recorded drink counter above.
    ...ACHIEVEMENT_GROUPS.filter(group => group.earning === 'catalog-only' && group.id !== 'food-and-drink')
      .map(group => game(group, 'unavailable', false, [{ key: 'completed', label: 'Completed', value: null }])),
  ];
  const racingGroup = games.find(value => value.id === 'road-racing')!;
  const lakeGroup=games.find(value=>value.id===LAKE_GROUP_ID)!;
  lakeGroup.achievements=lakeGroup.achievements.map(badge=>({...badge,current:lakeProgress[badge.metric]??0}));
  const xmasGroup = games.find(value => value.id === XMAS_GROUP_ID)!;
  xmasGroup.achievements = xmasGroup.achievements.map(badge => ({ ...badge, current: xmas.metrics[badge.metric as keyof typeof xmas.metrics] ?? 0 }));
  racingGroup.achievements = racingGroup.achievements.map((badge, i) => {
    const key = ROAD_ACHIEVEMENTS[i]!.progressKey;
    const current = key === 'friends' ? RACING_ANIMALS.filter(animal => count(object(raceStats.friends)[animal])>0).length
      : key.startsWith('podium:') ? count(object(raceStats.animalPodiums)[key.slice(7)]) : count(raceStats[key]);
    return {...badge, current};
  });
  const exploringBadges = countDerivedBadges((row.category_counts ?? []).map(count), count(row.item_passes), count(row.daily_passes));
  return {
    id: row.id, name: row.name, emoji: row.emoji, color: row.color,
    avatar_type: row.avatar_type === 'default' || row.avatar_type === 'custom' ? row.avatar_type : 'emoji',
    avatar_url: row.avatar_url ?? null, avatar_frame: row.avatar_frame ?? null, public_id: row.public_id ?? null,
    exploring_completed: count(row.exploring_completed), exploring_badges: exploringBadges,
    quiz_attempts: count(row.quiz_attempts), quiz_passes: count(row.quiz_passes),
    earned_badges: exploringBadges + games.reduce((total, game) => total + game.achievements.filter(badge => badge.earned).length, 0),
    last_activity_at: date(row.last_activity_at),
    latest_items: (Array.isArray(row.latest_items) ? row.latest_items : []).slice(0, 8).flatMap(value => {
      const item = object(value), completedAt = date(item.completed_at);
      return typeof item.item_id === 'string' && typeof item.title === 'string' && typeof item.category === 'string' && completedAt
        ? [{ item_id: item.item_id, title: item.title, category: item.category, completed_at: completedAt }] : [];
    }), games,
  };
}

export function summarizeFamily(children: ChildReport[], now: Date): ParentReport {
  const sum = (read: (child: ChildReport) => number) => children.reduce((total, child) => total + read(child), 0);
  const value = (child: ChildReport, id: string) => child.games.find(game => game.id === id)?.metrics[0]?.value ?? 0;
  return { generated_at: now.toISOString(), children, totals: {
    children: children.length, exploring_completed: sum(child => child.exploring_completed),
    quiz_attempts: sum(child => child.quiz_attempts), quiz_passes: sum(child => child.quiz_passes),
    earned_badges: sum(child => child.earned_badges), study_sessions: sum(child => value(child, 'flashcards')),
    drink_completions: sum(child => value(child, 'food-and-drink')),
  } };
}
