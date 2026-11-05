import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
import {hashSessionToken} from '../src/auth.js';
import type {AppDatabase} from '../src/contracts/db.js';
test('river routes authorize the viewer and reject forged balances, ownership and report claims',async()=>{
 let calls=0;
 const db={auth:{async findFamilyBySessionHash(hash:string){return hash===hashSessionToken('river-token')?{id:'family-a',role:'family'}:null;}},profiles:{async get(f:string,id:string){return f==='family-a'&&id==='viewer'?{id}:null;}},townRaft:{
  async get(f:string,v:string,t?:string){assert.equal(f,'family-a');assert.equal(v,'viewer');assert.ok(t===undefined||t==='friend');calls++;return {};},
  async arrive(f:string,v:string,r:string){assert.equal(f,'family-a');assert.equal(v,'viewer');assert.equal(r,requestId);calls++;return {hasNew:false};},
  async visit(f:string,v:string,t:string,r:string){assert.equal(f,'family-a');assert.equal(v,'viewer');assert.equal(t,'friend');assert.equal(r,requestId);calls++;},
  async pick(f:string,v:string,t:string,input:unknown){assert.equal(f,'family-a');assert.equal(v,'viewer');assert.equal(t,'friend');assert.ok(JSON.stringify(input)===JSON.stringify({requestId,itemId})||JSON.stringify(input)===JSON.stringify({requestId,itemIds:[itemId]}));calls++;return {};},
 }} as unknown as AppDatabase;
 const app=createApp({db,config:loadConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://test:test@localhost/test',ALLOWED_ORIGINS:'https://app.example.test',ALLOWED_FORWARDED_HOSTS:'app.example.test'}),logger:{info(){},warn(){},error(){}}});
 const requestId=randomUUID(),itemId=randomUUID(),base='/api/v1/profiles/viewer/town';
 const request=(path:string,method='GET',body?:unknown,cookie=true)=>app.request('https://app.example.test'+path,{method,headers:{...(cookie?{cookie:'plg_session=river-token'}:{}),origin:'https://app.example.test','content-type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 assert.equal((await request(base+'/raft','GET',undefined,false)).status,401);
 assert.equal((await request('/api/v1/profiles/foreign/town/raft')).status,404);
 assert.equal((await request(base+'/raft','POST',{})).status,405);
 assert.equal((await request(base+'/river/arrive')).status,405);
 for(const suffix of ['/river/arrive','/friends/friend/visit'])for(const body of [{requestId,stamina:100},{requestId,owner:'foreign'},{requestId:'bad'}])assert.equal((await request(base+suffix,'POST',body)).status,422);
 for(const body of [{requestId,itemId,stamina:100},{requestId,itemId,picker:'foreign'},{requestId,itemId,hasNew:false},{requestId,itemId:'bad'}])assert.equal((await request(base+'/friends/friend/raft','POST',body)).status,422);
 for(const itemIds of [[],Array(6).fill(itemId),[itemId,itemId],['bad']])assert.equal((await request(base+'/friends/friend/raft','POST',{requestId,itemIds})).status,422);
 assert.equal(calls,0);
 for(const [path,method,body] of [[base+'/raft','GET',undefined],[base+'/friends/friend/raft','GET',undefined],[base+'/river/arrive','POST',{requestId}],[base+'/friends/friend/visit','POST',{requestId}],[base+'/friends/friend/raft','POST',{requestId,itemId}]] as const){const response=await request(path,method,body);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');}
 assert.equal((await request(base+'/friends/friend/raft','POST',{requestId,itemIds:[itemId]})).status,200);
 assert.equal(calls,6);
});
