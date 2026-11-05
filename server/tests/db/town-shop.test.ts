import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {assertSafeTestDatabaseUrl} from '../../src/db/test-database.ts';
import {createTownRepository} from '../../src/town-building/repository.ts';
import {emptyTown,type TownState} from '../../src/town-building/game.ts';
import {AppError} from '../../src/errors.ts';
const configured=process.env.TEST_DATABASE_URL;
test('shop: read-only quote, rollback, concurrent duplicate across repository instances, once-only spend',{skip:configured?false:'TEST_DATABASE_URL is not configured'},async()=>{
 const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((v):v is string=>!!v));
 const pool=new Pool({connectionString:url,max:4}),family=randomUUID(),profile=randomUUID();
 const now=Date.UTC(2026,10,3),a=createTownRepository(pool,()=>now),b=createTownRepository(pool,()=>now);
 try{
  await migrate(drizzle(pool),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  await pool.query('INSERT INTO families(id,email,display_name,password_hash,role) VALUES($1,$2,$3,$4,$5)',[family,`${family}@shop.test`,'Shop test','unused','admin']);
  await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)',[profile,family,'Shop child','apple','green']);
  const s=emptyTown();s.woolMigrated=true;s.entities.push({id:'shop',blueprintId:'vegetable-shop',x:5,y:10,paidCost:{}});s.storage={built:false,crops:{},wool:10,milk:[],fish:{}};
  await pool.query('INSERT INTO town_state(profile_id,state) VALUES($1,$2)',[profile,JSON.stringify(s)]);
  const read=async()=>{const r=await pool.query<{state:TownState;version:string}>('SELECT state,xmin::text AS version FROM town_state WHERE profile_id=$1',[profile]);return r.rows[0]!;};
  const input={entityId:'shop',crop:'carrot',quantity:1} as const,before=await read();
  const q=await a.shopQuote!(profile,'town',input,{});assert.deepEqual(await read(),before);
  const cmd={...input,type:'shop-trade' as const,confirmation:q.confirmation};
  for(const [revision,confirmation,code] of [[1,q.confirmation,'TOWN_STALE'],[0,'0'.repeat(64),'SHOP_QUOTE_CHANGED']] as const){
   await assert.rejects(()=>a.shopTrade!(profile,'town',revision,{...cmd,confirmation},{}),(e:unknown)=>e instanceof AppError&&e.code===code);assert.deepEqual(await read(),before);
  }
  const results=await Promise.all([a.shopTrade!(profile,'town',0,cmd,{}),b.shopTrade!(profile,'town',0,cmd,{})]);
  assert.equal(results.filter(r=>r.receipt.duplicate).length,1);assert.equal(results[0]!.receipt.id,results[1]!.receipt.id);
  const after=await read();assert.equal(after.state.revision,1);assert.equal(after.state.storage?.wool,8);assert.equal(after.state.storage?.crops.carrot,1);
  const retry=await b.shopTrade!(profile,'town',0,cmd,{});assert.equal(retry.receipt.duplicate,true);assert.deepEqual(await read(),after);
  after.state.storage!.crops.carrot=10;
  await pool.query('UPDATE town_state SET state=$2 WHERE profile_id=$1',[profile,JSON.stringify(after.state)]);
  const full=await read(),fq=await a.shopQuote!(profile,'town',input,{});
  await assert.rejects(()=>a.shopTrade!(profile,'town',1,{...cmd,confirmation:fq.confirmation},{}),(e:unknown)=>e instanceof AppError&&e.code==='SHOP_STORAGE_FULL');assert.deepEqual(await read(),full);
 }finally{await pool.query('DELETE FROM families WHERE id=$1',[family]);await pool.end();}
});
