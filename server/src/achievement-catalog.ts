import { DAILY_QUIZ_ACHIEVEMENTS } from './daily-quiz/achievements.ts';
import { ROAD_ACHIEVEMENTS } from './road-racing/achievements.ts';
import {WOMENS_DAY_ACHIEVEMENTS,WOMENS_DAY_GROUP_ID} from './town-building/events/womensDayAchievements.ts';
import { XMAS_ACHIEVEMENTS, XMAS_GROUP_ID } from './town-building/events/xmasAchievements.ts';
import { MINIKU_ACHIEVEMENTS } from './miniku/achievements.ts';
import { FISHING_ACHIEVEMENTS } from './fishing/achievements.ts';
import { TOWN_BADGES } from './town-building/game.ts';
import { HALLOWEEN_ACHIEVEMENTS } from './town-building/events/halloweenAchievements.ts';
import {LAKE_ACHIEVEMENTS,LAKE_GROUP_ID} from './town-building/maps/lake/achievements.ts';
/** Reviewed achievement definitions. Only server-verified game activity unlocks badges. */
export interface AchievementDefinition {
  id: string;
  /** Current in-game key for server-backed achievements whose catalog ID is namespaced. */
  awardId?: string;
  name: string;
  description: string;
  badge: string;
  badgeIndex?: number;
  badgeColumns?: number;
  badgeRows?: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  /** Server-side progress field used by the game's verified achievement rules. */
  metric: 'mainQuestionsCompleted' | 'depthMetres' | 'caveFalls' | 'bonusQuestionsCompleted' | 'ownedUpgradeCount' | 'coreReached'
    | 'solved' | 'medium' | 'hard' | 'shoo' | 'captures.cow' | 'captures.highland' | 'captures.sheep' | 'captures.capybara'
    | 'friends.cow' | 'friends.highland' | 'friends.sheep' | 'friends.capybara' | 'friends.each'
    | 'passed' | 'streak' | 'recipesCompleted' | 'distinctRecipes' | 'perfectServes' | 'drinksCompleted' | 'distinctDrinks'
    | 'burgersCompleted' | 'completeBurgers' | 'townVerified' | 'halloweenLanternsCreated'
    | 'womensDay2026Visited' | 'womensDay2026Greeted'
    | 'minikuCompleted' | 'minikuSizes' | 'minikuFiveByFive'
    | 'fishingCaught' | 'fishingPondPoints' | 'fishingRiverPoints' | 'fishingPondSpecies' | 'fishingRiverSpecies' | 'fishingBaits' | 'fishingFriends'
    | 'dailyCompleted' | 'dailyWeekStreak' | 'dailyPerfectWeeks' | 'dailyHardMath' | 'dailyCategories'
    | 'roadRacingVerified' | 'cabbageRollsCompleted' | 'cabbageRollsUndercooked' | 'cabbageRollsBurnt' | 'cabbageRollsPerfect'
    | 'xmasSculptures' | 'xmasDistinctTypes' | 'xmasSimultaneous' | 'xmasSnowmen' | 'xmasRabbits' | 'xmasOwls' | 'xmasPenguins'
    | (typeof LAKE_ACHIEVEMENTS)[number]['metric'];
  target: number;
}
export interface AchievementGroup {
  id: string;
  name: string;
  earning: 'server-verified' | 'catalog-only';
  achievements: AchievementDefinition[];
}
export interface AchievementCatalogRepository {
  list(): Promise<Array<AchievementDefinition & { groupId: string }>>;
  sync(group: AchievementGroup): Promise<void>;
}

