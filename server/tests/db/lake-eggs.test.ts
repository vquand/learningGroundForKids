import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {fileURLToPath} from 'node:url';
import {assertSafeTestDatabaseUrl} from '../../src/db/test-database.ts';
import {createDatabase} from '../../src/db/index.ts';
import {createTownRepository} from '../../src/town-building/repository.ts';
import {emptyLake} from '../../src/town-building/maps/lake/game.ts';
import {hashSessionToken} from '../../src/auth.ts';
import {loadConfig} from '../../src/config.ts';
import {createApp} from '../../src/app.ts';
import {ensurePoultry} from '../../src/town-building/poultry.ts';

const sharedEggs=async(pool:Pool,profile:string)=>(await pool.query("SELECT COUNT(*)::int AS n FROM town_raft_items WHERE provider_id=$1 AND kind='egg'",[profile])).rows[0].n as number;
test('coop eggs survive offline reads and cross-map moves; competing harvests credit stock and stamina once',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((s):s is string=>!!s));
 const pool=new Pool({connectionString:url,max:8}),family=randomUUID(),profile=randomUUID();
 const hour=3600000;let now=1000;
 const repo=createTownRepository(pool,()=>now),second=createTownRepository(pool,()=>now);
 const env={season:'spring' as const,timeOfDay:'morning' as const,precipitation:'none' as const,localDate:'2026-10-25'};
 try{
  await migrate(drizzle(pool),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',[family,`${family}@coop-eggs.test`,'Coop eggs','unused']);
  await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)',[profile,family,'Chicken keeper','🐥','#aabbcc']);
  let state=await repo.get(profile);
  state.materials={stamina:1000,wood:1000,rock:1000,sand:1000,metal:1000};state.storage={built:false,crops:{},milk:[],fish:{},wool:1000};
  state.entities=[{id:'coop',blueprintId:'coop',animal:'chicken',x:6,y:3,paidCost:{}}];state.maps={lake:emptyLake(now)};
  state=ensurePoultry(state,now);
  await pool.query('UPDATE town_state SET state=$2 WHERE profile_id=$1',[profile,JSON.stringify(state)]);
  now+=6*hour;
  state=await second.get(profile);assert.equal(state.entities[0]!.poultry!.eggs,1);
  assert.equal((await pool.query('SELECT state FROM town_state WHERE profile_id=$1',[profile])).rows[0].state.entities[0].poultry.eggs,0,'display reads do not write egg production');
  const command={type:'harvest-eggs' as const,entityId:'coop',generation:0},revision=state.revision;
  const race=await Promise.allSettled([repo.mutate(profile,revision,command),second.mutate(profile,revision,command)]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  state=await second.get(profile);assert.equal(state.materials.stamina,1002);assert.equal(state.poultry!.harvested,1);assert.equal(await sharedEggs(pool,profile),1,'a harvested egg is stocked on the river raft');
  await assert.rejects(()=>repo.mutate(profile,state.revision,command),/changed/);
  state=await repo.mutateLake!(profile,state.revision,{type:'transfer-building',entityId:'coop',sourceMap:'town',destinationMap:'lake',x:6,y:3},env);
  now+=3*hour;
  state=await repo.mutateLake!(profile,state.revision,{type:'build-raft',blueprintId:'insect-raiser',x:8,y:6},env);
  assert.equal(state.maps!.lake!.land.entities[0]!.poultry!.rate,2);
  now+=1.5*hour;state=await second.getLake!(profile);
  assert.equal(state.maps!.lake!.land.entities[0]!.poultry!.eggs,1,'insects double only future production');
  state=await second.mutateLake!(profile,state.revision,{type:'land-action',command:{...command,generation:1}},env);
  assert.equal(state.poultry!.harvested,2);assert.equal(await sharedEggs(pool,profile),2);assert.equal(state.materials.stamina,1001,'egg harvest keeps the insect-building stamina cost');
  state=await repo.mutateLake!(profile,state.revision,{type:'transfer-building',entityId:'coop',sourceMap:'lake',destinationMap:'town',x:6,y:3},env);
  assert.equal(state.entities[0]!.poultry!.rate,1);
  now+=6*hour;state=await second.get(profile);assert.equal(state.entities[0]!.poultry!.eggs,1);
  assert.equal(await sharedEggs(pool,profile),2,'moving and reads never add shared eggs');
 }finally{await pool.query('DELETE FROM families WHERE id=$1',[family]);await pool.end();}
});

