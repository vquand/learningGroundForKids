import {BLUEPRINTS,type Cost,type TownState} from './game.ts';
import {CIV_BUSINESSES} from './civCatalog.ts';
import {prosperityStage} from './civ.ts';
import {LAKE_BLUEPRINTS,LAKE_FISH,LAKE_FISH_IDS} from './water/catalog.ts';
export interface DevelopmentGoal {id:string;label:string;have:number;need:number;blueprintId?:string;lakeBlueprintId?:string;fishId?:typeof LAKE_FISH_IDS[number];cost?:Cost;hint?:string}
export interface DevelopmentProject {stage:number;nextStage:number|null;goals:DevelopmentGoal[]}
/** Public actionable objectives only: never return prosperity weights or thresholds. */
export function townDevelopmentProject(state:TownState):DevelopmentProject {
    const stage=prosperityStage(state);
    if(stage===3)return {stage,nextStage:null,goals:[]};
    // Shops count wherever they stand (prosperityStage spans maps), so never recommend one already open or built on the Lake.
    const everywhere=[...state.entities,...(state.maps?.lake?.land.entities??[])],built=(id:string)=>everywhere.some(e=>e.blueprintId===id);
    const available=CIV_BUSINESSES.filter(b=>!everywhere.some(e=>e.blueprintId===b.id&&e.civ?.phase==='ready'));
    const plans:{ids:string[];rank:number}[]=[];
    for(let mask=1;mask<(1<<available.length);mask++){
        const chosen=available.filter((_,i)=>mask&(1<<i));
        const projected={...state,entities:[...state.entities,...chosen.map(b=>({id:`project:${b.id}`,blueprintId:b.id,x:0,y:0,paidCost:{},civ:{phase:'ready' as const,elapsedMs:0,routeKey:'',helpStep:0,helpAfterMs:0}}))]};
        if(prosperityStage(projected)<=stage)continue;
        // Prefer fewer businesses, finishing existing buildings, then accessible recipes.
        const rank=chosen.length*100000+chosen.reduce((sum,b)=>{if(built(b.id))return sum;const blueprint=BLUEPRINTS.find(p=>p.id===b.id)!;return sum+1000+Math.max(0,blueprint.learned-state.learnedIds.length)*10+Object.values(blueprint.cost).reduce((a,n)=>a+(n??0),0);},0);
        plans.push({ids:chosen.map(b=>b.id),rank});
    }
    const plan=plans.sort((a,b)=>a.rank-b.rank)[0];
    const goals:DevelopmentGoal[]=(plan?.ids??[]).map(id=>{
        const blueprint=BLUEPRINTS.find(b=>b.id===id)!,exists=built(id);
        return {id:`open:${id}`,label:blueprint.name,have:0,need:1,blueprintId:id,...(!exists?{cost:blueprint.cost}:{}),hint:exists?'Connect this building to the entrance road and let its neighbors finish moving in.':'Build one, connect it to the entrance road, and welcome its neighbors.'};
    });
    const learned=Math.max(0,...(plan?.ids??[]).filter(id=>!built(id)).map(id=>BLUEPRINTS.find(b=>b.id===id)!.learned));
    if(learned>state.learnedIds.length)goals.unshift({id:'learn',label:'Learn different items',have:state.learnedIds.length,need:learned});
    return {stage,nextStage:stage+1,goals};
}
export function lakeDevelopmentProject(state:TownState):DevelopmentProject|undefined {
    const lake=state.maps?.lake;if(!lake)return;
    const stage=lake.stage;if(stage===2)return {stage,nextStage:null,goals:[]};
    const build=(id:typeof LAKE_BLUEPRINTS[number]['id']):DevelopmentGoal=>{
        const b=LAKE_BLUEPRINTS.find(b=>b.id===id)!;
        const done=lake.built.includes(id)||lake.rafts.some(r=>r.blueprintId===id);
        return {id:`build:${id}`,label:b.name,have:done?1:0,need:1,lakeBlueprintId:id,...(!done?{cost:b.cost}:{})};
    };
    if(stage===0)return {stage,nextStage:1,goals:[build('floating-garden'),{id:'plant',label:'Plant a water plant in your floating garden',have:lake.earned['lake-greens']?1:0,need:1,hint:'Choose Water spinach, Soft rush or Water lily. Planting is free.'}]};
    const settled=LAKE_FISH_IDS.filter(id=>lake.settled.includes(id));
    const goals:DevelopmentGoal[]=[build('nursery'),{id:'harvest',label:'Harvest nursery fish to unlock the fish home raft',have:Math.min(100,lake.harvested),need:100},build('friendly'),build('floating-garden'),{id:'species',label:'Welcome different fish types',have:settled.length,need:3}, {id:'collections',label:'Collect grown fish or water plants',have:Math.min(10,lake.collections),need:10,hint:'Each successful collection counts once.'}];
    const recommended=LAKE_FISH_IDS.filter(id=>!settled.includes(id)).sort((a,b)=>(lake.catches[b]??0)-(lake.catches[a]??0)).slice(0,Math.max(0,3-settled.length));
    for(const id of recommended)goals.push({id:`catch:${id}`,label:LAKE_FISH[id].name,have:Math.min(10,lake.catches[id]??0),need:10,fishId:id,hint:'Catch this fish in Fishing Friends, then stock a suitable raft for free.'});
    return {stage,nextStage:2,goals};
}
