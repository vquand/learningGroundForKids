import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from '../../src/db/index.js';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { recordAdventure } from '../../src/adventures/events.js';
import { createKitchenRepository } from '../../src/kitchen/repository.js';
import { GRILLED_PORK_RECIPE } from '../../src/kitchen/cookingConfig.js';
const configured=process.env.TEST_DATABASE_URL;
test('child journal enforces both friendship scopes, chronology, rollback, deduplication and verified recipes',{skip:configured?false:'TEST_DATABASE_URL not configured'},async()=>{
  const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL??'',process.env.DATABASE_URL_UNPOOLED??'']);
  const pool=new Pool({connectionString:url,max:8}),db=createDatabase(url),tag=`journal-${randomUUID()}`;
  const families=[`${tag}-a`,`${tag}-b`,`${tag}-c`],kids=[`${tag}-a1`,`${tag}-a2`,`${tag}-b1`,`${tag}-b2`,`${tag}-c1`];
  const [a,b,c]=families as [string,string,string],[a1,a2,b1,b2,c1]=kids as [string,string,string,string,string];
  try{
    await migrate(drizzle(pool),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
    for(const family of families)await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',[family,`${family}@test.local`,'Journal family','unused']);
    for(const [kid,family] of [[a1,a],[a2,a],[b1,b],[b2,b],[c1,c]]){
      await pool.query('INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES($1,$2,$3,$4,$5,$6)',[kid,family,kid,'star','green',kid]);
      await recordAdventure(pool,kid!,{key:'first',game:'miniku',kind:'miniku_completed',data:{amount:3}});
    }
    const read=async(viewer=a1,scope:'mine'|'friends'='friends')=>db.adventures!.list(a,viewer,scope,50,null,'en');
    assert.equal((await read()).entries.length,0);assert.equal((await read(a1,'mine')).entries.length,1);assert.equal((await read(b1,'mine')).entries.length,0);
    for(const reverse of [false,true])for(const left of ['profile','family'] as const)for(const right of ['profile','family'] as const){
      const request=await db.friendRequests.create(reverse?b:a,{requesting_scope:reverse?right:left,requesting_profile_id:(reverse?right:left)==='profile'?(reverse?b1:a1):null,target_scope:reverse?left:right,target_code:reverse?a1:b1});
      assert.equal((await read()).entries.length,0,'pending links do not share activity');
      await db.friendRequests.respond(reverse?a:b,request.id,true);
      assert.deepEqual((await read()).entries.map(entry=>entry.profile.id).sort(),(right==='family'?[b1,b2]:[b1]).sort());
      assert.equal((await read(a2)).entries.length,left==='family'?(right==='family'?2:1):0,'a sibling must be in the viewer-side scope');
      await pool.query('DELETE FROM friend_requests WHERE id=$1',[request.id]);
      assert.equal((await read()).entries.length,0,'revoked links disappear immediately');
    }
    const rejected=await db.friendRequests.create(a,{requesting_scope:'profile',requesting_profile_id:a1,target_scope:'profile',target_code:b1});await db.friendRequests.respond(b,rejected.id,false);assert.equal((await read()).entries.length,0);
    const client=await pool.connect();try{await client.query('BEGIN');await recordAdventure(client,a1,{key:'rolled-back',game:'kitchen',kind:'meal_burnt',data:{subject:'Test meal'}});await client.query('ROLLBACK');}finally{client.release();}
    await Promise.all([recordAdventure(pool,a1,{key:'duplicate',game:'ufo',kind:'ufo_solved',data:{subject:'CAT'}}),recordAdventure(pool,a1,{key:'duplicate',game:'ufo',kind:'ufo_solved',data:{subject:'CAT'}})]);
    assert.equal((await read(a1,'mine')).entries.length,2);
    const first=await db.adventures!.list(a,a1,'mine',1,null,'en');assert.ok(first.next_cursor);
    const second=await db.adventures!.list(a,a1,'mine',1,JSON.parse(Buffer.from(first.next_cursor!,'base64url').toString()),'en');assert.notEqual(first.entries[0]!.id,second.entries[0]!.id);assert.equal(second.next_cursor,null);
    const kitchen=createKitchenRepository(pool),recipe=GRILLED_PORK_RECIPE.id;
    let session=await kitchen.get(a1,recipe);const initialRevision=session.revision;
    session=await kitchen.mutate(a1,recipe,session.revision,{type:'flip'});assert.equal((await read(a1,'mine')).entries.length,2,'skip-to-finish action cannot invent a meal');
    await assert.rejects(()=>kitchen.mutate(a1,recipe,initialRevision,{type:'selectHeat',level:'medium'}),/changed/);
    session=await kitchen.mutate(a1,recipe,session.revision,{type:'selectHeat',level:'medium'});session=await kitchen.mutate(a1,recipe,session.revision,{type:'confirmHeat'});
    session=await kitchen.mutate(a1,recipe,session.revision,{type:'rotate',turns:100});
    assert.equal((await read(a1,'mine')).entries.filter(entry=>entry.kind==='meal_burnt').length,1);
    assert.equal((await kitchen.completions(a1)).counts[recipe],0,'burnt meals earn no completion medal');
    await kitchen.mutate(a1,recipe,session.revision,{type:'flip'});assert.equal((await read(a1,'mine')).entries.filter(entry=>entry.kind==='meal_burnt').length,1);
    session=await kitchen.mutate(a1,recipe,session.revision+1,{type:'restart'});session=await kitchen.mutate(a1,recipe,session.revision,{type:'selectHeat',level:'medium'});session=await kitchen.mutate(a1,recipe,session.revision,{type:'confirmHeat'});
    const game=session.game;if(!('rawRoundLimit' in game))throw new Error('Expected grill');
    session=await kitchen.mutate(a1,recipe,session.revision,{type:'rotate',turns:game.rawRoundLimit+1});session=await kitchen.mutate(a1,recipe,session.revision,{type:'lockRotation'});
    const phase=GRILLED_PORK_RECIPE.phases[(session.game as typeof game).phaseIndex];if(phase?.kind!=='seasoning')throw new Error('Expected glaze');
    session=await kitchen.mutate(a1,recipe,session.revision,{type:'season',seasoningId:phase.seasoningOptions[0]!.id});session=await kitchen.mutate(a1,recipe,session.revision,{type:'confirmSeasoning'});session=await kitchen.mutate(a1,recipe,session.revision,{type:'flip'});
    assert.equal((await read(a1,'mine')).entries.filter(entry=>entry.kind==='meal_finished').length,1);
    assert.equal((await kitchen.completions(a1)).counts[recipe],1,'journal and saved session count the same successful batch once');
    let puzzle=await db.miniku!.mutate(a1,0,{type:'start',size:3});
    const board=(await pool.query('SELECT state FROM miniku_progress WHERE profile_id=$1',[a1])).rows[0].state.board;
    for(let index=0;index<board.givens.length;index++)if(!board.givens[index])puzzle=await db.miniku!.mutate(a1,puzzle.revision,{type:'set-cell',index,value:board.solution[index]});
    assert.equal((await read(a1,'mine')).entries.find(entry=>entry.kind==='miniku_completed')!.count,2,'verified board completion increments the hourly puzzle group');
    await db.miniku!.mutate(a1,puzzle.revision,{type:'select-cell',index:0});assert.equal((await read(a1,'mine')).entries.find(entry=>entry.kind==='miniku_completed')!.count,2);
    let wall=await db.mathWall!.mutate(a1,0,{settings:{animal:'capybara',language:'en',wall:'brick'}});
    const wallProgress=(await pool.query('SELECT state FROM math_wall_progress WHERE profile_id=$1',[a1])).rows[0].state;
    assert.equal(wallProgress.session.question.response.mode, 'choice');
    wall=await db.mathWall!.mutate(a1,wall.revision,{action:{type:'lane',lane:wallProgress.session.question.response.correct}});
    // Advance only the test fixture's deadline so the existing server grader resolves it.
    await pool.query("UPDATE math_wall_progress SET state=jsonb_set(state,'{session,deadline}','0') WHERE profile_id=$1",[a1]);
    wall=await db.mathWall!.mutate(a1,wall.revision,{action:{type:'finish'}});
    assert.equal((await read(a1,'mine')).entries.filter(entry=>entry.kind==='waddle_passed').length,1);
    let burger=await kitchen.get(a1,'burger');
    for(const action of [{type:'shape',value:'round'},{type:'next'},{type:'toast',value:'golden'},{type:'next'},{type:'heat',value:'medium'},{type:'flip'},{type:'next'},{type:'cheese'},{type:'next'},{type:'sauce',value:'mayo'},{type:'next'},{type:'topping',value:'lettuce'},{type:'next'},{type:'pick',value:'flower'},{type:'next'}] as const)burger=await kitchen.mutate(a1,'burger',burger.revision,action);
    assert.ok((await read(a1,'mine')).entries.some(entry=>entry.kind==='meal_finished'&&entry.data.subject==='Cozy cheeseburger'));
    assert.equal((await kitchen.completions(a1)).counts.burger,1);
    assert.ok(Object.values((await kitchen.completions(a2)).counts).every(count=>count===0),'a sibling has their own counts');
    // Earlier journal entries had titles only; recipe identity is now explicit.
    for(const [key,kind,data] of [
      ['drink:old-lemon','meal_finished',{subject:'Lemonade'}],
      ['drink:new-lemon','meal_finished',{subject:'Localized or renamed title',recipeId:'lemonade'}],
      ['cabbage:okay-batch:10','meal_finished',{subject:'Cabbage rolls'}],
      ['cabbage:okay-batch:20','meal_finished',{subject:'Cabbage rolls',recipeId:'cabbage-rolls'}],
      ['cabbage:perfect-batch:10','meal_finished',{recipeId:'cabbage-rolls'}],
      ['cabbage:burnt-batch:10','meal_burnt',{recipeId:'cabbage-rolls'}],
      ['cabbage:raw-batch:10','meal_undercooked',{recipeId:'cabbage-rolls'}],
    ] as const)await recordAdventure(pool,a1,{key,game:'kitchen',kind,data});
    const counts=(await kitchen.completions(a1)).counts;
    assert.equal(counts['cabbage-rolls'],2,'OK-ish and Perfect batches count once each; failed attempts do not count');
    assert.equal(counts.lemonade,2,'old titles and stable recipe identities both remain countable');
    await pool.query("DELETE FROM adventure_events WHERE profile_id=$1 AND data->>'recipeId'='burger'",[a1]);
    assert.equal((await kitchen.completions(a1)).counts.burger,1,'an existing successful saved session survives missing pre-journal history');
    // Own Explore history remains readable before journal rollout; friend-private lessons never leak.
    const item=`${tag}-item`;
    await pool.query('INSERT INTO items(id,category,latitude,longitude,is_published,owner_family_id) VALUES($1,$2,0,0,true,$3)',[item,'animal',b]);
    await pool.query('INSERT INTO item_translations(id,item_id,lang,title) VALUES($1,$2,$3,$4)',[`${item}-en`,item,'en','Private friend lesson']);
    await pool.query('INSERT INTO profile_progress(id,profile_id,item_id,category) VALUES($1,$2,$3,$4)',[`${tag}-progress`,b1,item,'animal']);
    const link=await db.friendRequests.create(a,{requesting_scope:'family',requesting_profile_id:null,target_scope:'family',target_code:b1});await db.friendRequests.respond(b,link.id,true);
    assert.ok((await read()).entries.every(entry=>entry.data.subject!=='Private friend lesson'));
    const publicItem=`${tag}-public-item`;
    await pool.query('INSERT INTO items(id,category,latitude,longitude,is_published) VALUES($1,$2,0,0,true)',[publicItem,'animal']);
    await pool.query('INSERT INTO item_translations(id,item_id,lang,title) VALUES($1,$2,$3,$4)',[`${publicItem}-en`,publicItem,'en','Public lesson']);
    await pool.query('INSERT INTO profile_progress(id,profile_id,item_id,category) VALUES($1,$2,$3,$4)',[`${tag}-public-progress`,b1,publicItem,'animal']);
    assert.equal((await read()).entries.find(entry=>entry.kind==='explore_learned')!.count,1,'hidden lessons cannot leak through a grouped count');
    await pool.query('UPDATE items SET owner_family_id=NULL WHERE id=$1',[item]);
    assert.equal((await read()).entries.find(entry=>entry.kind==='explore_learned')!.count,2);
    await pool.query('DELETE FROM items WHERE id=$1',[publicItem]);
    await pool.query('DELETE FROM items WHERE id=$1',[item]);
    // Group complete local clock hours before pagination, while preserving raw receipts.
    const addAt=async(profile:string,key:string,kind:import('../../src/adventures/types.js').AdventureKind,data:import('../../src/adventures/types.js').AdventureData,at:string)=>{
      await recordAdventure(pool,profile,{key,game:kind==='ufo_solved'?'ufo':'town',kind,data});
      await pool.query('UPDATE adventure_events SET created_at=$3 WHERE profile_id=$1 AND event_key=$2',[profile,key,at]);
    };
    for(let i=0;i<59;i++)await addAt(a1,`road-${i}`,'town_built',{subject:'Rocky road'},'2030-01-02T03:59:58.123456Z');
    await addAt(a1,'road-next-hour','town_built',{subject:'Rocky road'},'2030-01-02T04:00:00Z');
    await addAt(a1,'house','town_built',{subject:'Normal house'},'2030-01-02T03:59:59Z');
    await addAt(b1,'friend-road-1','town_built',{subject:'Rocky road'},'2030-01-02T03:10:00Z');
    await addAt(b1,'friend-road-2','town_built',{subject:'Rocky road'},'2030-01-02T03:20:00Z');
    await addAt(c1,'hidden-road','town_built',{subject:'Rocky road'},'2030-01-02T03:30:00Z');
    const grouped=await db.adventures!.list(a,a1,'mine',50,null,'en','Asia/Ho_Chi_Minh');
    const roads=grouped.entries.filter(e=>e.kind==='town_built'&&e.data.subject==='Rocky road');
    assert.deepEqual(roads.map(e=>e.count),[1,59]);
    assert.equal(roads[1]!.occurred_at,'2030-01-02T03:59:58.123456Z');
    assert.equal((await pool.query("SELECT count(*)::int AS total FROM adventure_events WHERE profile_id=$1 AND event_key LIKE 'road-%'",[a1])).rows[0].total,60);
    const friendRoads=(await read()).entries.filter(e=>e.kind==='town_built');
    assert.equal(friendRoads.length,1);assert.equal(friendRoads[0]!.profile.id,b1);assert.equal(friendRoads[0]!.count,2);
    const collected:string[]=[];let cursor:import('../../src/adventures/types.js').AdventureCursor|null=null;
    do {
      const page=await db.adventures!.list(a,a1,'mine',1,cursor,'en','Asia/Ho_Chi_Minh');
      collected.push(...page.entries.map(e=>e.id));
      cursor=page.next_cursor?JSON.parse(Buffer.from(page.next_cursor,'base64url').toString()):null;
    }while(cursor);
    assert.deepEqual(collected,grouped.entries.map(e=>e.id),'one-card pages contain whole groups without splitting or duplication');
    for(const [key,at] of [['half-before','2030-01-02T03:14:59.999999Z'],['half-after','2030-01-02T03:15:00Z']] as const)await addAt(a1,key,'town_built',{subject:'Half hour road'},at);
    const local=(await db.adventures!.list(a,a1,'mine',50,null,'en','Asia/Kathmandu')).entries.filter(e=>e.data.subject==='Half hour road');
    assert.equal(local.length,2,'a fractional-offset timezone splits at its own :00 boundary');
    const utc=(await read(a1,'mine')).entries.filter(e=>e.data.subject==='Half hour road');assert.equal(utc.length,1);assert.equal(utc[0]!.count,2);
    for(const [key,at] of [['dst-first','2030-11-03T05:30:00Z'],['dst-second','2030-11-03T06:30:00Z']] as const)await addAt(a1,key,'town_built',{subject:'Repeated hour road'},at);
    assert.equal((await db.adventures!.list(a,a1,'mine',50,null,'en','America/New_York')).entries.filter(e=>e.data.subject==='Repeated hour road').length,2,'repeated DST hours remain distinct');
    await addAt(a1,'harvest-1','town_harvest',{amount:3},'2030-01-03T00:10:00Z');
    await addAt(a1,'harvest-2','town_harvest',{amount:5},'2030-01-03T00:30:00Z');
    const harvest=(await read(a1,'mine')).entries.find(e=>e.kind==='town_harvest')!;assert.equal(harvest.count,2);assert.equal(harvest.data.amount,8);
    await addAt(a1,'word-1','ufo_solved',{subject:'DOG',difficulty:'easy'},'2030-01-03T01:10:00Z');
    await addAt(a1,'word-2','ufo_solved',{subject:'CAT',difficulty:'hard'},'2030-01-03T01:20:00Z');
    const words=(await read(a1,'mine')).entries.find(e=>e.kind==='ufo_solved')!;
    assert.equal(words.count,2);assert.equal(words.data.subject,'CAT');
    await addAt(a1,'midnight-before','town_built',{subject:'Midnight road'},'2030-01-03T16:59:59.999999Z');
    await addAt(a1,'midnight-after','town_built',{subject:'Midnight road'},'2030-01-03T17:00:00Z');
    assert.equal((await db.adventures!.list(a,a1,'mine',50,null,'en','Asia/Ho_Chi_Minh')).entries.filter(e=>e.data.subject==='Midnight road').length,2);


  }finally{await pool.query('DELETE FROM families WHERE id=ANY($1)',[families]);await db.close?.();await pool.end();}
});
