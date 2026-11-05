import assert from 'node:assert/strict';
import test from 'node:test';
import type {Pool} from 'pg';
import {createApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
import {hashSessionToken} from '../src/auth.js';
import type {AppDatabase} from '../src/contracts/db.js';
import {initialTown} from '../src/town-building/game.js';
import {createTownVisitsRepository,visitScene} from '../src/town-building/visits.js';
import {metWeatherFixture} from './met-weather-fixture.js';
import {createLakeVisitService} from '../src/town-building/maps/lake/visits.ts';
import {emptyLake} from '../src/town-building/maps/lake/game.ts';

const ownerTown=()=>{
 const state=initialTown();state.revision=23;state.materials.wood=81;
 state.entities.push(
  {id:'legacy-lantern',blueprintId:'halloween-lantern',x:8,y:12,paidCost:{wood:1}},
  {id:'current-lantern',blueprintId:'halloween-lantern',x:9,y:12,paidCost:{wood:1},eventYear:2026},
  {id:'future-lantern',blueprintId:'halloween-lantern',x:10,y:12,paidCost:{wood:1},eventYear:2027},
 );
 return state;
};

test('visit scenery expires lanterns by their occurrence without changing the owner state or revision',()=>{
 const state=ownerTown(),before=structuredClone(state);
 const scene=visitScene(state,'2026-11-01');
 assert.deepEqual(scene.entities.map(e=>e.id),[state.entities[0]!.id,'future-lantern']);
 assert.deepEqual(state,before,'visits must never mutate or revise saved owner state');
 for(const date of [undefined,'','2026-10-31','2025-11-01','2026-11-31']){
  assert.equal(visitScene(state,date).entities.length,state.entities.length,`unknown/earlier/invalid home date ${date}`);
 }
});

test('visit repository resolves the friend home date before redaction using one read and no writes',async()=>{
 const state=ownerTown(),before=structuredClone(state),queries:string[]=[];
 const profile={id:'friend',name:'Friend',emoji:'fox',color:'green',avatar_type:'emoji',avatar_url:null,avatar_frame:null};
 const pool={async query(sql:string){queries.push(sql);return{rows:[{profile,state,home_city:'Hanoi',home_country:'VN'}]};}} as unknown as Pool;
 let clocks=0;
 const visit=await createTownVisitsRepository(pool).get('family','viewer','friend',(city,country)=>{
  clocks++;assert.equal(city,'Hanoi');assert.equal(country,'VN');return '2026-11-01';
 });
 assert.equal(clocks,1);
 assert.deepEqual(visit.entities.map(e=>e.id),[state.entities[0]!.id,'future-lantern']);
 assert.equal(queries.length,1);assert.match(queries[0]!,/SELECT/);assert.doesNotMatch(queries[0]!,/\b(?:UPDATE|INSERT|DELETE)\b/i);
 assert.deepEqual(state,before);
 assert.equal('materials' in visit,false);assert.equal('revision' in visit,false);
});

test('Lake visit expiry uses the friend date and keeps all stored owner and viewer state unchanged',async()=>{
 const host=ownerTown(),viewer=initialTown();host.maps={lake:emptyLake(1000)};
 host.maps.lake!.land.entities=structuredClone(host.entities);
 const before=structuredClone({host,viewer}),queries:string[]=[];
 const pool={async query(sql:string){queries.push(sql);return sql.includes('SELECT p.id')
  ? {rows:[{id:'friend',name:'Friend',emoji:'fox',color:'green',native_city:'Hanoi',native_country_code:'VN'}]}
  : {rows:[{profile_id:'friend',state:host},{profile_id:'viewer',state:viewer}]};}} as unknown as Pool;
 const service=createLakeVisitService(pool,()=>1000);
 const visit=await service.readLakeVisit('family','viewer','friend',(city,country)=>{
  assert.equal(city,'Hanoi');assert.equal(country,'VN');return '2026-11-01';
 });
 assert.deepEqual(visit.state.maps!.lake!.land.entities.map(e=>e.id),[host.entities[0]!.id,'future-lantern']);
 const cold=await service.readLakeVisit('family','viewer','friend',()=>undefined);
 assert.equal(cold.state.maps!.lake!.land.entities.length,host.entities.length);
 assert.deepEqual({host,viewer},before);assert.ok(queries.every(sql=>! /\b(?:UPDATE|INSERT|DELETE)\b/i.test(sql)));
});

test('friend visit uses only the friend cached clock and never fetches providers on a cold cache',async t=>{
 const now=Date.parse('2026-10-31T18:00:00Z');t.mock.method(Date,'now',()=>now);
 let fetches=0;
 t.mock.method(globalThis,'fetch',async(input:URL|string|Request)=>{
  fetches++;
  return String(input).includes('geocoding')
   ? Response.json({results:[{name:'Hanoi',country_code:'VN',latitude:21,longitude:105,timezone:'Asia/Bangkok'}]})
   : Response.json(metWeatherFixture(now));
 });
 const state=ownerTown(),before=structuredClone(state);
 const profile={id:'friend',name:'Friend',emoji:'fox',color:'green',avatar_type:'emoji',avatar_url:null,avatar_frame:null};
 const pool={async query(){return{rows:[{profile,state,home_city:'Hanoi',home_country:'VN'}]};}} as unknown as Pool;
 const db={auth:{async findFamilyBySessionHash(hash:string){return hash===hashSessionToken('visit-calendar')?{id:'family',role:'parent'}:null;}},
  profiles:{async get(family:string,id:string){return family==='family'&&['viewer','hanoi-kid'].includes(id)?{id,name:'Kid',native_city:id==='viewer'?'New York':'Hanoi',native_country_code:id==='viewer'?'US':'VN'}:null;}},
  town:{},townVisits:createTownVisitsRepository(pool),
 } as unknown as AppDatabase;
 const config=loadConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://test:test@localhost/test',ALLOWED_ORIGINS:'https://app.example.test',ALLOWED_FORWARDED_HOSTS:'app.example.test'});
 const app=createApp({db,config,logger:{info(){},warn(){},error(){}}});
 const request=(path:string)=>app.request(`https://app.example.test/api/v1/profiles/${path}`,{headers:{cookie:'plg_session=visit-calendar',origin:'https://app.example.test'}});
 const cold=await request('viewer/town/friends/friend');assert.equal(cold.status,200);
 const coldBody=await cold.json() as {entities:{id:string}[];environment:{timeOfDay:unknown}};
 assert.equal(fetches,0);assert.equal(coldBody.entities.length,state.entities.length);assert.equal(coldBody.environment.timeOfDay,null);
 assert.equal((await request('hanoi-kid/town/environment')).status,200);assert.equal(fetches,2);
 const warm=await request('viewer/town/friends/friend');assert.equal(warm.status,200);
 const warmBody=await warm.json() as {entities:{id:string}[];environment:{localDate:string;locationLabel:string}};
 assert.deepEqual(warmBody.entities.map(e=>e.id),[state.entities[0]!.id,'future-lantern']);
 assert.equal(warmBody.environment.localDate,'2026-11-01');assert.equal(warmBody.environment.locationLabel,'');
 assert.equal(fetches,2,'warm visits must not refresh providers');assert.deepEqual(state,before);
});
