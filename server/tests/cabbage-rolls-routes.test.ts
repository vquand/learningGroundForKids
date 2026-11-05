import assert from 'node:assert/strict';
import test from 'node:test';
import {createApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
import type {AppDatabase} from '../src/contracts/db.js';
import {createCabbageRollSession} from '../src/town-building/cabbage-rolls.js';
test('cabbage achievement actions require an owned profile and reject browser award claims',async()=>{
  let writes=0;
  const db={auth:{async findFamilyBySessionHash(){return {id:'family-a',email:'test@example.test',displayName:'Family',role:'family',isActive:true};}},
    profiles:{async get(family:string,id:string){assert.equal(family,'family-a');return id==='kid-a'?{id}:null;}},
    cabbageRolls:{async get(){return createCabbageRollSession();},async mutate(){writes++;return {...createCabbageRollSession(),townReward:{stamina:0}};}}
  } as unknown as AppDatabase;
  const config=loadConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://unused:unused@localhost/unused',ALLOWED_ORIGINS:'https://cabbage.example.test',ALLOWED_FORWARDED_HOSTS:'cabbage.example.test'});
  const app=createApp({config,db,logger:{info(){},warn(){},error(){}}});
  const send=(profile:string,command:unknown,authenticated=true)=>app.request(`https://cabbage.example.test/api/v1/profiles/${profile}/cabbage-rolls/action`,{method:'POST',headers:{origin:'https://cabbage.example.test','content-type':'application/json',...(authenticated?{cookie:'plg_session=opaque'}:{})},body:JSON.stringify({revision:0,command})});
  assert.equal((await send('kid-a',{type:'serve'},false)).status,401);
  assert.equal((await send('kid-b',{type:'serve'})).status,404);
  for(const command of [{type:'serve',completed:true},{type:'serve',outcome:'perfect'},{type:'serve',achievements:{completed:1}},{type:'serve',earned:{'cabbage-rolls-perfect':'2026-10-22'}}])assert.equal((await send('kid-a',command)).status,422);
  assert.equal(writes,0);
  const response=await send('kid-a',{type:'serve'});
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control')??'',/no-store/);assert.equal(writes,1);
});
