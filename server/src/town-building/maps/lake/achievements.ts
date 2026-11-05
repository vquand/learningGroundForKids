import type {LakeState} from './types.ts';
import {LAKE_FISH_IDS} from '../../water/catalog.ts';
export const LAKE_GROUP_ID='town-lake';
export const LAKE_ACHIEVEMENTS=[
    {id:'lake-bloom',name:'Beyond the Bloom',description:'Unlock the lake by reaching Flower prosperity.',difficulty:'medium',metric:'lakeUnlocked',target:1},
    {id:'lake-afloat',name:'First Afloat',description:'Build your first lake raft.',difficulty:'easy',metric:'lakeBuilt',target:1},
    {id:'lake-nursery',name:'Nursery Keeper',description:'Stock your first fish nursery with an unlocked fish.',difficulty:'easy',metric:'lakeNursery',target:1},
    {id:'lake-home',name:'Welcome Home',description:'Settle a fish in a built fish home raft.',difficulty:'easy',metric:'lakeHome',target:1},
    {id:'lake-greens',name:'Floating Greens',description:'Plant your first floating garden.',difficulty:'easy',metric:'lakePlanted',target:1},
    {id:'lake-trio',name:'Raft Trio',description:'Build a nursery, a fish home raft and a floating garden.',difficulty:'medium',metric:'lakeKinds',target:3},
    {id:'lake-neighbors',name:'Lake Neighbors',description:'Settle all five lake fish types in suitable habitats.',difficulty:'hard',metric:'lakeSpecies',target:5},
    {id:'lake-chubby',name:'A Chubby Little Lake',description:'Develop all three raft types, settle three fish types and collect ten grown results.',difficulty:'hard',metric:'lakeStage',target:2},
    {id:'lake-dinner',name:'Dinner by the Water',description:'Help a growing fish receive its first insect-feeding bonus.',difficulty:'easy',metric:'lakeBoosted',target:1},
    {id:'lake-friendly',name:'A Friendly Shore',description:'Harvest 100 individual nursery fish to unlock the fish home raft.',difficulty:'hard',metric:'lakeHarvested',target:100},
    {id:'lake-gift',name:"Lake's First Gift",description:'Collect your first mature nursery fish or grown water plants.',difficulty:'easy',metric:'lakeCollected',target:1},
] as const;
export function lakeMetrics(lake:LakeState|undefined):Record<string,number> {
    const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:0;
    const count=(v:unknown)=>Number.isSafeInteger(number(v))?number(v):0;
    const earned=lake?.earned??{};
    const awarded=(id:string)=>typeof earned[id]==='string'&&Number.isFinite(Date.parse(earned[id]!))?1:0;
    const kinds=new Set((Array.isArray(lake?.built)?lake.built:[]).filter(id=>['nursery','friendly','floating-garden'].includes(id))).size;
    return {lakeUnlocked:count(lake?.unlockedAt)>0?1:0,lakeBuilt:kinds>0?1:0,
        lakeNursery:awarded('lake-nursery'),lakeHome:awarded('lake-home'),lakePlanted:awarded('lake-greens'),
        lakeKinds:kinds,lakeSpecies:new Set((Array.isArray(lake?.settled)?lake.settled:[]).filter(id=>LAKE_FISH_IDS.includes(id))).size,
        lakeStage:[0,1,2].includes(lake?.stage??-1)?lake!.stage:0,lakeBoosted:number(lake?.boostedSeconds)>0?1:0,lakeHarvested:count(lake?.harvested),lakeCollected:count(lake?.collections)};
}
export function awardLake(lake:LakeState,now:number):void {
    if(lake.settled.length||lake.earned['lake-greens'])lake.stage=Math.max(lake.stage,1) as 0|1|2;
    if(['nursery','friendly','floating-garden'].every(id=>lake.built.includes(id as typeof lake.built[number]))&&lake.settled.length>=3&&lake.collections>=10)lake.stage=2;
    const metrics=lakeMetrics(lake);
    for(const badge of LAKE_ACHIEVEMENTS)if((metrics[badge.metric]??0)>=badge.target)lake.earned[badge.id]??=new Date(now).toISOString();
}
