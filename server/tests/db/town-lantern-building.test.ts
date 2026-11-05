import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {assertSafeTestDatabaseUrl} from '../../src/db/test-database.js';
import {createTownRepository} from '../../src/town-building/repository.js';
import {initialTown} from '../../src/town-building/game.js';

const configured=process.env.TEST_DATABASE_URL;
test('lantern construction persists once across concurrent API processes and cleans up after Halloween',{skip:configured?false:'TEST_DATABASE_URL is not configured'},async()=>{
 const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((v):v is string=>!!v),process.env.ALLOW_NONLOCAL_TEST_DATABASE);
 const pool=new Pool({connectionString:url,max:4,connectionTimeoutMillis:3000}),tag=`lantern-building-${randomUUID()}`,kid=`${tag}-kid`;
 const clock={localDate:'2026-10-30',timeOfDay:'morning',localTime:'10:00'};
 let now=1000;const left=createTownRepository(pool,()=>now),right=createTownRepository(pool,()=>now);
 try{
  await migrate(drizzle({client:pool}),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  await pool.query('INSERT INTO families(id,email,display_name,password_hash,role) VALUES ($1,$2,$3,$4,$5)',[tag,`${tag}@example.test`,'Lantern test','not-a-real-password','family']);
  await pool.query('INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES ($1,$2,$3,$4,$5,$6)',[kid,tag,'Builder','star','green',kid]);
  const seed=initialTown();seed.materials.wood=1;seed.storage={built:false,crops:{pumpkin:1},milk:[],fish:{}};
  await pool.query('INSERT INTO town_state(profile_id,state) VALUES ($1,$2)',[kid,JSON.stringify(seed)]);
  const build={type:'build' as const,blueprintId:'halloween-lantern',x:8,y:12,direction:'back' as const};
  const results=await Promise.allSettled([left.mutate(kid,0,build,'autumn',clock),right.mutate(kid,0,{...build,y:13},'autumn',clock)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const restarted=createTownRepository(pool,()=>now),saved=await restarted.get(kid),lamps=saved.entities.filter(e=>e.blueprintId==='halloween-lantern');
  assert.equal(lamps.length,1);assert.equal(lamps[0]!.direction,'back');assert.equal(saved.materials.wood,0);assert.equal(saved.storage!.crops.pumpkin,undefined);
  await assert.rejects(()=>restarted.mutate(kid,saved.revision,{...build,y:14},'autumn',clock),/materials/);
  await assert.rejects(()=>restarted.mutate(kid,saved.revision,{...build,y:14},'autumn',{...clock,localDate:'2026-11-01'}),/Halloween/);
  now=2000;await restarted.tick!(kid,'town',{...clock,localDate:'2026-11-01',season:'autumn',precipitation:'none'},true);
  const cleaned=await createTownRepository(pool,()=>now).get(kid);assert.equal(cleaned.entities.some(e=>e.blueprintId==='halloween-lantern'),false);assert.equal(cleaned.materials.wood,0);assert.ok(cleaned.entities.some(e=>e.blueprintId==='house'));
 }finally{await pool.query('DELETE FROM families WHERE id=$1',[tag]);await pool.end();}
});
