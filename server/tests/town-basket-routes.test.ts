import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
import {hashSessionToken} from '../src/auth.js';
import type {AppDatabase} from '../src/contracts/db.js';
test('basket APIs authenticate the viewer, strictly validate presets and never accept owner or award claims',async()=>{
 let authenticated=true,calls=0;
 const db={auth:{async findFamilyBySessionHash(hash:string){return authenticated&&hash===hashSessionToken('basket-token')?{id:'family-a',role:'family'}:null;}},profiles:{async get(f:string,id:string){return f==='family-a'&&id==='viewer'?{id}:null;}},townBaskets:{
  async inbox(f:string,v:string){assert.equal(f,'family-a');assert.equal(v,'viewer');calls++;return {pending:[],decorations:[],serverNow:1000,unopenedCount:0,nextOffset:null};},
  async visitor(f:string,v:string,t:string){assert.equal(f,'family-a');assert.equal(v,'viewer');assert.equal(t,'friend');calls++;return {canSend:true};},
  async send(f:string,v:string,t:string,input:unknown){assert.equal(f,'family-a');assert.equal(v,'viewer');assert.equal(t,'friend');assert.deepEqual(input,valid);calls++;return {canSend:false};},
  async open(f:string,v:string,id:string){assert.equal(f,'family-a');assert.equal(v,'viewer');assert.equal(id,giftId);calls++;return {gift:{id}};},
 }} as unknown as AppDatabase;
 const app=createApp({db,config:loadConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://test:test@localhost/test',ALLOWED_ORIGINS:'https://app.example.test',ALLOWED_FORWARDED_HOSTS:'app.example.test'}),logger:{info(){},warn(){},error(){}}});
 const giftId=randomUUID(),valid={requestId:randomUUID(),decoration:'flowers',message:9},base='/api/v1/profiles/viewer/town';
 const request=(path:string,method='GET',body?:unknown,cookie=true)=>app.request('https://app.example.test'+path,{method,headers:{...(cookie?{cookie:'plg_session=basket-token'}:{}),origin:'https://app.example.test','content-type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 assert.equal((await request(base+'/basket','GET',undefined,false)).status,401);
 assert.equal((await request('/api/v1/profiles/foreign/town/basket')).status,404);
 assert.equal((await request(base+'/basket','POST',{})).status,405);
 assert.equal((await request(base+'/basket?offset=-1')).status,422);
 for(const body of [{...valid,message:10},{...valid,owner:'forged'},{...valid,wood:99},{...valid,decoration:'wood'},{...valid,message:'Hi!'}])assert.equal((await request(base+'/friends/friend/basket','POST',body)).status,422);
 assert.equal((await request(base+`/basket/${giftId}/open`,'POST',{earned:true})).status,422);
 assert.equal(calls,0);
 for(const [path,method,body] of [[base+'/basket','GET',undefined],[base+'/friends/friend/basket','GET',undefined],[base+'/friends/friend/basket','POST',valid],[base+`/basket/${giftId}/open`,'POST',{}]] as const){const response=await request(path,method,body);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');}
 authenticated=false;assert.equal((await request(base+'/friends/friend/basket','POST',valid)).status,401);
});
