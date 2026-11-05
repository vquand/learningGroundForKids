import { GHOST_ORIGINS, GHOST_SPEED, HALLOWEEN_GHOST_POLICY, ghostDestination, type GhostJob, type HalloweenState, type LanternSite } from '../../../../server/src/town-building/events/halloween2026Model.ts';
import { tickTownEvents } from '../../../../server/src/town-building/events/index.ts';
import { stepFlyingMotion } from '../../../../server/src/town-building/ghostMotion.ts';
export { ghostFacing } from '../../../../server/src/town-building/ghostMotion.ts';
import { ghostFlightPose, type GhostAnimation } from './ghostAnimation.ts';
import { GROW_SECONDS } from '../../../../server/src/town-building/garden.ts';
import { emptyTown, type Entity, type TownState } from '../../../../server/src/town-building/game.ts';
import { mapDefinition } from '../../../../server/src/town-building/maps/registry.ts';
import type { MapId } from '../../../../server/src/town-building/maps/types.ts';

export function ghostJobPose(job: GhostJob, activeSeconds: number, time: number, reduced = false) {
  const pose=ghostFlightPose(job,GHOST_ORIGINS[job.worker]!,ghostDestination(job.to),HALLOWEEN_GHOST_POLICY,HALLOWEEN_ANIMATION,activeSeconds,time,reduced);
  return {...pose,stage:pose.stage==='placing'?'hanging':pose.stage,carrying:job.harvested,variant:job.id%6};
}
const HALLOWEEN_ANIMATION:GhostAnimation=Object.freeze({flying:Object.freeze([0,1,2,3,4,5]),pickup:Object.freeze([6,7,8,9,10,11]),placing:Object.freeze([12,13,14,15,16,17]),frameMs:110});
/** A heartbeat may change the target, never the visible ghost's speed. */
export function stepGhostMotion(from:LanternSite,to:LanternSite,delta:number,reduced=false):LanternSite {
  return stepFlyingMotion(from,to,delta,GHOST_SPEED,reduced);
}
/** Preview runs the same reservations, travel and rests against a private
 * snapshot. No crop regrowth and no writes: each starting pumpkin is used once. */
export class HalloweenPreviewWorld {
  private state:TownState;
  private mapId:MapId;
  constructor(entities:readonly Entity[],mapId:MapId) {
    this.mapId=mapId;
    this.state={...emptyTown(),entities:structuredClone(entities) as Entity[]};
    this.advance(0);
  }
  advance(seconds:number): {holiday:HalloweenState;entities:Entity[]} {
    const weather={localDate:'2026-10-30',timeOfDay:'night',isDay:false,precipitation:'none',weatherSource:'live'};
    const elapsed=Math.max(0,seconds-(this.state.halloween?.activeSeconds??0));
    if(this.state.halloween&&!this.state.halloween.jobs.length&&!this.state.entities.some(e=>e.garden?.slots.some(s=>s.crop==='pumpkin'&&s.growth>=GROW_SECONDS)))this.state.halloween.activeSeconds=seconds;
    else tickTownEvents(this.state,mapDefinition(this.mapId),weather,elapsed,GROW_SECONDS);
    return {holiday:this.state.halloween!,entities:this.state.entities};
  }
}
/** Deterministic reconstruction for tests, separate from the incremental renderer. */
export function previewHalloween(entities:readonly Entity[],seconds:number) {
  const preview=new HalloweenPreviewWorld(entities,'town');
  for(let elapsed=1;elapsed<seconds;elapsed++)preview.advance(elapsed);
  return preview.advance(seconds);
}
