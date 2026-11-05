import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { createTownRepository } from '../../src/town-building/repository.js';
import { createDatabase } from '../../src/db/index.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { hashSessionToken } from '../../src/auth.js';
const configured=process.env.TEST_DATABASE_URL;

test('civ move-ins persist once, partial time checkpoints, help is strict and family-owned',{skip:configured?false:'TEST_DATABASE_URL is not configured'},async()=>{
 const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((x):x is string=>!!x));
 const pool=new Pool({connectionString:url}),family=randomUUID(),profile=randomUUID(),other=randomUUID();
 let now=1000;let repo=createTownRepository(pool,()=>now);const clock={localTime:'09:00',timeOfDay:'morning'};
 const env={...clock,season:'spring' as const,precipitation:'none' as const};
 const db=createDatabase(url);
 try {
  await migrate(drizzle(pool),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  for(const id of [family,other])await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',[id,`${id}@test.local`,'Civ test','unused']);
  await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)',[profile,family,'Neighbor','star','green']);
  let state=await repo.get(profile);state.materials={stamina:100,wood:100,rock:100,sand:100,metal:100};state.storage={built:false,crops:{},milk:[],fish:{},wool:100};
  await pool.query('UPDATE town_state SET state=$2 WHERE profile_id=$1',[profile,JSON.stringify(state)]);
  state=await repo.mutate(profile,state.revision,{type:'build',blueprintId:'grocery',x:5,y:12});const shop=state.entities.find(e=>e.blueprintId==='grocery')!;
  assert.equal(shop.civ!.phase,'waiting');const materials={...state.materials};
  for(let y=0;y<=11;y++)state=await repo.mutate(profile,state.revision,{type:'build',blueprintId:'dirt-road',x:7,y});
  state=await repo.tick!(profile,'town',env,true);now+=5000;
  const [one,two]=await Promise.all([repo.tick!(profile,'town',env,false),repo.tick!(profile,'town',env,false)]);assert.deepEqual(one,two);assert.equal(one.civ!.activeMs,5000);
  await repo.checkpoint!(profile);repo=createTownRepository(pool,()=>now);
  state=await repo.get(profile);assert.equal(state.civ!.activeMs,5000);assert.equal(state.civ!.lastTick,0);
  now+=86400000;state=await repo.tick!(profile,'town',env,false);assert.equal(state.civ!.activeMs,5000,'restart cannot catch up offline time');
  for(let i=0;i<8;i++){now+=5000;state=await repo.tick!(profile,'town',env,false);}
  assert.equal(state.entities.find(e=>e.id===shop.id)!.civ!.phase,'ready');assert.ok(state.earned['town-new-neighbor']);
  assert.deepEqual(state.materials,materials);
  const persisted=(await pool.query('SELECT state FROM town_state WHERE profile_id=$1',[profile])).rows[0].state;
  assert.equal(persisted.entities.find((e:{id:string})=>e.id===shop.id).civ.phase,'ready');assert.equal(persisted.civ.lastTick,0);
  assert.equal(persisted.earned['town-new-neighbor'],state.earned['town-new-neighbor']);
  state=await repo.mutate(profile,state.revision,{type:'help-neighbor',entityId:shop.id,step:0},null,clock);
  const attempts=await Promise.allSettled([repo.mutate(profile,state.revision,{type:'help-neighbor',entityId:shop.id,step:1},null,clock),repo.mutate(profile,state.revision,{type:'help-neighbor',entityId:shop.id,step:1},null,clock)]);
  assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
  state=await repo.get(profile);state=await repo.mutate(profile,state.revision,{type:'help-neighbor',entityId:shop.id,step:2},null,clock);
  assert.deepEqual(state.civ!.helpedTypes,['grocery']);assert.deepEqual(state.materials,materials);
  const token=randomUUID(),foreign=randomUUID();
  for(const [raw,owner]of [[token,family],[foreign,other]])await pool.query('INSERT INTO sessions(id,token_hash,family_id,expires_at) VALUES($1,$2,$3,now()+interval \'1 hour\')',[randomUUID(),hashSessionToken(raw!),owner]);
  const config=loadConfig({NODE_ENV:'test',DATABASE_URL:url,ALLOWED_ORIGINS:'https://civ.example.test',ALLOWED_FORWARDED_HOSTS:'civ.example.test'});
  const app=createApp({config,db:{...db,town:repo},logger:{info(){},warn(){},error(){}}});
  const request=(suffix:string,body?:unknown,cookie:string=token)=>app.request(`https://civ.example.test/api/v1/profiles/${profile}/town${suffix}`,{method:body?'POST':'GET',headers:{origin:'https://civ.example.test','Content-Type':'application/json',...(cookie?{cookie:`${config.sessionCookieName}=${cookie}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await request('/garden/tick',{resume:false},'')).status,401);
  assert.equal((await request('/garden/tick',{resume:false},foreign)).status,404);
  assert.equal((await request('/garden/tick',{resume:false,elapsedMs:999999,ready:true})).status,422);
  assert.equal((await request('/action',{revision:state.revision,command:{type:'help-neighbor',entityId:shop.id,step:0,completed:true}})).status,422);
  const response=await request('');assert.equal(response.status,200);const view=await response.json() as {prosperityStage:number;prosperity?:unknown};
  assert.equal(view.prosperityStage,0);assert.equal(view.prosperity,undefined,'hidden numeric score is not returned');
 }finally{await pool.query('DELETE FROM families WHERE id=ANY($1::text[])',[[family,other]]);await pool.end();await db.close?.();}
});
