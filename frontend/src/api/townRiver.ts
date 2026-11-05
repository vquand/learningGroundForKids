import {coreRequest} from './core.ts';
import type {RaftState,RaftPickup} from '../../../server/src/town-building/raftCatalog';
const own=(id:string)=>`/api/v1/profiles/${encodeURIComponent(id)}/town`;
const friend=(id:string,target:string)=>`${own(id)}/friends/${encodeURIComponent(target)}`;
export const fetchTownRaft=(id:string,target?:string)=>coreRequest<RaftState>(target?`${friend(id,target)}/raft`:`${own(id)}/raft`);
export const recordTownVisit=(id:string,target:string,requestId:string)=>coreRequest<{visited:true}>(`${friend(id,target)}/visit`,{method:'POST',body:JSON.stringify({requestId})});
export const arriveAtTown=(id:string,requestId:string)=>coreRequest<RaftState&{hasNew:boolean}>(`${own(id)}/river/arrive`,{method:'POST',body:JSON.stringify({requestId})});
export const pickRiverItem=(id:string,target:string,input:RaftPickup)=>coreRequest<{state:RaftState;receipt:{id:string;stamina:number};newlyPicked:boolean;providerStamina:number}>(`${friend(id,target)}/raft`,{method:'POST',body:JSON.stringify(input)});
