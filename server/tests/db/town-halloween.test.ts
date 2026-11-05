import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {assertSafeTestDatabaseUrl} from '../../src/db/test-database.js';
import {createTownRepository} from '../../src/town-building/repository.js';
import {initialTown} from '../../src/town-building/game.js';
import {createParentReportRepository} from '../../src/parent-reports/repository.js';
import {freshPatch} from '../../src/town-building/garden.js';
const configured=process.env.TEST_DATABASE_URL;
test('two API processes persist one pumpkin reward, resume jobs after reload, and remove November decorations', {skip:configured?false:'TEST_DATABASE_URL is not configured'}, async()=>{
 const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((v):v is string=>!!v),process.env.ALLOW_NONLOCAL_TEST_DATABASE);
 const pool=new Pool({connectionString:url,max:4}),tag=`halloween-test-${randomUUID()}`,kid=`${tag}-kid`;
 let now=1000;const left=createTownRepository(pool,()=>now),right=createTownRepository(pool,()=>now);
 const weather={season:'autumn' as const,localDate:'2026-10-31',timeOfDay:'night',isDay:false,precipitation:'none' as const,weatherSource:'live'};
 try{
  await migrate(drizzle({client:pool}),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  await pool.query('INSERT INTO families(id,email,display_name,password_hash,role) VALUES ($1,$2,$3,$4,$5)',[tag,`${tag}@example.test`,'Halloween test','not-a-real-password','family']);
  await pool.query('INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES ($1,$2,$3,$4,$5,$6)',[kid,tag,'Gardener','star','green',kid]);
  const seed=initialTown();seed.entities.push({id:'patch',blueprintId:'vegetable-patch',x:8,y:14,paidCost:{},garden:freshPatch('autumn')});const garden=seed.entities.at(-1)!.garden!;garden.crop='pumpkin';garden.slots.forEach((s,i)=>{s.crop='pumpkin';s.growth=i===0?300:0;});
  seed.eventHistory={'halloween-pumpkins':{'2026':{edition:'2026-v1',counters:{'lanterns-created':{count:20,receipts:Array.from({length:20},(_,i)=>`prior-${i}`)}}}}};
  await pool.query('INSERT INTO town_state(profile_id,state) VALUES ($1,$2)',[kid,JSON.stringify(seed)]);
  await left.tick!(kid,'town',weather,true);await right.tick!(kid,'town',weather,true);
  now=6000;await Promise.all([left.tick!(kid,'town',weather,false),right.tick!(kid,'town',weather,false)]);
  now=11000;const outcomes=await Promise.allSettled([left.tick!(kid,'town',weather,false),right.tick!(kid,'town',weather,false)]);assert.ok(outcomes.some(r=>r.status==='fulfilled'));
  const stored=async()=>(await pool.query('SELECT state FROM town_state WHERE profile_id=$1',[kid])).rows[0].state;
  let saved=await stored();assert.equal(saved.materials.stamina,2);assert.equal(saved.eventHistory['halloween-pumpkins']['2026'].counters['lanterns-created'].count,20);assert.equal(saved.halloween,undefined);assert.equal(saved.events['halloween-pumpkins'].edition,'2026-v1');assert.equal(saved.events['halloween-pumpkins'].data.jobs.filter((j:any)=>j.harvested).length,1);assert.equal(saved.entities.at(-1).garden.slots[0].generation,1);
  now=1000000;const reloaded=createTownRepository(pool,()=>now);await reloaded.tick!(kid,'town',weather,true);now+=10000;await reloaded.tick!(kid,'town',weather,false);
  saved=await stored();assert.equal(saved.materials.stamina,2);assert.equal(saved.events['halloween-pumpkins'].data.lanterns.length,1);assert.equal(saved.gardening.harvests,0);assert.ok(saved.earned['halloween-ghostly-sky']);
  const api=await reloaded.get(kid);assert.equal(api.halloween!.lanterns.length,1);assert.ok(api.earned['halloween-ghostly-sky']);
  now+=5000;await reloaded.tick!(kid,'town',{...weather,localDate:'2026-11-01'},false);saved=await stored();assert.equal(saved.halloween,undefined);assert.equal(saved.events['halloween-pumpkins'],undefined);assert.equal(saved.eventHistory['halloween-pumpkins']['2026'].counters['lanterns-created'].count,21);assert.equal(saved.materials.stamina,2);
 const report=await createParentReportRepository(pool).read(tag);const halloween=report.children[0]!.games.find(g=>g.id==='halloween')!;assert.equal(halloween.metrics[0]!.value,21);assert.equal(halloween.achievements[0]!.earned,true);
 }finally{await pool.query('DELETE FROM families WHERE id=$1',[tag]);await pool.end();}
});
