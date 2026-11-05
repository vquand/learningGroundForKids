import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {fileURLToPath} from 'node:url';
import {assertSafeTestDatabaseUrl} from '../../src/db/test-database.js';
import {stockRaftHarvest,stockRaftItem} from '../../src/town-building/raftStock.js';
import {RAFT_CAPACITY} from '../../src/town-building/raftCatalog.js';
import {initialTown,type TownState} from '../../src/town-building/game.js';
const configured=process.env.TEST_DATABASE_URL;
test('a large egg harvest stocks the raft in one batch up to capacity, in order, without duplicates',{skip:configured?false:'TEST_DATABASE_URL is not configured'},async()=>{
 const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((v):v is string=>!!v),process.env.ALLOW_NONLOCAL_TEST_DATABASE);
 const pool=new Pool({connectionString:url,max:2}),family=`harvest-${randomUUID()}`,id=family+'-0',now=Date.UTC(2026,9,23,12);
 const eggs=(harvested:number):TownState=>({...initialTown(),poultry:{harvested}});
 const inTransaction=async(work:(client:import('pg').PoolClient)=>Promise<void>)=>{const client=await pool.connect();try{await client.query('BEGIN');await work(client);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}};
 const keys=async()=>(await pool.query('SELECT source_key FROM town_raft_items WHERE provider_id=$1 ORDER BY source_key',[id])).rows.map(r=>r.source_key as string);
 try{
  await migrate(drizzle({client:pool}),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$1,$3)',[family,`${family}@example.test`,'unused']);
  await pool.query('INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES($1,$2,$1,$3,$4,$1)',[id,family,'⭐','green']);
  // An already-stocked egg never takes a second slot.
  await inTransaction(client=>stockRaftItem(client,id,'egg:2','egg','egg',1,now));
  await inTransaction(client=>stockRaftHarvest(client,id,eggs(0),eggs(24),now));
  const stocked=await keys();
  assert.equal(stocked.length,RAFT_CAPACITY);
  assert.deepEqual(stocked,Array.from({length:RAFT_CAPACITY},(_,i)=>`egg:${i+1}`).sort(),'the earliest new eggs fill the remaining slots in order');
  await inTransaction(client=>stockRaftHarvest(client,id,eggs(0),eggs(24),now));
  assert.equal((await keys()).length,RAFT_CAPACITY,'a full raft and replayed eggs add nothing');
 }finally{
  await pool.query('DELETE FROM families WHERE id=$1',[family]);await pool.end();
 }
});
