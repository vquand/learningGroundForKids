import assert from 'node:assert/strict';
import test from 'node:test';
import {createApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
import {hashSessionToken} from '../src/auth.js';
import {emptyTown} from '../src/town-building/game.js';
import {seasonAt,type Environment} from '../src/town-building/environment.js';
import {metWeatherFixture} from './met-weather-fixture.js';
import type {AppDatabase} from '../src/contracts/db.js';

test('Town and Lake reads/actions use the trusted home clock, independent of appearance preview',async t=>{
 const now=Date.now(),calls:{kind:string;clock:Environment}[]=[];
 t.mock.method(globalThis,'fetch',async(input:URL|string|Request)=>String(input).includes('geocoding')
  ? Response.json({results:[{name:'Hanoi',country_code:'VN',latitude:21,longitude:105,timezone:'Asia/Bangkok'}]})
  : Response.json(metWeatherFixture(now)));
 const capture=(kind:string,clock:Environment)=>{calls.push({kind,clock});return emptyTown();};
 const db={auth:{async findFamilyBySessionHash(hash:string){return hash===hashSessionToken('town-calendar')?{id:'family',role:'admin'}:null;}},
  profiles:{async get(family:string,id:string){return family==='family'&&id==='kid'?{id,name:'Kid',native_city:'Hanoi',native_country_code:'VN'}:null;}},
  town:{get:async(_id:string,clock:Environment)=>capture('get',clock),getName:async()=>({adjective:'Sunny',noun:'Meadow'}),
   mutate:async(_id:string,_revision:number,_command:unknown,_season:unknown,clock:Environment)=>capture('mutate',clock),
   checkpoint:async(_id:string,clock:Environment)=>capture('checkpoint',clock),
   getLake:async(_id:string,clock:Environment)=>capture('getLake',clock),
   mutateLake:async(_id:string,_revision:number,_command:unknown,clock:Environment)=>capture('mutateLake',clock),
   tickLake:async()=>emptyTown(),pauseLake:async(_id:string,clock:Environment)=>capture('pauseLake',clock)},
 } as unknown as AppDatabase;
 const config=loadConfig({NODE_ENV:'test',TOWN_ENVIRONMENT_PREVIEW_ENABLED:'true',DATABASE_URL:'postgresql://test:test@localhost/test',ALLOWED_ORIGINS:'https://app.example.test',ALLOWED_FORWARDED_HOSTS:'app.example.test'});
 const app=createApp({db,config,logger:{info(){},warn(){},error(){}}});
 const request=(suffix:string,body?:unknown)=>app.request(`https://app.example.test/api/v1/profiles/kid/town${suffix}`,{method:body?'POST':'GET',headers:{cookie:'plg_session=town-calendar',origin:'https://app.example.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await request('/environment/preview',{season:'winter',precipitation:'snow',snowCover:true})).status,200);
 for(const suffix of ['','/maps/lake'])assert.equal((await request(suffix)).status,200);
 for(const suffix of ['/action','/maps/lake/action'])assert.equal((await request(suffix,{revision:0,command:suffix==='/action'?{type:'build',blueprintId:'halloween-lantern',x:8,y:12}:{type:'land-action',mapId:'lake',command:{type:'remove',entityId:'bridge'}}})).status,200);
 for(const suffix of ['/garden/checkpoint','/maps/lake/pause'])assert.equal((await request(suffix,{})).status,200);
 assert.deepEqual(calls.map(c=>c.kind),['get','getLake','mutate','mutateLake','checkpoint','pauseLake']);
 for(const {clock} of calls){assert.equal(clock.localDate,seasonAt(new Date(now),'Asia/Bangkok',21).localDate);assert.ok(clock.timeOfDay);assert.notEqual(clock.weatherSource,'preview');}
});

test('cold-cache scene reads, checkpoints and ordinary actions never fetch weather or geocoding',async t=>{
 let fetches=0;
 const calls:{kind:string;clock:Environment}[]=[];
 t.mock.method(globalThis,'fetch',async()=>{fetches++;throw new Error('Weather must not be needed for this request');});
 const capture=(kind:string,clock:Environment)=>{calls.push({kind,clock});return emptyTown();};
 const db={auth:{async findFamilyBySessionHash(hash:string){return hash===hashSessionToken('town-calendar')?{id:'family',role:'admin'}:null;}},
  profiles:{async get(family:string,id:string){return family==='family'&&id==='kid'?{id,name:'Kid',native_city:'Hanoi',native_country_code:'VN'}:null;}},
  town:{get:async(_id:string,clock:Environment)=>capture('get',clock),getName:async()=>({adjective:'Sunny',noun:'Meadow'}),
   mutate:async(_id:string,_revision:number,_command:unknown,_season:unknown,clock:Environment)=>capture('mutate',clock),
   checkpoint:async(_id:string,clock:Environment)=>capture('checkpoint',clock),
   getLake:async(_id:string,clock:Environment)=>capture('getLake',clock),
   mutateLake:async(_id:string,_revision:number,_command:unknown,clock:Environment)=>capture('mutateLake',clock),
   tickLake:async()=>emptyTown(),pauseLake:async(_id:string,clock:Environment)=>capture('pauseLake',clock)},
 } as unknown as AppDatabase;
 const config=loadConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://test:test@localhost/test',ALLOWED_ORIGINS:'https://app.example.test',ALLOWED_FORWARDED_HOSTS:'app.example.test'});
 const app=createApp({db,config,logger:{info(){},warn(){},error(){}}});
 const request=(suffix:string,body?:unknown)=>app.request(`https://app.example.test/api/v1/profiles/kid/town${suffix}`,{method:body?'POST':'GET',headers:{cookie:'plg_session=town-calendar',origin:'https://app.example.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 for(const suffix of ['','/development','/maps/lake'])assert.equal((await request(suffix)).status,200,suffix);
 for(const suffix of ['/garden/checkpoint','/maps/lake/pause'])assert.equal((await request(suffix,{})).status,200,suffix);
 const ordinaryCommands=[
  {type:'build',blueprintId:'house',x:8,y:12},
  {type:'build',blueprintId:'halloween-lantern',x:8,y:12},
  {type:'remove',entityId:'house'},
  {type:'harvest',entityId:'patch',generation:0},
 ];
 for(const command of ordinaryCommands){
  assert.equal((await request('/action',{revision:0,command})).status,200,command.type);
  assert.equal((await request('/maps/lake/action',{revision:0,command:{type:'land-action',mapId:'lake',command}})).status,200,command.type);
 }
 assert.equal(fetches,0,'cold cache must not begin provider work on scene/ordinary-action requests');
 assert.deepEqual(calls.slice(0,5).map(c=>c.kind),['get','get','getLake','checkpoint','pauseLake']);
 for(const {kind,clock} of calls)assert.equal(clock.timeOfDay,null,`${kind} must preserve an unknown home clock`);
});
