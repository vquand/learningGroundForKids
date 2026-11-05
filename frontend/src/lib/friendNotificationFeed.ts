import type {FriendRequest,FriendRequestParty} from '../types/social';

export const FRIEND_NOTIFICATION_PREVIEW=2;
const timestamp=(request:FriendRequest)=>Date.parse(request.responded_at??request.created_at)||0;
export function sortFriendNotifications(requests:readonly FriendRequest[]):FriendRequest[] {
  return [...requests].sort((a,b)=>timestamp(b)-timestamp(a)||b.id.localeCompare(a.id));
}
export function friendNotificationVerb(status:FriendRequest['status']):string {
  return status==='accepted'?'friended with':status==='pending'?'wants to friend':'friend request to';
}
export function notificationParty(request:FriendRequest,side:'requesting'|'target',profiles:readonly (FriendRequestParty&{id:string})[]):FriendRequestParty {
  const authored=request[`${side}_party`];if(authored)return authored;
  const scope=request[`${side}_scope`],id=request[`${side}_profile_id`];
  const local=scope==='profile'?profiles.find(p=>p.id===id):undefined;if(local)return local;
  const label=request[`${side}_label`];
  return {name:scope==='profile'?label.replace(/ only$/,''):label.replace(/ family \(all kids now and later\)$/,'')};
}
