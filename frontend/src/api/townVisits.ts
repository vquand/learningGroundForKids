import {coreRequest} from './core.ts';
import type {FriendTownPage,FriendTownVisit} from '../../../server/src/town-building/visits';
import type {Environment} from '../../../server/src/town-building/environment';
export type {FriendTown,FriendTownPage} from '../../../server/src/town-building/visits';
export type TownVisitResponse=FriendTownVisit & {environment:Environment};
const base=(id:string)=>`/api/v1/profiles/${encodeURIComponent(id)}/town/friends`;
export const fetchFriendTowns=(id:string,offset=0)=>coreRequest<FriendTownPage>(`${base(id)}?offset=${offset}`);
export const fetchFriendTown=(id:string,friendId:string)=>coreRequest<TownVisitResponse>(`${base(id)}/${encodeURIComponent(friendId)}`);
