import { coreRequest } from './core';
import type { AdventurePage } from '../../../server/src/adventures/types';
export type { AdventureEntry, AdventurePage } from '../../../server/src/adventures/types';
export function fetchAdventures(profileId:string,scope:'mine'|'friends',language:'en'|'vi',cursor:string|null,timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone):Promise<AdventurePage>{
  const query=new URLSearchParams({scope,lang:language,limit:'20',tz:timeZone});
  if(cursor)query.set('cursor',cursor);
  return coreRequest(`/api/v1/profiles/${encodeURIComponent(profileId)}/adventures?${query}`,{cache:'no-store'});
}