const badge = '/minigames/infinidrill/achievement-badges.png';
export const INFINIDRILL_ACHIEVEMENT_GROUP: AchievementGroup = {
  id: 'infinidrill-earth', name: 'InfiniDrill · Earth Expedition', earning: 'server-verified',
  achievements: [
    { id: 'infinidrill-first-drill', name: 'First Dig', description: 'Answer your first main math puzzle correctly in one expedition.', badge, badgeIndex: 0, badgeColumns: 5, badgeRows: 2, difficulty: 'easy', metric: 'mainQuestionsCompleted', target: 1 },
    { id: 'infinidrill-ten-answers', name: 'Number Miner', description: 'Answer 10 main math puzzles correctly in one expedition.', badge, badgeIndex: 1, badgeColumns: 5, badgeRows: 2, difficulty: 'easy', metric: 'mainQuestionsCompleted', target: 10 },
    { id: 'infinidrill-fifty-answers', name: 'Puzzle Prospector', description: 'Answer 50 main math puzzles correctly in one expedition.', badge, badgeIndex: 2, badgeColumns: 5, badgeRows: 2, difficulty: 'hard', metric: 'mainQuestionsCompleted', target: 50 },
    { id: 'infinidrill-first-layer', name: 'Below the Surface', description: 'Reach 120 metres, the bottom of the first Earth layer, in one expedition.', badge, badgeIndex: 3, badgeColumns: 5, badgeRows: 2, difficulty: 'easy', metric: 'depthMetres', target: 120 },
    { id: 'infinidrill-deep-digger', name: 'Deep Digger', description: 'Reach 720 metres, the bottom of Earth layer 6, in one expedition.', badge, badgeIndex: 4, badgeColumns: 5, badgeRows: 2, difficulty: 'medium', metric: 'depthMetres', target: 720 },
    { id: 'infinidrill-mantle-explorer', name: 'Mantle Explorer', description: 'Reach 1,440 metres, the bottom of Earth layer 12, in one expedition.', badge, badgeIndex: 5, badgeColumns: 5, badgeRows: 2, difficulty: 'hard', metric: 'depthMetres', target: 1440 },
    { id: 'infinidrill-cave-finder', name: 'Cave Finder', description: 'Open a cave with 5 consecutive first-try main answers, each in under 15 seconds, before a layer boundary.', badge, badgeIndex: 6, badgeColumns: 5, badgeRows: 2, difficulty: 'medium', metric: 'caveFalls', target: 1 },
    { id: 'infinidrill-bonus-brave', name: 'Bonus Brave', description: 'Choose a bonus puzzle and solve it on the first try in one expedition.', badge, badgeIndex: 7, badgeColumns: 5, badgeRows: 2, difficulty: 'medium', metric: 'bonusQuestionsCompleted', target: 1 },
    { id: 'infinidrill-workshop-master', name: 'Workshop Master', description: 'Collect all 20 upgrade parts in one expedition through bonus rewards and workshop purchases.', badge, badgeIndex: 8, badgeColumns: 5, badgeRows: 2, difficulty: 'hard', metric: 'ownedUpgradeCount', target: 20 },
    { id: 'infinidrill-core-champion', name: 'Core Champion', description: 'Complete all 18 Earth layers and reach the core at 2,160 metres in one expedition.', badge, badgeIndex: 9, badgeColumns: 5, badgeRows: 2, difficulty: 'legendary', metric: 'coreReached', target: 1 },
  ],
};

/** These catalogs describe the achievements already awarded by their authoritative game reducers. */
export const UFO_ACHIEVEMENT_GROUP: AchievementGroup = {
  id: 'shoo-shoo-ufo', name: 'Shoo Shoo UFO', earning: 'server-verified',
  achievements: [
    ['first', 'First Word!', 'Solve 1 word.', 'easy', 'solved', 1],
    ['gardener', 'Word Gardener', 'Solve 25 words.', 'medium', 'solved', 25],
    ['wizard', 'Word Wizard', 'Solve 100 words.', 'hard', 'solved', 100],
    ['curious', 'Curious Mind', 'Solve 10 medium words.', 'medium', 'medium', 10],
    ['hero', 'Hard Word Hero', 'Solve 3 hard words.', 'hard', 'hard', 3],
    ['shoo', 'Shoo Shoo!', 'Use 10 UFO charges.', 'easy', 'shoo', 10],
    ['moo', 'MOO MOO NO NO', 'Take 5 space trips with the dairy cow.', 'medium', 'captures.cow', 5],
    ['fluffy', 'Fluffy Flight', 'Take 5 space trips with the Highland cow.', 'medium', 'captures.highland', 5],
    ['space-sheep', 'Sheep in Space', 'Take 5 space trips with the sheep.', 'medium', 'captures.sheep', 5],
    ['cosmic', 'Capy Cosmic Trip', 'Take 5 space trips with the capybara.', 'medium', 'captures.capybara', 5],
    ['milk', 'Milk & Letters', 'Solve 10 words with the dairy cow.', 'medium', 'friends.cow', 10],
    ['highland', 'Highland Scholar', 'Solve 10 words with the Highland cow.', 'medium', 'friends.highland', 10],
    ['woolly', 'Woolly Wordsmith', 'Solve 10 words with the sheep.', 'medium', 'friends.sheep', 10],
    ['capy', 'Capy Clever', 'Solve 10 words with the capybara.', 'medium', 'friends.capybara', 10],
    ['friends', 'Farm Friends', 'Solve 5 words with each animal.', 'hard', 'friends.each', 5],
  ].map(([key, name, description, difficulty, metric, target], badgeIndex) => ({
    id: `shoo-shoo-ufo-${String(key)}`, awardId: String(key), name: String(name), description: String(description), badge: '/minigames/ufo/badges.png', badgeIndex, badgeColumns: 5, badgeRows: 3,
    difficulty: difficulty as AchievementDefinition['difficulty'], metric: String(metric) as AchievementDefinition['metric'], target: Number(target),
  })),
};

