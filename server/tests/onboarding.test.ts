import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { AppDatabase, FamilyRecord, FriendRequestRecord } from '../src/contracts/db.js';

function fixture() {
  const family: FamilyRecord = { id:'family-a', email:'a@test.local', displayName:'Family A', passwordHash:'stored', role:'family', onboardingDismissed:false, onboardingParentVisited:false };
  let elevated = false, children = 0, passkeys = 0;
  const writes: string[] = [];
  const friends: Pick<FriendRequestRecord, 'requesting_family_id' | 'status'>[] = [];
  const db = { auth: {
    async findFamilyBySessionHash() { return family; },
    async parentAccess() { return elevated ? {method:'password',until:new Date(Date.now()+60000)} : null; },
    async listPasskeys(id:string) { assert.equal(id,family.id); return Array.from({length:passkeys},()=>({id:'credential'})); },
    async updateOnboarding(id:string,action:string) { assert.equal(id,family.id); writes.push(action); if(action==='dismiss')family.onboardingDismissed=true;else family.onboardingParentVisited=true; },
  }, friendRequests: { async list(id:string) { assert.equal(id,family.id); return friends; } }, profiles: { async count(id:string) { assert.equal(id,family.id); return children; } } } as unknown as AppDatabase;
  const config = loadConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://unused:unused@localhost/unused',ALLOWED_ORIGINS:'https://onboarding.test',ALLOWED_FORWARDED_HOSTS:'onboarding.test',WEB_AUTHN_RP_ID:'onboarding.test',WEB_AUTHN_ORIGIN:'https://onboarding.test'});
  const app = createApp({config,db,logger:{info(){},warn(){},error(){}}});
  const request = (path:string,body?:unknown,cookie=true) => app.request(`https://onboarding.test/api/v1/${path}`, {method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie:'plg_session=opaque'}:{}),origin:'https://onboarding.test','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {request,family,writes,friends,setParent:()=>{elevated=true;},complete:()=>{children=1;passkeys=1;}};
}
test('onboarding is authenticated and child/passkey completion comes from the session family database',async()=>{
  const f=fixture();
  assert.equal((await f.request('family/onboarding',undefined,false)).status,401);
  const initial=await f.request('family/onboarding?family_id=foreign');
  assert.match(initial.headers.get('cache-control')??'',/no-store/);
  assert.deepEqual(await initial.json(),{dismissed:false,child_created:false,parent_visited:false,friend_request_created:false,passkey_created:false,passkeys_enabled:true});
  for(const body of [{family_id:'foreign'},{child_created:true},{passkey_created:true},{friend_request_created:true},{parent_visited:true}]) assert.equal((await f.request('family/onboarding/dismiss',body)).status,422);
  assert.deepEqual(f.writes,[]);
  f.complete(); const state=await (await f.request('family/onboarding')).json();
  assert.equal(state.child_created,true);assert.equal(state.passkey_created,true);assert.equal(state.parent_visited,false);
});
test('only verified parents record a Parent Space visit; Skip is idempotent and survives a new session read',async()=>{
  const f=fixture();
  assert.equal((await f.request('parent/onboarding/visit',{})).status,403);assert.deepEqual(f.writes,[]);
  f.setParent();assert.equal((await f.request('parent/onboarding/visit',{})).status,200);
  assert.equal((await (await f.request('family/onboarding')).json()).parent_visited,true);
  for(let i=0;i<2;i++)assert.equal((await f.request('family/onboarding/dismiss',{})).status,200);
  assert.equal((await (await f.request('family/onboarding')).json()).dismissed,true);
  const session=await (await f.request('auth/session')).json();assert.equal(session.onboarding,undefined);
  assert.deepEqual(f.writes,['visit','dismiss','dismiss']);
});
test('only new ordinary families receive the onboarding session hint',async()=>{
  const f=fixture();assert.equal((await (await f.request('auth/session')).json()).onboarding,true);
  delete f.family.onboardingDismissed;assert.equal((await (await f.request('auth/session')).json()).onboarding,undefined);
  f.family.onboardingDismissed=false;f.family.role='admin';assert.equal((await (await f.request('auth/session')).json()).onboarding,undefined);
});

test('friend setup requires a saved outgoing pending or accepted request from the session family', async()=>{
  const f=fixture();
  for(const [owner,status,expected] of [
    ['foreign','pending',false], ['foreign','accepted',false],
    ['family-a','cancelled',false], ['family-a','rejected',false],
    ['family-a','pending',true], ['family-a','accepted',true],
  ] as const) {
    f.friends.splice(0,f.friends.length,{requesting_family_id:owner,status});
    assert.equal((await (await f.request('family/onboarding')).json()).friend_request_created,expected);
  }
});
