import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
import {hashSessionToken} from '../src/auth.js';
import type {AppDatabase} from '../src/contracts/db.js';
import {initialTown} from '../src/town-building/game.js';
import {WOMENS_DAY_GROUP_ID,WOMENS_DAY_ACHIEVEMENTS} from '../src/town-building/events/womensDayAchievements.js';
test('event interactions require ownership and strict individual commands; catalog migration remains admin-only',async()=>{
 let authenticated=true,writes=0,role='family';const stored:any[]=[];
 const db={auth:{async findFamilyBySessionHash(hash:string){return authenticated&&hash===hashSessionToken('event-token')?{id:'family-a',email:'test@example.test',displayName:'Test',passwordHash:'unused',role}:null;}},
  profiles:{async get(family:string,id:string){return family==='family-a'&&id==='kid-a'?{id}:null;}},
  town:{async celebrate(id:string,command:unknown){assert.equal(id,'kid-a');writes++;assert.ok(['visit','greet'].includes((command as {type:string}).type));return initialTown();}},
  achievements:{async list(){return stored;},async sync(group:any){assert.equal(group.id,WOMENS_DAY_GROUP_ID);stored.splice(0,stored.length,...group.achievements.map((b:any)=>({...b,groupId:group.id})));}},
 } as unknown as AppDatabase;
 const app=createApp({db,config:loadConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://test:test@localhost/test',ALLOWED_ORIGINS:'https://app.example.test',ALLOWED_FORWARDED_HOSTS:'app.example.test'}),logger:{info(){},warn(){},error(){}}});
 const request=(body:unknown,id='kid-a',method='POST')=>app.request(`https://app.example.test/api/v1/profiles/${id}/town/events/womens-day/action`,{method,headers:{cookie:'plg_session=event-token',origin:'https://app.example.test','content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})});
 assert.equal((await request({type:'visit'},'foreign')).status,404);assert.equal((await request({},'kid-a','GET')).status,405);
 for(const command of [{type:'greet',visitorId:'forged'},{type:'greet',visitorId:'flower-8'},{type:'visit',count:99},{type:'visit',year:'2026'},{type:'greet',visitorId:'flower-1',earned:true},{type:'award',achievementId:'womens-day-2026-seven'}])assert.equal((await request(command)).status,422);
 assert.equal(writes,0);const response=await request({type:'visit'});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await request({type:'greet',visitorId:'flower-7'})).status,200);assert.equal(writes,2);
 const migrate=()=>app.request(`https://app.example.test/api/v1/admin/achievements/${WOMENS_DAY_GROUP_ID}/migrate`,{method:'POST',headers:{cookie:'plg_session=event-token',origin:'https://app.example.test','content-type':'application/json'},body:JSON.stringify({achievements:[{id:'forged'}]})});
 assert.equal((await migrate()).status,403);role='admin';for(let run=0;run<2;run++){const migrated=await migrate();assert.equal(migrated.status,200);const group=await migrated.json();assert.equal(group.name,'20/10/2026');assert.equal(group.installed,4);assert.deepEqual(group.achievements.map((b:any)=>b.id),WOMENS_DAY_ACHIEVEMENTS.map(b=>b.id));}assert.equal(stored.length,4);
 authenticated=false;assert.equal((await request({type:'visit'})).status,401);assert.equal((await migrate()).status,401);
});
