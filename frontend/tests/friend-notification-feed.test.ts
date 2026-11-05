import test from 'node:test';
import assert from 'node:assert/strict';
import {FRIEND_NOTIFICATION_PREVIEW,sortFriendNotifications,friendNotificationVerb,notificationParty} from '../src/lib/friendNotificationFeed.ts';
import type {FriendRequest} from '../src/types/social.ts';
const request=(id:string,created_at:string,responded_at:string|null=null)=>({id,created_at,responded_at,requesting_scope:'profile',requesting_profile_id:'alice',requesting_label:'Alice only',target_scope:'family',target_label:'Willow family (all kids now and later)',status:'pending'} as FriendRequest);
test('notification preview shows two latest updates without mutating the source',()=>{
  const input=[request('old','2026-10-01'),request('new','2026-10-24'),request('accepted','2026-10-02','2026-10-25')];
  const sorted=sortFriendNotifications(input);assert.deepEqual(sorted.slice(0,FRIEND_NOTIFICATION_PREVIEW).map(r=>r.id),['accepted','new']);assert.equal(input[0]!.id,'old');
});
test('compact copy distinguishes a pending request from an accepted friendship',()=>{
  assert.equal(friendNotificationVerb('pending'),'wants to friend');assert.equal(friendNotificationVerb('accepted'),'friended with');
  assert.notEqual(friendNotificationVerb('rejected'),'friended with');
});
test('parties use authorized avatar metadata, local avatars, and clean legacy names',()=>{
  const r=request('a','2026-10-24');
  assert.deepEqual(notificationParty(r,'requesting',[]),{name:'Alice'});
  assert.deepEqual(notificationParty(r,'target',[]),{name:'Willow'});
  const local={id:'alice',name:'Alice',emoji:'🐱'};assert.equal(notificationParty(r,'requesting',[local]),local);
  const authored={name:'Alice Chen',emoji:'🐰'};r.requesting_party=authored;assert.equal(notificationParty(r,'requesting',[local]),authored);
});
