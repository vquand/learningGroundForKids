import type {Cost} from '../game.ts';
import type {MapTerrain} from '../maps/types.ts';
export const LAKE_FISH_IDS=['P1','P3','P4','P5','R4'] as const;
export type LakeFishId=typeof LAKE_FISH_IDS[number];
export const LAKE_PLANT_IDS=['water-spinach','soft-rush','water-lily'] as const;
export type LakePlantId=typeof LAKE_PLANT_IDS[number];
export const LAKE_GROW_SECONDS=300;
export const FEEDING_RADIUS=4;
export const FRIENDLY_UNLOCK=100;
export const FLOATING_INSECT_UNLOCK=16;
export const LAKE_FISH:Record<LakeFishId,{name:string;size:'small'|'big';nurseryDepths:MapTerrain[];homeDepths:MapTerrain[];shore:boolean;active:readonly string[];food:string;stamina:number;art:number}>={
    P1:{name:'Button Minnow',size:'small',nurseryDepths:['shallow'],homeDepths:['shallow'],shore:true,active:['morning','afternoon'],food:'Tiny insects and plankton',stamina:1,art:0},
    P3:{name:'Pebble Carp',size:'big',nurseryDepths:['deep'],homeDepths:['shallow'],shore:true,active:['morning','afternoon','evening'],food:'Insect larvae, plants and tiny water creatures',stamina:2,art:1},
    P4:{name:'Round Bluegill',size:'small',nurseryDepths:['shallow'],homeDepths:['shallow'],shore:true,active:['morning','afternoon','evening'],food:'Mostly insects and tiny water creatures',stamina:1,art:2},
    P5:{name:'Ribbon Koi',size:'big',nurseryDepths:['shallow','deep'],homeDepths:['shallow'],shore:true,active:['morning','afternoon'],food:'Insect larvae and mixed pond food',stamina:2,art:3},
    R4:{name:'Whisker Catfish',size:'big',nurseryDepths:['deep'],homeDepths:['deep'],shore:false,active:['evening','night'],food:'Insects and mixed bottom food',stamina:2,art:4},
};
export const fishCapacity=(id:LakeFishId)=>LAKE_FISH[id].size==='small'?16:4;
export const LAKE_PLANTS:Record<LakePlantId,{name:string;depths:MapTerrain[];stamina:number;art:number}>={
    'water-spinach':{name:'Water spinach',depths:['shallow','deep'],stamina:4,art:2},
    'soft-rush':{name:'Soft rush',depths:['shallow','deep'],stamina:4,art:2},
    'water-lily':{name:'Water lily',depths:['shallow'],stamina:4,art:5},
};
export const LAKE_BLUEPRINT_IDS=['nursery','friendly','floating-garden','insect-raiser','floating-insect-raiser'] as const;
export type LakeBlueprintId=typeof LAKE_BLUEPRINT_IDS[number];
export interface LakeBlueprint {id:LakeBlueprintId;name:string;width:number;length:number;cost:Cost;art:number}
export const LAKE_BLUEPRINTS:readonly LakeBlueprint[]=[
    // 31 material units on average: +20.8% over Town buildings/gardens (25.67).
    // Stamina is separate from this material target.
    {id:'nursery',name:'Fish nursery',width:2,length:3,cost:{stamina:8,wood:23,rock:4,metal:4},art:0},
    // The blueprint id stays `friendly` for saved games. This is NOT the friend takeaway raft (the unique river fixture where visitors take eggs, fish and vegetables).
    {id:'friendly',name:'Fish home raft',width:2,length:3,cost:{stamina:6,wood:22,rock:4,metal:3,wool:3},art:1},
    {id:'floating-garden',name:'Floating garden',width:2,length:3,cost:{stamina:5,wood:23,rock:3,metal:2,wool:2},art:2},
    {id:'insect-raiser',name:'Shore insect raiser',width:1,length:1,cost:{stamina:3,wood:24,rock:3,metal:2,wool:1},art:3},
    {id:'floating-insect-raiser',name:'Floating insect raiser',width:1,length:1,cost:{stamina:4,wood:25,rock:3,metal:3,wool:1},art:4},
];

/** All unlocks depend on lifetime server-verified nursery harvests. */
export function lakeBlueprintUnlockError(blueprintId:LakeBlueprintId,harvested:number):string|null {
    if(blueprintId==='friendly'&&harvested<FRIENDLY_UNLOCK)return 'Harvest 100 nursery fish to unlock the fish home raft.';
    if(blueprintId==='floating-insect-raiser'&&harvested<FLOATING_INSECT_UNLOCK)return 'Harvest 16 nursery fish to unlock the floating insect raiser.';
    return null;
}
export const isInsectRaiser=(id:LakeBlueprintId)=>id==='insect-raiser'||id==='floating-insect-raiser';