test('friend lake views are scoped and private',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((s):s is string=>!!s));
 const pool=new Pool({connectionString:url,max:8}),db=createDatabase(url),repo=createTownRepository(pool,()=>1000);
 const family=randomUUID(),other=randomUUID(),viewer=randomUUID(),sibling=randomUUID(),owner=randomUUID(),token=randomUUID();
 try{
  await migrate(drizzle(pool),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  for(const id of [family,other])await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',[id,`${id}@lake-eggs.test`,'Lake eggs','unused']);
  for(const [id,parent,name]of [[viewer,family,'Visitor'],[sibling,family,'Sibling'],[owner,other,'Lake owner']])await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)',[id,parent,name,'🐥','#aabbcc']);
  const host=await repo.get(owner),kid=await repo.get(viewer);host.maps={lake:emptyLake(1000)};
  host.maps.lake!.rafts=[{id:'friendly',blueprintId:'friendly',x:8,y:7,paidCost:{wood:123},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false}];
  host.poultry={harvested:2};host.materials.stamina=999;host.learnedIds=['private-owner-learning'];host.maps.lake!.reserve.P3=42;
  kid.materials.stamina=7;kid.learnedIds=['visitor-learning'];
  for(const [id,state]of [[owner,host],[viewer,kid]] as const)await pool.query('UPDATE town_state SET state=$2 WHERE profile_id=$1',[id,JSON.stringify(state)]);
  const friend=await db.friendRequests.create(family,{requesting_scope:'profile',requesting_profile_id:viewer,target_scope:'profile',target_code:owner});
  assert.deepEqual(await repo.lakeFriends!(family,viewer),[]);await assert.rejects(()=>repo.readLakeVisit!(family,viewer,owner),/not available/);
  await db.friendRequests.respond(other,friend.id,true);
  assert.equal((await repo.lakeFriends!(family,viewer))[0]!.id,owner);
  assert.deepEqual(await repo.lakeFriends!(family,sibling),[]);await assert.rejects(()=>repo.readLakeVisit!(family,sibling,owner),/not available/);
  const visit=await repo.readLakeVisit!(family,viewer,owner);
  assert.equal(visit.state.materials.stamina,7);assert.deepEqual(visit.state.learnedIds,['visitor-learning']);
  assert.deepEqual(visit.state.maps!.lake!.reserve,{});assert.deepEqual(visit.state.maps!.lake!.rafts[0]!.paidCost,{});assert.doesNotMatch(JSON.stringify(visit),/private-owner-learning/);
  const config=loadConfig({NODE_ENV:'test',DATABASE_URL:url,ALLOWED_ORIGINS:'https://lake-eggs.example.test',ALLOWED_FORWARDED_HOSTS:'lake-eggs.example.test'});
  await pool.query('INSERT INTO sessions(id,token_hash,family_id,expires_at) VALUES($1,$2,$3,now()+interval \'1 hour\')',[randomUUID(),hashSessionToken(token),family]);
  const app=createApp({config,db:{...db,town:repo},logger:{info(){},warn(){},error(){}}}),base=`https://lake-eggs.example.test/api/v1/profiles/${viewer}/town/maps/lake/visits/${owner}`;
  assert.equal((await app.request(base)).status,401);
  const headers={origin:'https://lake-eggs.example.test',cookie:`${config.sessionCookieName}=${token}`,'Content-Type':'application/json'};
  assert.equal((await app.request(base+'/take-egg',{method:'POST',headers,body:'{}'})).status,404,'eggs are taken at the river raft, not in the lake');
  await pool.query('UPDATE friend_requests SET status=$2 WHERE id=$1',[friend.id,'rejected']);
  assert.equal((await app.request(base,{headers})).status,404);
 }finally{await pool.query('DELETE FROM families WHERE id=ANY($1::text[])',[[family,other]]);await pool.end();await db.close?.();}
});
