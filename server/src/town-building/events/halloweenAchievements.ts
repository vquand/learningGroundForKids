import type { AchievementDefinition } from '../../achievement-catalog.ts';
export const HALLOWEEN_COUNTER = 'lanterns-created';
export const GHOSTLY_SKY_ID = 'halloween-ghostly-sky';
export const HALLOWEEN_ACHIEVEMENTS = [{
  id:GHOSTLY_SKY_ID,name:'Ghostly Sky',
  description:'Help ghosts create more than 20 lanterns during one Halloween event.',
  difficulty:'medium',badge:'/minigames/town-building/halloween-v1/ghostly-sky.png',
  badgeIndex:0,badgeColumns:1,badgeRows:1,metric:'halloweenLanternsCreated',target:21,
}] satisfies AchievementDefinition[];
