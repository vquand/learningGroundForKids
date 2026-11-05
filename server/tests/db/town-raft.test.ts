import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {fileURLToPath} from 'node:url';
import {assertSafeTestDatabaseUrl} from '../../src/db/test-database.js';
import {createTownRaftRepository} from '../../src/town-building/raft.js';
import {createTownBasketsRepository} from '../../src/town-building/baskets.js';
import {stockRaftCatch,stockRaftItem} from '../../src/town-building/raftStock.js';
import {initialTown} from '../../src/town-building/game.js';
const configured=process.env.TEST_DATABASE_URL;
test('rafts count new fish only, cap fresh stock, split pickups exactly once, enforce global daily quota and replay visit summaries',{skip:configured?false:'TEST_DATABASE_URL is not configured'},async()=>{
 const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((v):v is string=>!!v),process.env.ALLOW_NONLOCAL_TEST_DATABASE);
 const pool=new Pool({connectionString:url,max:8}),tag=`raft-${randomUUID()}`,a=tag+'-a',b=tag+'-b';let now=Date.UTC(2026,9,23,12);
 const picker=a+'-0',sibling=a+'-1',provider=b+'-0',other=b+'-1',raft=createTownRaftRepository(pool,()=>now),baskets=createTownBasketsRepository(pool,()=>now);
 async function stock(id:string,key:string,time=now){const client=await pool.connect();try{await client.query('BEGIN');await stockRaftItem(client,id,key,'vegetable','carrot',2,time);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
 const stamina=async(id:string)=>Number((await pool.query("SELECT state->'materials'->>'stamina' AS value FROM town_state WHERE profile_id=$1",[id])).rows[0].value);
 try{
  await migrate(drizzle({client:pool}),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  for(const family of [a,b]){await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$1,$3)',[family,`${family}@example.test`,'unused']);for(let i=0;i<2;i++){const id=family+'-'+i;await pool.query('INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES($1,$2,$1,$3,$4,$1)',[id,family,'⭐','green']);await pool.query('INSERT INTO town_state(profile_id,state) VALUES($1,$2)',[id,JSON.stringify(initialTown())]);}}
  assert.equal((await raft.get(b,provider)).fishCaught,0,'no historical catches are backfilled');
  const client=await pool.connect();try{await client.query('BEGIN');for(let i=0;i<49;i++)await stockRaftCatch(client,provider,'new-cast-'+i,'P1',now);await stockRaftCatch(client,provider,'turtle','T1',now);await client.query('COMMIT');}finally{client.release();}
  assert.equal((await raft.get(b,provider)).fishCaught,49);assert.equal((await raft.get(b,provider)).unlocked,false);
  const c2=await pool.connect();try{await c2.query('BEGIN');await stockRaftCatch(c2,provider,'new-cast-50','R5',now);await c2.query('COMMIT');}finally{c2.release();}
  let state=await raft.get(b,provider);assert.equal(state.unlocked,true);assert.equal(state.items.length,10);
  await assert.rejects(()=>raft.get(a,picker,provider),/not available/);
  await pool.query(`INSERT INTO friend_requests(id,requesting_family_id,requesting_scope,requesting_label,target_family_id,target_scope,target_label,target_code,requester_message,status) VALUES($1,$2,'family','From',$3,'family','To','CODE','Hi','accepted')`,[tag,a,b]);
  await pool.query('INSERT INTO town_raft_progress(profile_id,fish_caught) VALUES($1,50)',[other]);
  const visitId=randomUUID();await raft.visit(a,picker,provider,visitId);await raft.visit(a,picker,provider,visitId);
  await baskets.send(a,picker,provider,{requestId:randomUUID(),decoration:'flowers',message:0});
  const input={requestId:randomUUID(),itemId:state.items[0]!.id};
  const before=await stamina(provider);const first=await raft.pick(a,picker,provider,input);assert.equal(first.receipt.stamina,1);assert.equal(first.providerStamina,1);
  const retry=await raft.pick(a,picker,provider,input);assert.equal(retry.newlyPicked,false);assert.equal(await stamina(provider),before+1);assert.equal(await stamina(picker),1);
  await assert.rejects(()=>raft.pick(a,sibling,provider,{requestId:randomUUID(),itemId:input.itemId}),/not available/);
  const arrival=randomUUID(),report=await raft.arrive(b,provider,arrival);assert.equal(report.hasNew,true);assert.equal(report.report.visitors[0]!.visits,1);assert.equal(report.report.visitors[0]!.gifts,1);assert.equal(report.report.items,1);assert.equal(report.report.stamina,1);
  assert.equal((await raft.arrive(b,provider,arrival)).hasNew,true,'lost arrival replies replay the same popup');
  const quiet=await raft.arrive(b,provider,randomUUID());assert.equal(quiet.hasNew,false);assert.deepEqual(quiet.report,report.report,'the raft can reopen the saved report');
  await raft.visit(a,sibling,provider,randomUUID());
  const plainVisit=await raft.arrive(b,provider,randomUUID());
  assert.equal(plainVisit.hasNew,true);assert.equal(plainVisit.report.visitors[0]!.gifts,0);
  assert.equal(plainVisit.report.items,0);assert.equal(plainVisit.report.stamina,0);
  for(let i=1;i<30;i++){
   const target=i%2?other:provider;await stock(target,'quota-'+i);const items=(await raft.get(a,picker,target)).items;
   await raft.pick(a,picker,target,{requestId:randomUUID(),itemId:items[0]!.id});
  }
  assert.equal((await raft.get(a,picker,provider)).remainingToday,0);
  await stock(other,'one-too-many');await assert.rejects(async()=>raft.pick(a,picker,other,{requestId:randomUUID(),itemId:(await raft.get(a,picker,other)).items[0]!.id}),/30 river items/);
  await stock(provider,'race');state=await raft.get(a,sibling,provider);
  const race=await Promise.allSettled([raft.pick(a,sibling,provider,{requestId:randomUUID(),itemId:state.items[0]!.id}),raft.pick(a,sibling,provider,{requestId:randomUUID(),itemId:state.items[0]!.id})]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await raft.get(a,picker,provider)).days.length,0,'visitors cannot read owner analytics');
  assert.ok((await raft.get(b,provider)).days.reduce((n,d)=>n+d.stamina,0)>0);
  now+=3*86400000;state=await raft.get(a,picker,provider);assert.equal(state.items.length,0);assert.equal(state.unlocked,true);assert.equal(state.remainingToday,30);assert.ok((await raft.get(b,provider)).days.reduce((n,d)=>n+d.stamina,0)>0,'diary survives stock expiry');
  await stock(provider,'fresh-vegetable');state=await raft.get(a,picker,provider);const vegetable=await raft.pick(a,picker,provider,{requestId:randomUUID(),itemId:state.items[0]!.id});assert.equal(vegetable.receipt.stamina,1);assert.equal(vegetable.providerStamina,2);
  await raft.arrive(b,provider,randomUUID());
  for(let i=0;i<5;i++)await stock(provider,'batch-'+i);
  const batchIds=(await raft.get(a,picker,provider)).items.map(item=>item.id),batch={requestId:randomUUID(),itemIds:batchIds};
  const pickerBefore=await stamina(picker),providerBefore=await stamina(provider);
  const batchResult=await raft.pick(a,picker,provider,batch);assert.equal(batchResult.receipt.stamina,5);assert.equal(batchResult.providerStamina,10);
  assert.equal(await stamina(picker),pickerBefore+5);assert.equal(await stamina(provider),providerBefore+10);
  assert.equal((await raft.pick(a,picker,provider,{...batch,itemIds:[...batchIds].reverse()})).newlyPicked,false);
  assert.equal(await stamina(picker),pickerBefore+5);
  await assert.rejects(()=>raft.pick(a,picker,provider,{...batch,itemIds:batchIds.slice(0,1)}),/not available/);
  await assert.rejects(()=>raft.pick(a,picker,provider,{requestId:randomUUID(),itemIds:[...batchIds,randomUUID()]}),/five items/);
  await stock(provider,'valid-after-batch');const valid=(await raft.get(a,picker,provider)).items[0]!;
  await assert.rejects(()=>raft.pick(a,picker,provider,{requestId:randomUUID(),itemIds:[valid.id,randomUUID()]}),/not available/);
  assert.ok((await raft.get(a,picker,provider)).items.some(item=>item.id===valid.id),'partial unavailable batch rolls back every item');
  const combinedReport=await raft.arrive(b,provider,randomUUID());assert.equal(combinedReport.report.items,5);assert.equal(combinedReport.report.stamina,10);
  now+=3*86400000;await stock(provider,'after-batch-expiry');
  assert.equal((await raft.pick(a,picker,provider,batch)).newlyPicked,false,'batch receipt survives perishable stock cleanup');
  assert.equal(await stamina(picker),pickerBefore+5);
  await pool.query("UPDATE friend_requests SET status='rejected' WHERE id=$1",[tag]);await assert.rejects(()=>raft.pick(a,picker,provider,{requestId:randomUUID(),itemId:state.items[0]!.id}),/not available/);
 }finally{await pool.query('DELETE FROM town_river_events WHERE owner_id=ANY($1)',[[provider,other]]);await pool.query('DELETE FROM families WHERE id=ANY($1)',[[a,b]]);await pool.end();}
});
