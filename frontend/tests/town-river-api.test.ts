import assert from 'node:assert/strict';
import test from 'node:test';
import {fetchTownBasket,fetchFriendBasket,sendTownSurprise,openTownSurprise} from '../src/api/townBaskets.ts';
import {fetchTownRaft,arriveAtTown,recordTownVisit,pickRiverItem} from '../src/api/townRiver.ts';
import {BASKET_MESSAGES,BASKET_DECORATION_NAMES} from '../../server/src/town-building/basketCatalog.ts';
import {isPrivateQueryKey} from '../src/lib/familyQueries.ts';
import {readFile} from 'node:fs/promises';
test('river APIs use owned same-origin commands without identity, time or reward claims',async()=>{
 const previous=globalThis.fetch,calls:{path:string;init:RequestInit}[]=[];
 globalThis.fetch=async(path,init)=>{calls.push({path:String(path),init:init!});return Response.json({});};
 try{
  await fetchTownBasket('kid/a',5);await fetchFriendBasket('kid/a','friend/b');await sendTownSurprise('kid/a','friend/b',{requestId:'request',decoration:'flowers',message:3});await openTownSurprise('kid/a','gift/id');
  await fetchTownRaft('kid/a','friend/b');await arriveAtTown('kid/a','arrival');await recordTownVisit('kid/a','friend/b','visit');await pickRiverItem('kid/a','friend/b',{requestId:'pickup',itemId:'item'});
  await pickRiverItem('kid/a','friend',{requestId:'batch',itemIds:['fish-a','fish-b']});
  assert.deepEqual(JSON.parse(String(calls.at(-1)!.init.body)),{requestId:'batch',itemIds:['fish-a','fish-b']});
  assert.ok(calls.every(c=>c.init.credentials==='same-origin'&&!new Headers(c.init.headers).has('Authorization')));
  assert.equal(calls[0]!.path,'/api/v1/profiles/kid%2Fa/town/basket?offset=5');
  assert.deepEqual(JSON.parse(String(calls[2]!.init.body)),{requestId:'request',decoration:'flowers',message:3});
  assert.deepEqual(JSON.parse(String(calls[7]!.init.body)),{requestId:'pickup',itemId:'item'});
  assert.ok(isPrivateQueryKey(['town-basket','family']));assert.ok(isPrivateQueryKey(['town-raft','family']));
 }finally{globalThis.fetch=previous;}
});
test('all ten friendly messages and all three decorations have Vietnamese copy',async()=>{
 const vi=JSON.parse(await readFile(new URL('../src/i18n/vi.json',import.meta.url),'utf8'));
 for(const message of [...BASKET_MESSAGES,...Object.values(BASKET_DECORATION_NAMES)])assert.equal(typeof vi[message],'string',message);
});
