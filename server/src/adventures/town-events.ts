import { BLUEPRINTS,TOWN_BADGES,type TownState } from '../town-building/game.js';
import { prosperityStage } from '../town-building/civ.js';
import type { AdventureEvent } from './types.js';
export function townAdventures(before:TownState,after:TownState):AdventureEvent[]{
  const events:AdventureEvent[]=[];
  const existing=new Set(before.entities.map(entity=>entity.id));
  for(const entity of after.entities){
    const blueprint=BLUEPRINTS.find(value=>value.id===entity.blueprintId);
    if(entity.id!=='starter-home'&&!existing.has(entity.id)&&blueprint)
      events.push({key:`town:built:${entity.id}`,game:'town',kind:'town_built',data:{subject:blueprint.name}});
  }
  for(const badge of TOWN_BADGES){
    if(!before.earned[badge.id]&&after.earned[badge.id])events.push({key:`town:milestone:${badge.id}`,game:'town',kind:'town_milestone',data:{subject:badge.name}});
  }
  const stage=prosperityStage(after);
  if(stage>prosperityStage(before))events.push({key:`town:stage:${stage}`,game:'town',kind:'town_milestone',data:{subject:['A seed for a new town','Your town is sprouting','Your town is blooming','Your town is growing'][stage]!}});
  const harvested=(after.gardening?.harvests??0)-(before.gardening?.harvests??0);
  if(harvested>0)events.push({key:`town:harvest:${after.revision}`,game:'town',kind:'town_harvest',data:{amount:harvested}});
  return events;
}

export function blueprintAdventures(before:number,after:number):AdventureEvent[]{
  return BLUEPRINTS.filter(blueprint=>blueprint.learned>before&&blueprint.learned<=after).map(blueprint=>({key:`town:blueprint:${blueprint.id}`,game:'town',kind:'blueprint_unlocked',data:{subject:blueprint.name}}));
}