export const WADDLE_WALL_ACHIEVEMENT_GROUP: AchievementGroup = {
  id: 'waddle-wall', name: 'Waddle Wall', earning: 'server-verified',
  achievements: [
    ['first', 'First Waddle', 'Pass your first wall.', 'easy', 'passed', 1],
    ['ten', 'Wall Wanderer', 'Pass 10 walls.', 'easy', 'passed', 10],
    ['fifty', 'Poolside Pro', 'Pass 50 walls.', 'hard', 'passed', 50],
    ['streak', 'Heart Parade', 'Pass 5 walls in a row.', 'medium', 'streak', 5],
    ['medium', 'Sunny Thinker', 'Pass 10 medium walls.', 'medium', 'medium', 10],
    ['hard', 'Orange Explorer', 'Pass 5 hard walls.', 'hard', 'hard', 5],
    ['scientist', 'Math Scientist', 'Pass 10 hard walls.', 'hard', 'hard', 10],
  ].map(([key, name, description, difficulty, metric, target], badgeIndex) => ({
    id: `waddle-wall-${String(key)}`, awardId: String(key), name: String(name), description: String(description), badge: '/minigames/math-quiz-wall/badges.png', badgeIndex, badgeColumns: 3, badgeRows: 2,
    ...(key === 'scientist' ? { badge: '/minigames/math-quiz-wall/math-scientist.png', badgeIndex: 0, badgeColumns: 1, badgeRows: 1 } : {}),
    difficulty: difficulty as AchievementDefinition['difficulty'], metric: String(metric) as AchievementDefinition['metric'], target: Number(target),
  })),
};

function catalogOnlyGroup(id: string, name: string, entries: Array<[string, string, string, AchievementDefinition['difficulty'], AchievementDefinition['metric'], number]>, atlasRow: number): AchievementGroup {
  return { id, name, earning: 'catalog-only', achievements: entries.map(([key, title, description, difficulty, metric, target], index) => ({
    id: `${id}-${key}`, name: title, description, badge: '/minigames/achievements/catalog-only.png', badgeIndex: atlasRow * 3 + index, badgeColumns: 3, badgeRows: 3, difficulty, metric, target,
  })) };
}

export const COOKING_ACHIEVEMENT_GROUP = catalogOnlyGroup('cooking', 'Cooking', [
  ['first-meal', 'Kitchen Apprentice', 'Finish one meal recipe at any cooking station.', 'easy', 'recipesCompleted', 1],
  ['three-recipes', 'Recipe Regular', 'Finish three different meal recipes.', 'medium', 'distinctRecipes', 3],
  ['perfect-serves', 'Golden Serve', 'Serve three meals with every ingredient and cooking step completed correctly.', 'hard', 'perfectServes', 3],
], 0);

export const BURGER_ACHIEVEMENT_GROUP = catalogOnlyGroup('burger', 'Burger Kitchen', [
  ['first-burger', 'Stack Starter', 'Complete and serve your first burger.', 'easy', 'burgersCompleted', 1],
  ['five-burgers', 'Burger Regular', 'Complete five burger orders.', 'medium', 'burgersCompleted', 5],
  ['complete-builds', 'Full Stack', 'Serve five burgers with every requested layer included.', 'hard', 'completeBurgers', 5],
], 1);

export const FOOD_DRINK_ACHIEVEMENT_GROUP = catalogOnlyGroup('food-and-drink', 'Food and Drink', [
  ['first-drink', 'First Pour', 'Finish and serve one drink recipe.', 'easy', 'drinksCompleted', 1],
  ['three-drinks', 'Little Barista', 'Finish three different drink recipes.', 'medium', 'distinctDrinks', 3],
  ['perfect-recipes', 'Recipe Artist', 'Serve three drinks with every ingredient and preparation step completed correctly.', 'hard', 'perfectServes', 3],
], 2);

