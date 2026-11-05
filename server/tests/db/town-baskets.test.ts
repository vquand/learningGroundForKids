import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {fileURLToPath} from 'node:url';
import {assertSafeTestDatabaseUrl} from '../../src/db/test-database.js';
import {createTownBasketsRepository} from '../../src/town-building/baskets.js';
import {initialTown} from '../../src/town-building/game.js';
import {DECORATION_MS} from '../../src/town-building/basketModel.js';
const configured=process.env.TEST_DATABASE_URL;
test('river baskets enforce friendship, delivery caps, retry identity, owner-only opening and fixed expiry without changing Towns',{skip:configured?false:'TEST_DATABASE_URL is not configured'},async()=>{
 const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((v):v is string=>!!v),process.env.ALLOW_NONLOCAL_TEST_DATABASE);
 const pool=new Pool({connectionString:url,max:8}),tag=`basket-${randomUUID()}`,a=tag+'-a',b=tag+'-b',c=tag+'-c';let now=Date.now();
 const repo=createTownBasketsRepository(pool,()=>now),from=a+'-0',to=b+'-0';
 try{
  await migrate(drizzle({client:pool}),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  for(const family of [a,b,c]){
   await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$1,$3)',[family,`${family}@example.test`,'unused']);
   for(let n=0;n<2;n++){const id=family+'-'+n;await pool.query('INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES($1,$2,$1,$3,$4,$1)',[id,family,'⭐','green']);await pool.query('INSERT INTO town_state(profile_id,state) VALUES($1,$2)',[id,JSON.stringify(initialTown())]);}
  }
  const gift={requestId:randomUUID(),decoration:'flowers' as const,message:3};
  await assert.rejects(()=>repo.send(a,from,to,gift),/not available/);
  await pool.query(`INSERT INTO friend_requests(id,requesting_family_id,requesting_scope,requesting_profile_id,requesting_label,target_family_id,target_scope,target_profile_id,target_label,target_code,requester_message,status)
   VALUES($1,$2,'profile',$3,'From',$4,'profile',$5,'To','CODE','Hi','accepted')`,[tag,a,from,b,to]);
  for(const [family,viewer,target] of [[a,a+'-1',to],[a,from,b+'-1'],[c,from,to]])await assert.rejects(()=>repo.send(family!,viewer!,target!,{...gift,requestId:randomUUID()}),/not available/);
  await pool.query(`INSERT INTO friend_requests(id,requesting_family_id,requesting_scope,requesting_profile_id,requesting_label,target_family_id,target_scope,target_profile_id,target_label,target_code,requester_message,status) VALUES($1,$2,'profile',$3,'From',$4,'profile',$5,'To','CODE','Hi','accepted')`,[tag+'-second',a,a+'-1',b,to]);
  const before=await pool.query('SELECT profile_id,xmin::text,state FROM town_state WHERE profile_id=ANY($1) ORDER BY profile_id',[[from,to]]);
  const responses=await Promise.all([repo.send(a,from,to,gift),repo.send(a,from,to,gift)]);
  assert.ok(responses.every(r=>!r.canSend&&r.reason==='waiting'));
  assert.equal((await pool.query('SELECT 1 FROM town_basket_gifts WHERE id=$1',[gift.requestId])).rowCount,1);
  await assert.rejects(()=>repo.send(a,from,to,{...gift,decoration:'gnome'}),/changed/);
  await assert.rejects(()=>repo.send(a,from,to,{...gift,requestId:randomUUID()}),/waiting/);
  const delivered=await repo.visitor(a,from,to);assert.equal(delivered.decorations.length,1,'delivered gifts immediately fill their own basket');assert.equal(delivered.decorations[0]!.decoration,'flowers');
  const otherFriend=await repo.visitor(a,a+'-1',to);assert.equal(otherFriend.canSend,true,'another friend gets an empty basket');assert.equal(otherFriend.decorations.length,1,'existing filled baskets remain visible');
  const deliveryExpiry=now+5*86400000;assert.equal(delivered.decorations[0]!.expiresAt,deliveryExpiry);
  const inbox=await repo.inbox(b,to,0);assert.equal(inbox.unopenedCount,1);assert.equal(inbox.pending[0]!.senderId,from);assert.equal('message' in inbox.pending[0]!,false);
  await assert.rejects(()=>repo.open(a,from,gift.requestId),/not available/);
  await assert.rejects(()=>repo.open(b,b+'-1',gift.requestId),/not available/);
  await assert.rejects(()=>repo.inbox(c,to,0),/not available/);
  now+=1000;const opened=await repo.open(b,to,gift.requestId);assert.equal(opened.gift.message,3);assert.equal(opened.gift.expiresAt,deliveryExpiry);
  now+=1000;assert.equal((await repo.open(b,to,gift.requestId)).gift.expiresAt,opened.gift.expiresAt);
  const publicView=await repo.visitor(a,from,to);assert.equal(publicView.reason,'cooldown');assert.equal(publicView.decorations.length,1);assert.equal('message' in publicView.decorations[0]!,false);
  assert.deepEqual((await pool.query('SELECT profile_id,xmin::text,state FROM town_state WHERE profile_id=ANY($1) ORDER BY profile_id',[[from,to]])).rows,before.rows);
  now=deliveryExpiry;assert.equal((await repo.inbox(b,to,0)).decorations.length,0);assert.equal((await repo.visitor(a,from,to)).canSend,true);
  const g2={...gift,requestId:randomUUID()};await repo.send(a,from,to,g2);
  now+=DECORATION_MS;assert.equal((await repo.inbox(b,to,0)).unopenedCount,0,'unopened baskets also expire');assert.equal((await repo.visitor(a,from,to)).canSend,true,'expired pending gifts do not block new deliveries');
  await repo.send(a,from,to,{...gift,requestId:randomUUID()});
  await assert.rejects(()=>repo.send(a,from,to,gift),/not available/,'expired delivery nonces cannot resurrect a basket');
  await assert.rejects(()=>repo.open(b,to,g2.requestId),/not available/);
  await pool.query("UPDATE friend_requests SET status='rejected' WHERE id=$1",[tag]);
  assert.equal((await repo.inbox(b,to,0)).unopenedCount,0);
  await assert.rejects(()=>repo.open(b,to,g2.requestId),/not available/);
  await assert.rejects(()=>repo.visitor(a,from,to),/not available/);
  await assert.rejects(()=>repo.send(a,from,to,gift),/not available/);
 }finally{await pool.query('DELETE FROM families WHERE id=ANY($1)',[[a,b,c]]);await pool.end();}
});
