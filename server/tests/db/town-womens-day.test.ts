import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {assertSafeTestDatabaseUrl} from '../../src/db/test-database.js';
import {createTownRepository} from '../../src/town-building/repository.js';
import {createParentReportRepository} from '../../src/parent-reports/repository.js';
import {womensDayProgress} from '../../src/town-building/events/womensDayProgress.js';
import {WOMENS_DAY_ACHIEVEMENTS} from '../../src/town-building/events/womensDayAchievements.js';
const configured=process.env.TEST_DATABASE_URL;
test('concurrent event greetings persist once, survive cleanup/reload, and appear in the shared parent/admin report',{skip:configured?false:'TEST_DATABASE_URL is not configured'},async()=>{
 const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((v):v is string=>!!v),process.env.ALLOW_NONLOCAL_TEST_DATABASE),pool=new Pool({connectionString:url,max:8});
 const family=`womens-day-test-${randomUUID()}`,kid=`${family}-kid`,future=`${family}-future`,sibling=`${family}-sibling`,clock={season:'autumn' as const,localDate:'2026-10-20',timeOfDay:'noon',isDay:true,precipitation:'none' as const};
 try{
  await migrate(drizzle({client:pool}),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  await pool.query('INSERT INTO families(id,email,display_name,password_hash,role) VALUES($1,$2,$3,$4,$5)',[family,`${family}@example.test`,'Event test','not-a-password','family']);
  for(const id of [kid,future,sibling])await pool.query('INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES($1,$2,$3,$4,$5,$6)',[id,family,'Guest','star','pink',id]);
  const a=createTownRepository(pool,()=>1000),b=createTownRepository(pool,()=>2000);
  await Promise.all([a.celebrate!(kid,{type:'visit'},clock),b.celebrate!(kid,{type:'visit'},clock)]);
  for(const day of [19,20,21])await a.celebrate!(kid,{type:'dismiss-intro'},{...clock,localDate:`2026-10-${day}`});
  for(let i=1;i<=7;i++)await Promise.all([a.celebrate!(kid,{type:'greet',visitorId:`flower-${i}`},clock),b.celebrate!(kid,{type:'greet',visitorId:`flower-${i}`},clock)]);
  const saved=await createTownRepository(pool).get(kid);assert.deepEqual(womensDayProgress(saved).metrics,{womensDay2026Visited:1,womensDay2026Greeted:7});assert.ok(WOMENS_DAY_ACHIEVEMENTS.every(badge=>saved.earned[badge.id]));
  assert.deepEqual((saved.events!['womens-day']!.data as {introSeenDates:string[]}).introSeenDates,['2026-10-19','2026-10-20','2026-10-21']);
  const siblingVisit=await a.celebrate!(sibling,{type:'visit'},clock);assert.equal((siblingVisit.events!['womens-day']!.data as {introSeenDates?:string[]}).introSeenDates,undefined,'a sibling still has their own unseen card');
  const siblingDismiss=await a.celebrate!(sibling,{type:'dismiss-intro'},clock);assert.deepEqual((siblingDismiss.events!['womens-day']!.data as {introSeenDates:string[]}).introSeenDates,['2026-10-20']);
  const again=await a.celebrate!(kid,{type:'greet',visitorId:'flower-7'},clock);assert.equal(again.revision,saved.revision);assert.deepEqual(again.earned,saved.earned);
  const beforeSql=await pool.query('SELECT state FROM town_state WHERE profile_id=$1',[kid]);
  const catalogSql=await readFile(new URL('../../../docs/migrations/neon-womens-day-2026-achievements.sql',import.meta.url),'utf8');
  const sqlClient=await pool.connect();
  try{
   await sqlClient.query(catalogSql);
   await sqlClient.query("UPDATE achievement_definitions SET definition='{}'::jsonb WHERE id='womens-day-2026-guest'");
   await sqlClient.query(catalogSql);
   const installed=await sqlClient.query("SELECT definition FROM achievement_definitions WHERE group_id='womens-day-2026' ORDER BY (definition->>'badgeIndex')::integer");
   assert.deepEqual(installed.rows.map(row=>row.definition),WOMENS_DAY_ACHIEVEMENTS,'Neon SQL matches reviewed definitions and updates stale catalog entries');
   assert.deepEqual((await sqlClient.query('SELECT state FROM town_state WHERE profile_id=$1',[kid])).rows,beforeSql.rows,'repeated catalog SQL preserves earned badges, receipts and card history');
  }finally{sqlClient.release();}
  await a.tick!(kid,'town',{...clock,localDate:'2026-10-22'},true);const expired=await b.get(kid);assert.equal(expired.events?.['womens-day'],undefined);assert.equal(womensDayProgress(expired).greeted,7);assert.deepEqual(expired.earned,saved.earned);assert.deepEqual(expired.materials,saved.materials);
  const report=await createParentReportRepository(pool).read(family),group=report.children.find(c=>c.id===kid)!.games.find(g=>g.id==='womens-day-2026')!;
  assert.equal(group.name,'20/10/2026');assert.deepEqual(group.metrics.map(m=>m.value),[1,7]);assert.ok(group.achievements.every(badge=>badge.earned));
  await a.celebrate!(future,{type:'visit'},{...clock,localDate:'2027-10-20'});for(let i=1;i<=7;i++)await b.celebrate!(future,{type:'greet',visitorId:`flower-${i}`},{...clock,localDate:'2027-10-20'});assert.deepEqual((await a.get(future)).earned,{});
 }finally{await pool.query('DELETE FROM families WHERE id=$1',[family]);await pool.end();}
});
