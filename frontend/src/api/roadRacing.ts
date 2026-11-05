import { coreRequest } from './core';
import type { PublicState, Action, Settings } from '../../../server/src/road-racing/game';
export type { PublicState as RacingState, Action as RacingAction, Settings as RacingSettings };
const base=(profile:string)=>`/api/v1/profiles/${encodeURIComponent(profile)}/road-racing`;
export const loadRace=(profile:string)=>coreRequest<PublicState>(base(profile));
export const startRace=(profile:string,revision:number,settings:Settings)=>coreRequest<PublicState>(`${base(profile)}/start`,{method:'POST',body:JSON.stringify({revision,settings})});
export const actRace=(profile:string,revision:number,raceId:string,action:Action)=>coreRequest<PublicState>(`${base(profile)}/action`,{method:'POST',body:JSON.stringify({revision,raceId,action})});
export const leaveRace=(profile:string,raceId:string)=>coreRequest<PublicState>(`${base(profile)}/leave`,{method:'POST',keepalive:true,body:JSON.stringify({raceId})});
