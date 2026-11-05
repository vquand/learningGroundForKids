import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {assertSafeTestDatabaseUrl} from '../../src/db/test-database.js';
import {createTownVisitsRepository} from '../../src/town-building/visits.js';
import {initialTown} from '../../src/town-building/game.js';
import {emptyLake} from '../../src/town-building/maps/lake/game.ts';
const configured=process.env.TEST_DATABASE_URL;
test('friend towns honor both scopes, activity ordering, revocation, pagination and read-only access',{skip:configured?false:'TEST_DATABASE_URL is not configured'},async()=>{
  const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((v):v is string=>!!v),process.env.ALLOW_NONLOCAL_TEST_DATABASE);
  const pool=new Pool({connectionString:url}),repo=createTownVisitsRepository(pool),tag=`visits-${randomUUID()}`;
  const a=`${tag}-a`,b=`${tag}-b`,c=`${tag}-c`,kid=(family:string,n:number)=>`${family}-${n}`;
  try{
    await migrate(drizzle({client:pool}),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
    for(const family of [a,b,c]){
      await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$1,$3)',[family,`${family}@example.test`,'unused']);
      for(let n=0;n<8;n++){
        await pool.query('INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES($1,$2,$3,$4,$5,$1)',[kid(family,n),family,n===0?'Zoe':`Ada ${n}`,'⭐','green']);
        const town=initialTown();town.townName={adjective:'Cozy',noun:'Grove'};town.materials.wood=123;
        if(n<3){town.maps={lake:emptyLake(1000)};town.maps.lake!.stage=n as 0|1|2;}
        await pool.query("INSERT INTO town_state(profile_id,state,updated_at) VALUES($1,$2,'2026-01-01')",[kid(family,n),JSON.stringify(town)]);
      }
    }
    const add=async(id:string,from:string,to:string,fromScope:string,toScope:string,status='accepted')=>pool.query(`INSERT INTO friend_requests(id,requesting_family_id,requesting_scope,requesting_profile_id,requesting_label,target_family_id,target_scope,target_profile_id,target_label,target_code,requester_message,status)
      VALUES($1,$2,$3,$4,'From',$5,$6,$7,'To','CODE','Hello',$8)`,[id,from,fromScope,fromScope==='profile'?kid(from,0):null,to,toScope,toScope==='profile'?kid(to,0):null,status]);
    assert.deepEqual((await repo.list(a,kid(a,0),0)).towns,[]);
    const rejected=`${tag}-rejected`;await add(rejected,a,c,'family','family','rejected');
    for(const reverse of [false,true])for(const fromScope of ['profile','family'])for(const toScope of ['profile','family']){
      const id=`${tag}-link`;await add(id,reverse?b:a,reverse?a:b,fromScope,toScope);
      const viewerScope=reverse?toScope:fromScope,targetScope=reverse?fromScope:toScope;
      const page=await repo.list(a,kid(a,0),0);
      assert.equal(page.towns.length,targetScope==='family'?6:1);
      assert.equal(page.nextOffset,targetScope==='family'?6:null);
      assert.ok(page.towns.every(t=>t.profile.id.startsWith(b)));
      assert.equal((await repo.list(a,kid(a,1),0)).towns.length,viewerScope==='family'?(targetScope==='family'?6:1):0);
      await assert.rejects(()=>repo.get(a,kid(a,0),kid(c,0)),/not available/);
      await assert.rejects(()=>repo.get(b,kid(a,0),kid(b,0)),/not available/);
      if(targetScope==='profile')await assert.rejects(()=>repo.get(a,kid(a,0),kid(b,1)),/not available/);
      const snapshot=await pool.query('SELECT xmin::text, state FROM town_state WHERE profile_id=$1',[kid(b,0)]);
      const visit=await repo.get(a,kid(a,0),kid(b,0));
      assert.equal(visit.townName.noun,'Grove');assert.equal('materials' in visit,false);assert.equal('learnedIds' in visit,false);
      assert.deepEqual(await pool.query('SELECT xmin::text, state FROM town_state WHERE profile_id=$1',[kid(b,0)]).then(r=>r.rows),snapshot.rows);
      await pool.query('DELETE FROM friend_requests WHERE id=$1',[id]);
      await assert.rejects(()=>repo.get(a,kid(a,0),kid(b,0)),/not available/);
    }
    await add(`${tag}-link`,a,b,'family','family');
    for(let n=0;n<4;n++)assert.equal((await repo.get(a,kid(a,0),kid(b,n))).lakeStage,n<3?n:null,'only the saved lake stage is exposed, including permanent unlocks after prosperity falls');
    const stages=await repo.list(a,kid(a,0),0);
    for(const friend of stages.towns){const n=Number(friend.profile.id.split('-').at(-1));assert.equal(friend.lakeStage,n<3?n:null);}
    const avatar=`/media/profile-avatars/${b}/${kid(b,0)}/face.png`;
    await pool.query("UPDATE profiles SET avatar_type='custom',avatar_url=$2 WHERE id=$1",[kid(b,0),avatar]);
    assert.equal(await repo.avatar(a,kid(a,0),kid(b,0)),avatar);
    assert.equal(await repo.avatar(c,kid(a,0),kid(b,0)),null);
    assert.equal((await repo.get(a,kid(a,0),kid(b,0))).profile.avatar_url,`${avatar}?townVisitor=${encodeURIComponent(kid(a,0))}`);
    await pool.query("UPDATE profiles SET avatar_type='custom',avatar_url='https://example.test/private-avatar.png' WHERE id=$1",[kid(b,1)]);
    assert.equal((await repo.get(a,kid(a,0),kid(b,1))).profile.avatar_type,'emoji');
    await pool.query("UPDATE town_state SET updated_at='2026-02-01' WHERE profile_id=$1",[kid(b,0)]);
    let page=await repo.list(a,kid(a,0),0);
    assert.equal(page.towns[0]!.profile.name,'Zoe');assert.equal(page.towns[1]!.profile.name,'Ada 1');
    assert.equal(JSON.stringify(page).includes('2026-02-01'),false,'timestamps stay private');
    assert.equal((await repo.list(a,kid(a,0),6)).towns.length,2);
    await pool.query("INSERT INTO adventure_events(id,profile_id,event_key,game,kind,data,created_at) VALUES($1,$2,'latest','town','town_built','{}','2026-03-01')",[randomUUID(),kid(b,2)]);
    page=await repo.list(a,kid(a,0),0);assert.equal(page.towns[0]!.profile.id,kid(b,2));
    await pool.query('DELETE FROM town_state WHERE profile_id=$1',[kid(b,3)]);
    const missing=await repo.get(a,kid(a,0),kid(b,3));assert.deepEqual(missing.entities,[]);
    assert.equal(missing.lakeStage,null);
    assert.equal((await pool.query('SELECT 1 FROM town_state WHERE profile_id=$1',[kid(b,3)])).rowCount,0,'visits never initialize another child town');
  }finally{await pool.query('DELETE FROM families WHERE id=ANY($1)',[[a,b,c]]);await pool.end();}
});
