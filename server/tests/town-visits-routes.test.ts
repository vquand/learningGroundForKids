import assert from 'node:assert/strict';
import test from 'node:test';
import {createApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
import {hashSessionToken} from '../src/auth.js';
import {AppError} from '../src/errors.js';
import type {AppDatabase} from '../src/contracts/db.js';

test('friend-town routes and custom avatars recheck the owned viewer and reject writes',async()=>{
  let authenticated=true,friends=true,reads=0,mediaReads=0;
  const profile={id:'friend',name:'Mina',emoji:'⭐',color:'green',avatar_type:'custom',avatar_url:'/media/profile-avatars/family-b/friend/face.png',avatar_frame:null};
  const meta={profile,townName:{adjective:'Sunny',noun:'Meadow'},prosperityStage:0};
  const db={auth:{async findFamilyBySessionHash(hash:string){return authenticated&&hash===hashSessionToken('visit-token')?{id:'family-a',role:'family'}:null;}},
    profiles:{async get(family:string,id:string){return family==='family-a'&&id==='viewer'?{id}:null;}},
    townVisits:{async list(family:string,viewer:string,offset:number){reads++;assert.equal(family,'family-a');assert.equal(viewer,'viewer');assert.equal(offset,0);return {towns:friends?[meta]:[],nextOffset:null};},
      async get(family:string,viewer:string,target:string){reads++;if(family!=='family-a'||viewer!=='viewer'||target!=='friend'||!friends)throw new AppError(404,'FRIEND_TOWN_NOT_FOUND','This town is not available.');return {...meta,entities:[],civActiveMs:0,homeCity:null,homeCountry:null};},
      async avatar(family:string,viewer:string,target:string){return family==='family-a'&&viewer==='viewer'&&target==='friend'&&friends?profile.avatar_url:null;}},
  } as unknown as AppDatabase;
  const config=loadConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://test:test@localhost/test',ALLOWED_ORIGINS:'https://app.example.test',ALLOWED_FORWARDED_HOSTS:'app.example.test'});
  const app=createApp({db,config,logger:{info(){},warn(){},error(){}},media:{async get(){mediaReads++;return {body:new ReadableStream({start(c){c.enqueue(new Uint8Array([1]));c.close();}}),contentType:'image/png',contentLength:1};}}} as Parameters<typeof createApp>[0]);
  const request=(suffix:string,method='GET',cookie=true)=>app.request(`https://app.example.test${suffix}`,{method,headers:{...(cookie?{cookie:'plg_session=visit-token'}:{}),origin:'https://app.example.test'}});
  const base='/api/v1/profiles/viewer/town/friends';
  assert.equal((await request(base,'GET',false)).status,401);
  assert.equal((await request('/api/v1/profiles/foreign/town/friends')).status,404);
  for(const suffix of ['', '/friend'])assert.equal((await request(base+suffix,'POST')).status,405);
  for(const query of ['?offset=-1','?offset=1.5','?offset=100001','?role=admin'])assert.equal((await request(base+query)).status,422);
  assert.equal(reads,0);
  const list=await request(base);assert.equal(list.status,200);assert.equal(list.headers.get('cache-control'),'no-store');
  const visit=await request(`${base}/friend`);assert.equal(visit.status,200);
  const body=await visit.json();assert.equal('homeCity' in body,false);assert.equal('materials' in body,false);assert.equal(body.environment.locationLabel,'');
  assert.equal(visit.headers.get('cache-control'),'no-store');
  assert.equal((await request(`${base}/unknown`)).status,404);
  const avatar=profile.avatar_url+'?townVisitor=viewer';
  assert.equal((await request(profile.avatar_url)).status,404);
  assert.equal((await request(profile.avatar_url+'?townVisitor=foreign')).status,404);
  assert.equal((await request(avatar,'GET',false)).status,401);
  let image=await request(avatar);assert.equal(image.status,200);assert.equal(image.headers.get('cache-control'),'private, no-store');await image.arrayBuffer();
  friends=false;
  assert.equal((await request(`${base}/friend`)).status,404);
  assert.deepEqual((await (await request(base)).json()).towns,[]);
  image=await request(avatar);assert.equal(image.status,404);assert.equal(mediaReads,1);
  authenticated=false;assert.equal((await request(base)).status,401);
});