export const TOWN_ACHIEVEMENT_GROUP: AchievementGroup = {
  id: 'town-building', name: 'Town Building · Little Town', earning: 'server-verified',
  achievements: TOWN_BADGES.map((b, badgeIndex) => ({ ...b, badge: badgeIndex<5?'/minigames/town-building/badges.png':badgeIndex<7?'/minigames/town-building/garden-badges.png':'/minigames/town-building/civ-badges-v1.png', badgeIndex:badgeIndex<5?badgeIndex:badgeIndex<7?badgeIndex-5:badgeIndex-7, badgeColumns:badgeIndex<5?5:badgeIndex<7?2:3, badgeRows:1, metric: 'townVerified', target: 1 })),
};

export const MINIKU_ACHIEVEMENT_GROUP: AchievementGroup = {
  id: 'miniku', name: 'Miniku · Little Sudoku', earning: 'server-verified',
  achievements: MINIKU_ACHIEVEMENTS.map(definition => ({ ...definition })),
};

export const FISHING_ACHIEVEMENT_GROUP: AchievementGroup = {
  id: 'fishing', name: 'Fishing Friends', earning: 'server-verified',
  achievements: FISHING_ACHIEVEMENTS.map(definition => ({ ...definition })),
};

/** Awarded on the server-verified serve transition, after all six recipe steps. */
export const CABBAGE_ROLLS_ACHIEVEMENT_GROUP: AchievementGroup = {
  id: 'cabbage-rolls', name: 'Cabbage Roll Kitchen', earning: 'server-verified',
  achievements: ([
    ['completed', 'Roll Chef', 'Complete all six steps and serve three cabbage rolls once, with any final result.', 'easy', 'cabbageRollsCompleted'],
    ['undercooked', 'A Little Too Soon', 'Serve three cabbage rolls with an undercooked final simmering result.', 'easy', 'cabbageRollsUndercooked'],
    ['burnt', 'Toasty Lesson', 'Serve three cabbage rolls with a burnt final simmering result.', 'medium', 'cabbageRollsBurnt'],
    ['perfect', 'Perfectly Simmered', 'Serve three cabbage rolls with a perfect final simmering result.', 'medium', 'cabbageRollsPerfect'],
  ] satisfies Array<[string, string, string, AchievementDefinition['difficulty'], AchievementDefinition['metric']]>).map(([key, name, description, difficulty, metric], badgeIndex) => ({
    id: `cabbage-rolls-${key}`, name, description,
    badge: '/minigames/cooking/cabbage-rolls/achievement-badges.png', badgeIndex, badgeColumns: 2, badgeRows: 2,
    difficulty, metric, target: 1,
  })),
};

export const ACHIEVEMENT_GROUPS: AchievementGroup[] = [
  INFINIDRILL_ACHIEVEMENT_GROUP,
  UFO_ACHIEVEMENT_GROUP,
  WADDLE_WALL_ACHIEVEMENT_GROUP,
  COOKING_ACHIEVEMENT_GROUP,
  BURGER_ACHIEVEMENT_GROUP,
  FOOD_DRINK_ACHIEVEMENT_GROUP,
  TOWN_ACHIEVEMENT_GROUP,
  MINIKU_ACHIEVEMENT_GROUP,
  {id:'halloween',name:'Halloween',earning:'server-verified',achievements:HALLOWEEN_ACHIEVEMENTS},
  CABBAGE_ROLLS_ACHIEVEMENT_GROUP,
  FISHING_ACHIEVEMENT_GROUP,
  {id:WOMENS_DAY_GROUP_ID,name:'20/10/2026',earning:'server-verified',achievements:WOMENS_DAY_ACHIEVEMENTS},
  { id: 'road-racing', name: 'Road Racing', earning: 'server-verified', achievements: ROAD_ACHIEVEMENTS.map(({progressKey: _key,...definition}) => definition) },
  DAILY_QUIZ_ACHIEVEMENTS,
  {id:LAKE_GROUP_ID,name:'Lake Friends',earning:'server-verified',achievements:LAKE_ACHIEVEMENTS.map((badge,badgeIndex)=>({...badge,badge:'/minigames/town-building/lake/achievement-badges-v1.png',badgeIndex,badgeColumns:4,badgeRows:3}))},
  {id:XMAS_GROUP_ID,name:'Xmas 2026',earning:'server-verified',achievements:XMAS_ACHIEVEMENTS},
];

export function achievementGroupStatus(group: AchievementGroup, stored: Array<AchievementDefinition & { groupId: string }>) {
  const installed = group.achievements.filter(definition => stored.some(row =>
    row.groupId === group.id && Object.entries(definition).every(([key, value]) => row[key as keyof AchievementDefinition] === value),
  )).length;
  return { ...group, installed, needsMigration: installed !== group.achievements.length };
}
