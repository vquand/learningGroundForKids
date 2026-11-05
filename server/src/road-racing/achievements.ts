import type { AchievementDefinition } from '../achievement-catalog.js';
import { ANIMALS } from './questions.ts';
import type { Stats } from './game.js';
export const ROAD_BADGE_COLUMNS = 4;
export const ROAD_BADGE_ROWS = 5;
const entries: [string,string,string,AchievementDefinition['difficulty'],string,number][] = [
  ['first','First Finish','Complete one Road Racing race.','easy','finished',1],
  ['charge','Full Charge','Reach three boost stacks and complete that race.','easy','charged',1],
  ['podium','Podium Pal','Finish in the top three five times.','medium','podiums',5],
  ['win','Road Champion','Win a Road Racing race.','medium','wins',1],
  ['friends','Animal All-Rounder','Complete a race with all seven animal friends.','medium','friends',7],
  ['ten','Victory Lap','Win ten Road Racing races.','hard','wins',10],
  ['last','Scenic Route','Finish last for the first time.','easy','last',1],
  ...ANIMALS.map((animal,i) => [animal,
    ['Podium Potato','Snappy Finisher','Quack on Track','Honk on the Podium','Moo-ve Over!','Shaggy Speedster','Cluck and Collect'][i]!,
    `Finish in the top three as the ${['capybara','crocodile','duck','goose','dairy cow','Highland cow','chicken'][i]}.`,
    'medium',`podium:${animal}`,1] as [string,string,string,AchievementDefinition['difficulty'],string,number]),
  ['three','Hat-Trick Hero','Win three Road Racing races in total.','medium','wins',3],
  ['streak','Three-Peat Feet','Win three races in a row without leaving a race.','hard','bestStreak',3],
  ['slowed','Slow and Steady','Finish a race after being slowed by a debuff at least once.','easy','slowed',1],
  ['snail','Snail Survivor','Finish in the top three in a race in which you carried 2 or more debuffs at the same time.','hard','snailPodiums',1],
];
export const ROAD_ACHIEVEMENTS = entries.map(([key,name,description,difficulty,metric,target],badgeIndex) => ({
  id:`road-racing-${key}`,name,description,difficulty,metric:'roadRacingVerified' as const,target,
  badge:'/minigames/road-racing/badges.png',
  badgeIndex,
  badgeColumns:ROAD_BADGE_COLUMNS,badgeRows:ROAD_BADGE_ROWS,
  progressKey:metric,
}));
export function achievementValue(stats: Stats, key: string): number {
  if (key === 'friends') return ANIMALS.filter(animal => (stats.friends[animal] ?? 0) > 0).length;
  if (key.startsWith('podium:')) return stats.animalPodiums[key.slice(7)] ?? 0;
  return Number(stats[key as keyof Stats] ?? 0);
}
