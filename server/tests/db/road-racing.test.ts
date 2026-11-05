import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { createRoadRacingRepository } from '../../src/road-racing/repository.js';
import { createTownRepository } from '../../src/town-building/repository.js';
import { createParentReportRepository } from '../../src/parent-reports/repository.js';
import { createDatabase } from '../../src/db/index.js';
import { ACHIEVEMENT_GROUPS } from '../../src/achievement-catalog.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { hashSessionToken } from '../../src/auth.js';
import { emptyProgress, startRace, type Progress } from '../../src/road-racing/game.js';
const configured=process.env.TEST_DATABASE_URL;
test('race transactions deduplicate final rewards, protect ownership, and share all badges across kid/Parent/Admin reports', {skip:configured?false:'TEST_DATABASE_URL is not configured'},async()=>{
  const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((v):v is string=>!!v),process.env.ALLOW_NONLOCAL_TEST_DATABASE);
  const pool=new Pool({connectionString:url}),db=createDatabase(url);let now=1000;
  const race=createRoadRacingRepository(pool,()=>now),town=createTownRepository(pool),reports=createParentReportRepository(pool);
  const family=`road-${randomUUID()}`,kid=`${family}-kid`,sibling=`${family}-sibling`,token=randomUUID();
  async function privateState(){return(await pool.query<{state:Progress}>('SELECT state FROM road_racing_progress WHERE profile_id=$1',[kid])).rows[0]!.state;}
  try {
    await migrate(drizzle({client:pool}),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
    await pool.query("INSERT INTO families(id,email,display_name,password_hash,role) VALUES($1,$2,'Road family','unused','admin')",[family,`${family}@example.test`]);
    for(const id of [kid,sibling])await pool.query("INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES($1,$2,'Racer','cow','blue',$1)",[id,family]);
    const initial=await race.get(kid);
    let state=await race.mutate(kid,{revision:initial.revision,settings:{animal:'capybara',language:'vi',difficulty:'hard'}});
    for(now=1500;now<200000&&state.race!.status==='racing';now+=500){
      const q=(await privateState()).race!.question;
      state=await race.mutate(kid,{revision:state.revision,raceId:state.race!.id,action:now%2000===1500 && q.response.mode === 'choice'?{type:'answer',questionId:q.id,choice:q.response.correct}:{type:'tick'}});
    }
    assert.equal(state.race!.place,1);assert.equal(state.race!.status,'finished');
    assert.deepEqual(state.race!.reward,{stamina:60,wood:40,wool:40});
    const after=(await town.get(kid)).materials;
    const receipts=await pool.query('SELECT * FROM town_reward_events WHERE profile_id=$1',[kid]);assert.equal(receipts.rowCount,1);
    await assert.rejects(race.mutate(kid,{revision:state.revision-1,raceId:state.race!.id,action:{type:'tick'}}),/changed/);
    const duplicate=await race.mutate(kid,{revision:state.revision,raceId:state.race!.id,action:{type:'tick'}});
    assert.deepEqual((await town.get(kid)).materials,after);assert.equal(duplicate.stats.finished,1);
    const beforeCatalog=await privateState(),group=ACHIEVEMENT_GROUPS.find(g=>g.id==='road-racing')!;
    await db.achievements!.sync(group);await db.achievements!.sync(group);
    assert.deepEqual(await privateState(),beforeCatalog);assert.equal((await db.achievements!.list()).filter(a=>a.groupId==='road-racing').length,18);
    const projected=(await reports.read(family)).children.find(c=>c.id===kid)!.games.find(g=>g.id==='road-racing')!;
    assert.equal(projected.achievements.length,18);assert.equal(projected.achievements.filter(a=>a.earned).length,3);
    assert.equal(projected.achievements.find(a=>a.id==='road-racing-capybara')!.earned,true);
    assert.equal(projected.achievements.find(a=>a.id==='road-racing-ten')!.current,1);
    const config=loadConfig({NODE_ENV:'test',DATABASE_URL:url,ALLOWED_ORIGINS:'https://road.example.test',ALLOWED_FORWARDED_HOSTS:'road.example.test'});
    await pool.query("INSERT INTO sessions(id,token_hash,family_id,expires_at,parent_verified_until,parent_verified_by) VALUES($1,$2,$3,now()+interval '1 hour',now()+interval '1 hour','password')",[randomUUID(),hashSessionToken(token),family]);
    const app=createApp({db,config,logger:{info(){},warn(){},error(){}}});
    const request=(path:string,method='GET',body?:unknown,authenticated=true)=>app.request(`https://road.example.test/api/v1/${path}`,{method,headers:{...(authenticated?{cookie:`${config.sessionCookieName}=${token}`} : {}),origin:'https://road.example.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    assert.equal((await request(`profiles/${kid}/road-racing`,'GET',undefined,false)).status,401);
    assert.equal((await request('profiles/not-owned/road-racing')).status,404);
    assert.equal((await request(`profiles/${kid}/road-racing/start`,'POST',{revision:state.revision,settings:{animal:'cow',language:'en',difficulty:'easy',position:1}})).status,422);
    const kidGroups=await(await request(`profiles/${kid}/achievement-groups`)).json();
    const parent=await(await request('parent/reports')).json();
    const adminResponse=await request(`admin/families/${family}/reports`);assert.equal(adminResponse.status,200);assert.match(adminResponse.headers.get('cache-control')??'',/no-store/);
    const admin=await adminResponse.json();
    const select=(r:typeof parent)=>r.children.find((c:{id:string})=>c.id===kid).games.find((g:{id:string})=>g.id==='road-racing');
    assert.deepEqual(select(parent),select(admin));assert.deepEqual(kidGroups.find((g:{id:string})=>g.id==='road-racing'),select(parent));
    assert.equal(JSON.stringify(admin).includes('"question"'),false);
    assert.equal((await town.get(sibling)).materials.wood,0);
    // Leave from an old race cannot forfeit the new one; leaving the current race resets streaks without progress.
    const oldId=state.race!.id;state=await race.mutate(kid,{revision:state.revision,settings:{animal:'duck',language:'en',difficulty:'easy'}});
    await race.mutate(kid,{raceId:oldId,leave:true});assert.equal((await privateState()).race!.status,'racing');
    const abandoned=await race.mutate(kid,{raceId:state.race!.id,leave:true});assert.equal(abandoned.stats.streak,0);assert.equal(abandoned.stats.finished,1);
    assert.deepEqual((await town.get(kid)).materials,after);assert.deepEqual(abandoned.earned,beforeCatalog.earned);
    // A final credit failure rolls back race completion as well as the unique receipt.
    state=await race.mutate(kid,{revision:abandoned.revision,settings:{animal:'cow',language:'en',difficulty:'easy'}});
    const privateRace=await privateState();privateRace.race!.racers.find(a=>a.player)!.distance=1199;
    await pool.query('UPDATE road_racing_progress SET state=$2 WHERE profile_id=$1',[kid,JSON.stringify(privateRace)]);
    await pool.query("UPDATE town_state SET state=jsonb_set(state,'{materials,wood}',to_jsonb($2::bigint)) WHERE profile_id=$1",[kid,Number.MAX_SAFE_INTEGER]);
    now+=1000;await assert.rejects(race.mutate(kid,{revision:state.revision,raceId:state.race!.id,action:{type:'tick'}}),/Invalid resource credit/);
    assert.equal((await privateState()).stats.finished,1);assert.equal((await pool.query('SELECT * FROM town_reward_events WHERE profile_id=$1',[kid])).rowCount,1);
    await pool.query("UPDATE town_state SET state=jsonb_set(state,'{materials,wood}',to_jsonb($2::int)) WHERE profile_id=$1",[kid,after.wood]);
    const concurrent=await Promise.allSettled([0,1].map(()=>race.mutate(kid,{revision:state.revision,raceId:state.race!.id,action:{type:'tick'}})));
    assert.equal(concurrent.filter(result=>result.status==='fulfilled').length,1);
    assert.equal((await privateState()).stats.finished,2);
    assert.equal((await pool.query('SELECT * FROM town_reward_events WHERE profile_id=$1',[kid])).rowCount,2);
    assert.equal((await town.get(kid)).materials.wood,after.wood+40);
  }finally{await pool.query('DELETE FROM families WHERE id=$1',[family]);await db.close?.();await pool.end();}
});

test('GET does not rewrite an old race, while its first mutation normalizes and persists once', {skip:configured?false:'TEST_DATABASE_URL is not configured'},async()=>{
  const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((v):v is string=>!!v),process.env.ALLOW_NONLOCAL_TEST_DATABASE);
  const pool=new Pool({connectionString:url}),db=createDatabase(url);let now=1200;
  const race=createRoadRacingRepository(pool,()=>now);
  const family=`road-legacy-${randomUUID()}`,kid=`${family}-kid`;
  try {
    await migrate(drizzle({client:pool}),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
    await pool.query("INSERT INTO families(id,email,display_name,password_hash,role) VALUES($1,$2,'Legacy Road family','unused','admin')",[family,`${family}@example.test`]);
    await pool.query("INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES($1,$2,'Legacy Racer','cow','blue',$1)",[kid,family]);
    const legacy=startRace(emptyProgress(),{animal:'capybara',language:'en',difficulty:'hard'},1000,()=>0,'legacy-race');
    legacy.revision=7;
    delete (legacy.race as unknown as Record<string,unknown>).slows;
    delete (legacy.race as unknown as Record<string,unknown>).wrongAttempts;
    delete (legacy.race as unknown as Record<string,unknown>).triedChoices;
    delete (legacy.race as unknown as Record<string,unknown>).slowed;
    delete (legacy.race as unknown as Record<string,unknown>).peakSlows;
    await pool.query('INSERT INTO road_racing_progress(profile_id,state) VALUES($1,$2)',[kid,JSON.stringify(legacy)]);
    const before=(await pool.query<{state:Progress}>('SELECT state FROM road_racing_progress WHERE profile_id=$1',[kid])).rows[0]!.state;
    const loaded=await race.get(kid);
    assert.equal(loaded.revision,7);
    const afterGet=(await pool.query<{state:Progress}>('SELECT state FROM road_racing_progress WHERE profile_id=$1',[kid])).rows[0]!.state;
    assert.deepEqual(afterGet,before);

    const mutated=await race.mutate(kid,{revision:7,raceId:'legacy-race',action:{type:'tick'}});
    assert.equal(mutated.revision,8);
    const afterMutation=(await pool.query<{state:Progress}>('SELECT state FROM road_racing_progress WHERE profile_id=$1',[kid])).rows[0]!.state;
    assert.equal(afterMutation.revision,8);
    assert.deepEqual(afterMutation.race!.slows,[]);
    assert.equal(afterMutation.race!.wrongAttempts,0);
    assert.deepEqual(afterMutation.race!.triedChoices,[]);
    assert.equal(afterMutation.race!.slowed,false);
    assert.equal(afterMutation.race!.peakSlows,0);

    const unchanged=await race.mutate(kid,{revision:8,raceId:'legacy-race',action:{type:'tick'}});
    assert.equal(unchanged.revision,8);
    const afterRepeat=(await pool.query<{state:Progress}>('SELECT state FROM road_racing_progress WHERE profile_id=$1',[kid])).rows[0]!.state;
    assert.deepEqual(afterRepeat,afterMutation);
  }finally{await pool.query('DELETE FROM families WHERE id=$1',[family]);await db.close?.();await pool.end();}
});
