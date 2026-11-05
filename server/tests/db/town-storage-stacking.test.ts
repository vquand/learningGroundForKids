import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {assertSafeTestDatabaseUrl} from '../../src/db/test-database.ts';
import {createTownRepository} from '../../src/town-building/repository.ts';
import {AppError} from '../../src/errors.ts';
import type {StorageRemovalReceipt} from '../../src/town-building/storage.ts';
const configured=process.env.TEST_DATABASE_URL;
test('storage removal rolls back preview and stale requests, then commits loss once under lock',{skip:configured?false:'TEST_DATABASE_URL is not configured'},async()=>{
 const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((v):v is string=>!!v));
 const pool=new Pool({connectionString:url,max:4}),family=randomUUID(),profile=randomUUID(),repo=createTownRepository(pool,()=>1000);
 try{
  await migrate(drizzle(pool),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  await pool.query('INSERT INTO families(id,email,display_name,password_hash,role) VALUES($1,$2,$3,$4,$5)',[family,`${family}@storage.test`,'Storage test','unused','admin']);
  await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)',[profile,family,'Storage child','apple','green']);
  const state=await repo.get(profile);state.entities.push({id:'store',blueprintId:'town-storage',x:8,y:8,paidCost:{}});
  state.storage={built:true,crops:{corn:20},milk:[],fish:{}};
  await pool.query('UPDATE town_state SET state=$2 WHERE profile_id=$1',[profile,JSON.stringify(state)]);
  const before=(await pool.query('SELECT state FROM town_state WHERE profile_id=$1',[profile])).rows[0].state;
  let receipt:StorageRemovalReceipt|undefined;
  const command={type:'remove' as const,entityId:'store'};
  await assert.rejects(()=>repo.mutate(profile,state.revision,command),(e:unknown)=>{if(!(e instanceof AppError)||e.code!=='STORAGE_LOSS_CONFIRM')return false;receipt=e.details as StorageRemovalReceipt;return true;});
  assert.deepEqual((await pool.query('SELECT state FROM town_state WHERE profile_id=$1',[profile])).rows[0].state,before);
  assert.ok(receipt);
  await assert.rejects(()=>repo.mutate(profile,state.revision+1,command),(e:unknown)=>e instanceof AppError&&e.code==='TOWN_STALE');
  const confirmed={...command,confirmLoss:true,lossConfirmation:receipt.confirmation};
  const outcomes=await Promise.allSettled([repo.mutate(profile,state.revision,confirmed),repo.mutate(profile,state.revision,confirmed)]);
  assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
  const after=await repo.get(profile);assert.equal(after.revision,state.revision+1);assert.equal(after.storage?.crops.corn,10);assert.equal(after.entities.some(e=>e.id==='store'),false);
 }finally{await pool.query('DELETE FROM families WHERE id=$1',[family]);await pool.end();}
});
