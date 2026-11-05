import { flightTiming, flightPosition, ghostRestSeconds, ghostTravelSeconds } from '../ghostMotion.ts';

export interface LanternSite { x: number; y: number }
export interface TownLantern extends LanternSite { id: number; variant: number; post: number }
export interface GhostJob {
  id: number; worker: number; entityId: string; slot: number; generation: number;
  from: LanternSite; to: LanternSite; startedAt: number; harvested: boolean;
  origin?: LanternSite; approachSeconds?: number; carrySeconds?: number;
}
export interface GhostWorker {worker:number;position:LanternSite;readyAt:number}
export interface HalloweenState {
  year: string; activeSeconds: number; nextId: number;
  working?: boolean;
  edition?: string;
  lanterns: TownLantern[]; jobs: GhostJob[];
  workers?: GhostWorker[];
}
export const GHOST_WORKERS = 3;
export const MAX_HALLOWEEN_LANTERNS = 100;
export const HALLOWEEN_EVENT_ID = 'halloween-pumpkins';
export const HALLOWEEN_EDITION = '2026-v1';
/** Immutable edition policy: new events/editions pass their own policy to the core. */
export const HALLOWEEN_GHOST_POLICY = Object.freeze({speed:2.5,minimumTravel:3,pickupSeconds:4,placeSeconds:4,legacyApproach:4,legacyCarry:8,restMin:3,restMax:7});
export const GHOST_SPEED = HALLOWEEN_GHOST_POLICY.speed;
export const GHOST_ORIGINS = Object.freeze([{x:6,y:10},{x:4,y:24},{x:11,y:19}].map(point=>Object.freeze(point)));
export const ghostDestination=(site:LanternSite):LanternSite=>({x:site.x+.65,y:site.y+.5});
export const ghostJobTiming=(job:GhostJob)=>flightTiming(job,HALLOWEEN_GHOST_POLICY);
export const ghostJobPosition=(job:GhostJob,seconds:number)=>flightPosition(job,seconds,GHOST_ORIGINS[job.worker]!,ghostDestination(job.to),HALLOWEEN_GHOST_POLICY);
export const ghostIdleSeconds=(seed:string,worker:number,job:number)=>ghostRestSeconds(seed,worker,job,HALLOWEEN_GHOST_POLICY);
export const travelSeconds=(a:LanternSite,b:LanternSite)=>ghostTravelSeconds(a,b,HALLOWEEN_GHOST_POLICY);
