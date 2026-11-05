import {useMemo,useState} from 'react';
import {ProfileAvatar} from '../ProfileAvatar';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {uiText,uiMessage} from '../../i18n/uiText';
import {FRIEND_NOTIFICATION_PREVIEW,sortFriendNotifications,friendNotificationVerb,notificationParty} from '../../lib/friendNotificationFeed';
import type {FriendRequest,FriendRequestParty} from '../../types/social';
import type {CalendarNotificationItem} from '../../api/calendarNotifications';
import {CalendarNotificationItems} from './CalendarNotificationItems';
import {notificationPanelTotal} from '../../lib/calendarNotificationFeed';
import './friendNotifications.css';

const NO_CALENDAR_ITEMS:readonly CalendarNotificationItem[]=[];

function Party({party,family}:{party:FriendRequestParty;family:boolean}) {
  return <span className="friend-notification-party">
    {family?<span className="friend-notification-family" aria-label={uiText('Family')}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m3 15 13-11 13 11v13H3Z" fill="#f5dcb6" stroke="#805e45" strokeWidth="2"/><circle cx="12" cy="17" r="3" fill="#d38c6c"/><circle cx="21" cy="17" r="3" fill="#7da38a"/><path d="M7 26v-2a5 5 0 0 1 10 0v2m0 0v-2a5 5 0 0 1 10 0v2" fill="#e7b289" stroke="#805e45" strokeWidth="1.5"/></svg></span>:
      <ProfileAvatar size="md" profile={{emoji:party.emoji??'🙂',color:party.color,avatar_type:party.avatar_type??'emoji',avatar_url:party.avatar_url??undefined,avatar_frame:party.avatar_frame}}/>}
    <span className="friend-notification-name" title={party.name} tabIndex={0}>{party.name}</span>
  </span>;
}

export function FriendNotificationList({requests,profiles,familyId,responding,onAccept,onReject,calendarItems=NO_CALENDAR_ITEMS}:{
  requests:FriendRequest[];profiles:(FriendRequestParty&{id:string})[];familyId:string|null;responding:boolean;
  onAccept:(request:FriendRequest)=>void;onReject:(request:FriendRequest)=>void;calendarItems?:readonly CalendarNotificationItem[];
}) {
  const language=useUiLanguage(),[expanded,setExpanded]=useState(false);
  const sorted=useMemo(()=>sortFriendNotifications(requests),[requests]);
  const visible=expanded?sorted:sorted.slice(0,FRIEND_NOTIFICATION_PREVIEW);
  return <section className="friend-notifications" aria-label={uiText('Notifications')}>
    <div className="friend-notifications-heading"><h2>{uiText('Notifications')}</h2><span>{notificationPanelTotal(requests.length,calendarItems)}</span></div>
    <CalendarNotificationItems items={calendarItems}/>
    {!visible.length?(calendarItems.length?null:<p className="friend-notifications-empty">{uiText('No notifications yet.')}</p>):<ul className="friend-notifications-feed">
      {visible.map(request=>{
        const review=request.status==='pending'&&request.target_family_id===familyId;
        const date=new Date(request.responded_at??request.created_at);
        return <li key={request.id} className="friend-notification-row" title={Number.isNaN(date.getTime())?'':date.toLocaleString(language==='vi'?'vi-VN':'en-GB')}>
          <div className="friend-notification-summary">
            <Party party={notificationParty(request,'requesting',profiles)} family={request.requesting_scope==='family'}/>
            <span className="friend-notification-verb">{uiText(friendNotificationVerb(request.status))}</span>
            <Party party={notificationParty(request,'target',profiles)} family={request.target_scope==='family'}/>
          </div>
          {review?<div className="friend-notification-actions"><button type="button" disabled={responding} className="friend-notification-accept" title={uiText('Accept')} aria-label={uiText('Accept friend request')} onClick={()=>onAccept(request)}>✓</button><button type="button" disabled={responding} title={uiText('Reject')} aria-label={uiText('Reject friend request')} onClick={()=>onReject(request)}>×</button></div>:
            request.status==='rejected'||request.status==='cancelled'?<span className="friend-notification-status">{uiText(request.status==='rejected'?'Declined':'Cancelled')}</span>:null}
        </li>;
      })}
    </ul>}
    {sorted.length>FRIEND_NOTIFICATION_PREVIEW&&<button type="button" className="friend-notifications-more" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?uiText('Show less'):uiMessage('Show all ({count})',{count:sorted.length})}</button>}
  </section>;
}
