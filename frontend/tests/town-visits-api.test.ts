import assert from 'node:assert/strict';
import test from 'node:test';
import {fetchFriendTowns,fetchFriendTown} from '../src/api/townVisits.ts';
import {isPrivateQueryKey} from '../src/lib/familyQueries.ts';

test('friend towns use same-origin GETs scoped to the viewer and clear with private caches',async()=>{
  const before=globalThis.fetch,calls:{url:string;init:RequestInit}[]=[];
  globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init:init!});return Response.json({towns:[],nextOffset:null});};
  try{
    await fetchFriendTowns('kid/one',6);await fetchFriendTown('kid/one','friend/two');
    assert.deepEqual(calls.map(c=>c.url),['/api/v1/profiles/kid%2Fone/town/friends?offset=6','/api/v1/profiles/kid%2Fone/town/friends/friend%2Ftwo']);
    assert.ok(calls.every(c=>c.init.credentials==='same-origin'&&!c.init.body&&!c.init.method));
    assert.ok(isPrivateQueryKey(['town-friends','family','kid']));
    assert.ok(isPrivateQueryKey(['town-visit','family','kid','friend']));
  }finally{globalThis.fetch=before;}
});
