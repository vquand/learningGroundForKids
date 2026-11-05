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
test('queued fish persist across repository reloads and concurrent final harvests replace the batch exactly once',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((s):s is string=>!!s)),pool=new Pool({connectionString:url,max:8}),family=randomUUID(),profile=randomUUID(),raftId=randomUUID();
 const repo=createTownRepository(pool,()=>1000),other=createTownRepository(pool,()=>1000),env={season:'spring' as const,timeOfDay:'morning' as const,precipitation:'none' as const,localDate:'2026-10-25'};
 try{
  await migrate(drizzle(pool),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',[family,`${family}@next-fish.test`,'Next fish','unused']);
  await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)',[profile,family,'Fisher','🐟','#aabbcc']);
  for(const species of ['P3','P5'])for(let i=0;i<10;i++)await pool.query('INSERT INTO fishing_cast_results(profile_id,cast_id,location,fish_id,stamina,points) VALUES($1,$2,$3,$4,1,1)',[profile,randomUUID(),'pond',species]);
  let state=await repo.get(profile);state.materials.stamina=100;state.maps={lake:emptyLake(1000)};
  state.maps.lake!.rafts=[{id:raftId,blueprintId:'nursery',x:8,y:12,paidCost:{},generation:0,fish:Array.from({length:4},()=>({id:randomUUID(),species:'P3' as const,growth:300})),plant:null,plantGrowth:0,feeder:false}];
  const old=structuredClone(state.maps.lake!.rafts[0]!.fish);
  await pool.query('UPDATE town_state SET state=$2 WHERE profile_id=$1',[profile,JSON.stringify(state)]);
  state=await repo.mutateLake!(profile,state.revision,{type:'set-next-fish',raftId,species:'P5'},env);state=await other.getLake!(profile);
  assert.equal(state.maps!.lake!.rafts[0]!.nextFish,'P5');assert.deepEqual(state.maps!.lake!.rafts[0]!.fish,old);
  const revision=state.revision,command={type:'harvest-fish' as const,raftId,generation:state.maps!.lake!.rafts[0]!.generation};
  const race=await Promise.allSettled([repo.mutateLake!(profile,revision,command,env),other.mutateLake!(profile,revision,command,env)]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  state=await other.get(profile);const raft=state.maps!.lake!.rafts[0]!;
  assert.equal(raft.nextFish,undefined);assert.equal(raft.fish.length,4);assert.ok(raft.fish.every(f=>f.species==='P5'&&f.growth===0&&!old.some(o=>o.id===f.id)));
  assert.equal(state.materials.stamina,108);assert.equal(state.maps!.lake!.reserve.P3,4);assert.equal(state.maps!.lake!.harvested,4);assert.equal(state.maps!.lake!.collections,1);
 }finally{await pool.query('DELETE FROM families WHERE id=$1',[family]);await pool.end();}
});
