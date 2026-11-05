import type {AchievementDefinition} from '../../achievement-catalog.ts';
export const WOMENS_DAY_GROUP_ID='womens-day-2026';
export const WOMENS_DAY_VISIT_COUNTER='celebration-visited';
export const WOMENS_DAY_GREET_COUNTER='different-blobs-greeted';
const definitions:Omit<AchievementDefinition,'badge'>[]=[
 {id:'womens-day-2026-guest',name:'Celebration Guest',description:'Visit Town during the 20/10/2026 celebration.',difficulty:'easy',metric:'womensDay2026Visited',target:1},
 {id:'womens-day-2026-three',name:'Flower Hello',description:'Greet 3 different blobs during the 20/10/2026 celebration.',difficulty:'easy',metric:'womensDay2026Greeted',target:3},
 {id:'womens-day-2026-five',name:'Bouquet Buddies',description:'Greet 5 different blobs during the 20/10/2026 celebration.',difficulty:'medium',metric:'womensDay2026Greeted',target:5},
 {id:'womens-day-2026-seven',name:'A Town of Friends',description:'Greet all 7 different blobs during the 20/10/2026 celebration.',difficulty:'medium',metric:'womensDay2026Greeted',target:7},
];
export const WOMENS_DAY_ACHIEVEMENTS:AchievementDefinition[]=definitions.map((badge,badgeIndex)=>({...badge,badge:'/minigames/town-building/womens-day-v1/achievement-badges.png',badgeIndex,badgeColumns:2,badgeRows:2}));
