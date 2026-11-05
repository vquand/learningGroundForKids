import type {TownState} from '../../game.ts';
import {prosperityStage} from '../../civ.ts';
import {LAKE_ADJECTIVES,DEFAULT_LAKE_ADJECTIVE} from './name.ts';
import {awardLake} from './achievements.ts';
import type {LakeState,LakeCommand} from './types.ts';
import type {LakeFishId} from '../../water/catalog.ts';
import {applyWaterCommand} from '../../water/rules.ts';
import {requireLake} from '../view.ts';

export function emptyLake(now:number):LakeState {
    const lake:LakeState={adjective:DEFAULT_LAKE_ADJECTIVE,unlockedAt:now,stage:0,rafts:[],land:{entities:[]},harvested:0,collections:0,plantsHarvested:0,boostedSeconds:0,reserve:{},catches:{},settled:[],built:[],earned:{}};
    awardLake(lake,now);return lake;
}
export function ensureLakeUnlock(state:TownState,now:number):TownState {
    if(state.maps?.lake||prosperityStage(state)<3)return state;
    return {...state,maps:{...state.maps,lake:emptyLake(now)},revision:state.revision+1};
}
/** Lake naming plus water commands for any map (water progress lives with the Lake). */
export function applyLakeCommand(previous:TownState,command:LakeCommand,now:number,id:string,catches:Partial<Record<LakeFishId,number>>,stockLimit=Infinity):TownState {
    const state=structuredClone(previous),lake=requireLake(state);
    lake.catches={...catches};
    if(command.type==='rename'){
        if(!LAKE_ADJECTIVES.includes(command.adjective))throw new Error('Choose a lake name from the list.');
        lake.adjective=command.adjective;
    }else if(!applyWaterCommand(state,command,now,id,catches,stockLimit))return previous;
    awardLake(lake,now);state.revision++;return state;
}
