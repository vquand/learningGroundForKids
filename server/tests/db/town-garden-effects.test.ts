import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {fileURLToPath} from 'node:url';
import {assertSafeTestDatabaseUrl} from '../../src/db/test-database.ts';
import {createTownRepository} from '../../src/town-building/repository.ts';
import {emptyLake} from '../../src/town-building/maps/lake/game.ts';
import {freshPatch} from '../../src/town-building/garden.ts';
import {insectCycleRoll} from '../../src/town-building/gardenEffects.ts';
test('withered crops persist through checkpoints/moves and concurrent harvests never award or share the lost crop',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((s):s is string=>!!s)),pool=new Pool({connectionString:url,max:8}),family=randomUUID();
 let now=1000;const repo=createTownRepository(pool,()=>now),other=createTownRepository(pool,()=>now),env={season:'spring' as const,timeOfDay:'morning' as const,precipitation:'none' as const,localDate:'2026-10-25'};
 try{
  await migrate(drizzle(pool),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',[family,`${family}@garden-effects.test`,'Garden effects','unused']);
  for(const map of ['lake','town'] as const){
   const profile=randomUUID(),plot=Array.from({length:100},()=>randomUUID()).find(id=>insectCycleRoll(id,0)<.25)!;
   await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)',[profile,family,'Gardener','🌱','#aabbcc']);
   let state=await repo.get(profile);state.materials.stamina=100;state.maps={lake:emptyLake(now)};
   state.maps.lake!.land.entities=[{id:plot,blueprintId:'vegetable-patch',x:6,y:3,mapId:'lake',paidCost:{},garden:freshPatch('spring')},{id:randomUUID(),blueprintId:'coop',animal:'chicken',x:4,y:3,mapId:'lake',paidCost:{}}];
   state.maps.lake!.rafts=[{id:randomUUID(),blueprintId:'insect-raiser',x:8,y:6,paidCost:{},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false}];
   await pool.query('UPDATE town_state SET state=$2 WHERE profile_id=$1',[profile,JSON.stringify(state)]);
   // Continuous play: heartbeats every lease interval; pauses never credit time away.
   await repo.tickLake!(profile,env,true);for(let i=0;i<16;i++){now+=15000;await repo.tickLake!(profile,env,false);}await repo.pauseLake!(profile);state=await other.getLake!(profile);
   assert.equal(state.maps!.lake!.land.entities[0]!.garden!.slots.filter(s=>s.withered).length,1,'the loss persists across repository instances');
   if(map==='town')state=await repo.mutateLake!(profile,state.revision,{type:'transfer-building',entityId:plot,sourceMap:'lake',destinationMap:'town',x:6,y:3},env);
   const command={type:'harvest' as const,entityId:plot,generation:0},revision=state.revision;
   const harvest=(r:typeof repo)=>map==='lake'?r.mutateLake!(profile,revision,{type:'land-action',command},env):r.mutate(profile,revision,command,'spring',env);
   const race=await Promise.allSettled([harvest(repo),harvest(other)]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
   state=await other.get(profile);assert.equal(state.materials.stamina,106);
   const garden=(map==='lake'?state.maps!.lake!.land.entities:state.entities).find(e=>e.id===plot)!.garden!;
   assert.ok(garden.slots.every(s=>!s.withered&&s.growth===0&&s.generation===1));
   const stock=await pool.query('SELECT item_id FROM town_raft_items WHERE provider_id=$1',[profile]);assert.equal(stock.rowCount,3,'every map stocks the river raft, but a withered crop never enters it');
  }
 }finally{await pool.query('DELETE FROM families WHERE id=$1',[family]);await pool.end();}
});
test('floating-raft losses survive reloads; concurrent harvests pay each healthy plant exactly once',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((s):s is string=>!!s)),pool=new Pool({connectionString:url,max:8}),family=randomUUID(),profile=randomUUID();
 let now=1000;const repo=createTownRepository(pool,()=>now),other=createTownRepository(pool,()=>now),env={season:'spring' as const,timeOfDay:'morning' as const,precipitation:'none' as const,localDate:'2026-10-25'};
 try{
  await migrate(drizzle(pool),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',[family,`${family}@raft-effects.test`,'Raft effects','unused']);
  await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)',[profile,family,'Gardener','🌱','#aabbcc']);
  let state=await repo.get(profile);state.materials.stamina=100;state.maps={lake:emptyLake(now)};
  const id=Array.from({length:100},()=>randomUUID()).find(id=>insectCycleRoll(id,0)<.25)!;
  state.maps.lake!.rafts=[{id,blueprintId:'floating-garden',x:12,y:7,paidCost:{},generation:0,fish:[],plant:'water-spinach',plantGrowth:0,duckBoosted:true,feeder:false},{id:randomUUID(),blueprintId:'floating-insect-raiser',x:11,y:10,paidCost:{},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false}];
  await pool.query('UPDATE town_state SET state=$2 WHERE profile_id=$1',[profile,JSON.stringify(state)]);
  await repo.tickLake!(profile,env,true);for(let i=0;i<20;i++){now+=15000;await repo.tickLake!(profile,env,false);}await repo.pauseLake!(profile);state=await other.getLake!(profile);
  const raft=state.maps!.lake!.rafts[0]!,lost=raft.witheredPlants!.length;assert.ok(lost===1||lost===2);assert.equal(raft.duckBoosted,true);
  const revision=state.revision,command={type:'harvest-plant' as const,raftId:id,generation:0};
  const race=await Promise.allSettled([repo.mutateLake!(profile,revision,command,env),other.mutateLake!(profile,revision,command,env)]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  state=await other.get(profile);assert.equal(state.materials.stamina,100+(6-lost)*4);assert.equal(state.maps!.lake!.plantsHarvested,6-lost);
  const planted=state.maps!.lake!.rafts[0]!;assert.equal(planted.witheredPlants,undefined);assert.equal(planted.plantGrowth,0);assert.equal(planted.plantCycle,1);assert.equal(planted.duckBoosted,false);
 }finally{await pool.query('DELETE FROM families WHERE id=$1',[family]);await pool.end();}
});
