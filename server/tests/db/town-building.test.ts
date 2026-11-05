import { freshPatch } from '../../src/town-building/garden.js';
import { simulateGarden } from '../../src/town-building/gardenSimulation.js';
import { initialTown } from '../../src/town-building/game.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { createTownRepository, creditTown } from '../../src/town-building/repository.js';
import { createDrinkRepository } from '../../src/town-building/drinks.js';
import { createCabbageRollRepository, type CabbageRollCommand } from '../../src/town-building/cabbage-rolls.js';
import { createInfinidrillRepository } from '../../src/infinidrill/repository.js';
import { createUfoRepository } from '../../src/ufo/repository.js';
import { createDatabase } from '../../src/db/index.js';
import { hashSessionToken } from '../../src/auth.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { TOWN_ACHIEVEMENT_GROUP } from '../../src/achievement-catalog.js';
const configured=process.env.TEST_DATABASE_URL;
test('town persistence: retry deduplication, concurrent spending, verified rewards and protected APIs',{skip:configured?false:'TEST_DATABASE_URL is not configured'},async()=>{
 const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((v):v is string=>!!v),process.env.ALLOW_NONLOCAL_TEST_DATABASE);
 let clock=Date.now();const pool=new Pool({connectionString:url,max:8});const town=createTownRepository(pool,()=>clock);const drinks=createDrinkRepository(pool);const cabbageRolls=createCabbageRollRepository(pool,()=>clock);const db=createDatabase(url);
 const tag=`town-test-${randomUUID()}`;const profile=`${tag}-kid`;const other=`${tag}-other`;const item=`${tag}-item`;const word=`${tag}-word`;
 try {
  await migrate(drizzle({client:pool}),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  await pool.query('INSERT INTO families(id,email,display_name,password_hash,role) VALUES ($1,$2,$3,$4,$5)',[tag,`${tag}@example.test`,'Town test','not-a-real-password','admin']);
  for(const id of [profile,other]) await pool.query('INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES ($1,$2,$3,$4,$5,$6)',[id,tag,'Builder','star','green',id]);
  await pool.query('INSERT INTO items(id,category,latitude,longitude,is_published) VALUES ($1,$2,0,0,true)',[item,'animal']);
  await pool.query('INSERT INTO profile_progress(id,profile_id,item_id,category) VALUES ($1,$2,$3,$4)',[`${tag}-progress`,profile,item,'animal']);
  let state=await town.get(profile);assert.deepEqual(state.learnedIds,[item]);
  const version = async () => (await pool.query('SELECT xmin::text AS version FROM town_state WHERE profile_id=$1',[profile])).rows[0].version;
  const firstVersion = await version();
  assert.deepEqual(await town.get(profile),state);
  assert.equal(await version(),firstVersion,'unchanged reads must not rewrite the town row');
  assert.deepEqual(await town.getName(profile),state.townName);
  assert.equal(await version(),firstVersion,'name-only reads must not rewrite the town row');
  const lock = await pool.connect();
  try {
    await lock.query('BEGIN');
    await lock.query('SELECT state FROM town_state WHERE profile_id=$1 FOR UPDATE',[profile]);
    // A statement timeout makes a read-time exclusive lock fail deterministically.
    const readPool = new Pool({connectionString:url,options:'-c statement_timeout=1000'});
    try { assert.deepEqual(await createTownRepository(readPool).get(profile),state); }
    finally { await readPool.end(); }
  } finally { await lock.query('ROLLBACK'); lock.release(); }

  await pool.query('DELETE FROM profile_progress WHERE profile_id=$1',[profile]);assert.deepEqual((await town.get(profile)).learnedIds,[item]);
  const credit=async(event:string)=>{const c=await pool.connect();try{await c.query('BEGIN');await creditTown(c,profile,event,{stamina:7,wood:9,rock:5});await c.query('COMMIT');}finally{c.release();}};
  await Promise.all([credit('once'),credit('once')]);state=await town.get(profile);assert.equal(state.materials.wood,9);
  const outcomes=await Promise.allSettled([town.mutate(profile,state.revision,{type:'build',blueprintId:'house',x:5,y:8}),town.mutate(profile,state.revision,{type:'build',blueprintId:'house',x:8,y:12})]);
  assert.equal(outcomes.filter(v=>v.status==='fulfilled').length,1);state=await town.get(profile);assert.equal(state.entities.length,2);assert.equal(state.materials.wood,0);
  await assert.rejects(()=>town.mutate(profile,state.revision,{type:'move',entityId:state.entities.find(e=>e.id!=='starter-home')!.id,x:8,y:16}),/materials/);
  assert.deepEqual((await town.get(profile)).materials,state.materials);
  const recipe=await drinks.get(profile);let session=await drinks.mutate(profile,recipe.revision,{type:'start',recipeId:'lemonade'});
  for(const ingredientId of ['lemon','ice','water','sugar','mint-leaf']) session=await drinks.mutate(profile,session.revision,{type:'selectIngredient',ingredientId});
  assert.equal(session.townReward.stamina,6);const balance=(await town.get(profile)).materials.stamina;
  const duplicate=await drinks.mutate(profile,session.revision,{type:'selectIngredient',ingredientId:'mint-leaf'});assert.equal(duplicate.townReward.stamina,0);assert.equal((await town.get(profile)).materials.stamina,balance);
  assert.equal((await db.kitchen!.completions(profile)).counts.lemonade,1,'verified drink completion is counted once');
  await assert.rejects(()=>drinks.mutate(profile,session.revision,{type:'restart'}),/changed/);
  let cabbage=await cabbageRolls.get(profile);
  const cabbageAct=async(command:CabbageRollCommand)=>cabbage=await cabbageRolls.mutate(profile,cabbage.revision,command);
  await cabbageAct({type:'start'});
  for(let ingredient=0;ingredient<4;ingredient++){
    if(ingredient===3)await cabbageAct({type:'peel'});
    for(let cut=0;cut<3;cut++)await cabbageAct({type:'chop'});
    await cabbageAct({type:'next'});
  }
  for(const index of [0,1,2,3])await cabbageAct({type:'add',index});
  await cabbageAct({type:'next'});
  for(const value of ['Salt','Pepper','Soy sauce'] as const)await cabbageAct({type:'season',value});
  await cabbageAct({type:'next'});await cabbageAct({type:'mix'});await cabbageAct({type:'cover-bowl'});await cabbageAct({type:'refrigerate'});
  await cabbageAct({type:'leaf'});await cabbageAct({type:'cover-steamer'});await cabbageAct({type:'heat',value:'medium'});await cabbageAct({type:'steam-start'});
  clock+=8_000;await cabbageAct({type:'lift'});await cabbageAct({type:'retrieve-filling'});
  for(let roll=0;roll<3;roll++){
    await cabbageAct({type:'portion',value:'medium'});
    for(const edge of ['bottom','left','right','close'] as const)await cabbageAct({type:'fold',edge});
  }
  await cabbageAct({type:'next'});
  for(let roll=0;roll<3;roll++)await cabbageAct({type:'arrange'});
  await cabbageAct({type:'sauce'});await cabbageAct({type:'cover-pot'});await cabbageAct({type:'heat',value:'low'});await cabbageAct({type:'cook'});
  clock+=8_000;await cabbageAct({type:'stop'});
  assert.equal(cabbage.outcome,'perfect');
  assert.equal((await db.kitchen!.completions(profile)).counts['cabbage-rolls'],1);
  for(const [duration,outcome] of [[6_600,'okay'],[12_000,'burnt'],[0,'undercooked'],[8_000,'perfect']] as const){
    await cabbageAct({type:'retry'});await cabbageAct({type:'cook'});clock+=duration;await cabbageAct({type:'stop'});
    assert.equal(cabbage.outcome,outcome);
    assert.equal((await db.kitchen!.completions(profile)).counts['cabbage-rolls'],1,'successful retries count the batch once; failed retries add nothing');
  }
  const cabbageBalance=(await town.get(profile)).materials.stamina;
  const cabbageRevision=cabbage.revision;
  const concurrentServe=await Promise.allSettled([
    cabbageRolls.mutate(profile,cabbageRevision,{type:'serve'}),
    cabbageRolls.mutate(profile,cabbageRevision,{type:'serve'}),
  ]);
  assert.equal(concurrentServe.filter(result=>result.status==='fulfilled').length,1);
  const servedCabbage=concurrentServe.find(result=>result.status==='fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof cabbageRolls.mutate>>>;
  assert.equal(servedCabbage.value.townReward.stamina,8);
  assert.equal((await town.get(profile)).materials.stamina,cabbageBalance+8,'verified cabbage-roll completion credits Town stamina');
  const drill=createInfinidrillRepository(pool);let expedition=await drill.mutate(profile,0,{type:'replay'});
  const privateGame=(await pool.query('SELECT state FROM infinidrill_progress WHERE profile_id=$1',[profile])).rows[0].state.game;
  expedition=await drill.mutate(profile,expedition.revision,{type:'submit-answer',questionId:privateGame.currentQuestion.id,answer:privateGame.currentQuestion.answer});
  assert.ok((await town.get(profile)).materials.sand>0);
  await assert.rejects(()=>drill.mutate(profile,1,{type:'submit-answer',questionId:privateGame.currentQuestion.id,answer:privateGame.currentQuestion.answer}),/changed/);
  const ufo=createUfoRepository(pool);await pool.query('INSERT INTO ufo_words(id,language,word,difficulty,clue,definition) VALUES ($1,$2,$3,$4,$5,$6)',[word,'en','OX','easy','Farm animal','A working animal']);
  await pool.query('INSERT INTO ufo_progress(profile_id,state) VALUES ($1,$2)',[other,JSON.stringify({revision:0,session:{language:'en',difficulty:'hard',animal:'cow',background:'farm',word:{id:word,language:'en',word:'OX',difficulty:'hard',clue:'Farm animal',definition:'A working animal'},guessed:[],hints:1,danger:0,charges:0,solved:0,status:'playing',solvedAt:0,lastShoo:0},stats:{solved:0,medium:0,hard:0,shoo:0,friends:{cow:0,highland:0,sheep:0,capybara:0},captures:{cow:0,highland:0,sheep:0,capybara:0}},seen:{easy:[],medium:[],hard:[]},last:{easy:'',medium:'',hard:''}})]);
  await ufo.mutate(other,0,{action:{type:'guess',letter:'O'}});await ufo.mutate(other,1,{action:{type:'guess',letter:'X'}});
  const ufoMaterials = (await town.get(other)).materials;
  assert.equal(ufoMaterials.wood,14);assert.equal((await town.get(other)).storage!.wool,7);
  const ownJournal=await db.adventures!.list(tag,profile,'mine',50,null,'en');
  assert.ok(ownJournal.entries.some(entry=>entry.kind==='meal_finished'&&entry.data.subject==='Cabbage rolls'));
  assert.ok(ownJournal.entries.filter(entry=>entry.kind==='meal_finished').length>=2,'verified drinks and cabbage both enter the journal');
  assert.ok(ownJournal.entries.some(entry=>entry.kind==='town_built'&&entry.data.subject==='Normal house'));
  assert.ok(ownJournal.entries.some(entry=>entry.kind==='drill_depth'),'the first verified dig appears without waiting for a depth milestone');
  assert.ok((await db.adventures!.list(tag,other,'mine',50,null,'en')).entries.some(entry=>entry.kind==='ufo_solved'&&entry.data.subject==='OX'));
  const token=`test-session-${randomUUID()}`;await pool.query('INSERT INTO sessions(id,token_hash,family_id,expires_at) VALUES ($3,$1,$2,now()+interval \'1 hour\')',[hashSessionToken(token),tag,randomUUID()]);
  const config=loadConfig({NODE_ENV:'test',DATABASE_URL:url,ALLOWED_ORIGINS:'https://town.example.test',ALLOWED_FORWARDED_HOSTS:'town.example.test',TOWN_ENVIRONMENT_PREVIEW_ENABLED:'true'});
  const quiet={info(){},warn(){},error(){}};const app=createApp({config,db,logger:quiet});
  const request=(path:string,method='GET',body?:unknown,cookie=true)=>app.request(`https://town.example.test/api/v1/profiles/${path}`,{method,headers:{...(cookie?{cookie:`${config.sessionCookieName}=${token}`}:{ }),origin:'https://town.example.test','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await request(`${profile}/town`,'GET',undefined,false)).status,401);
  assert.equal((await request(`not-owned/town`)).status,404);
  assert.equal((await request(`${profile}/cabbage-rolls`)).status,200);
  assert.equal((await request(`${profile}/cabbage-rolls/action`,'POST',{revision:servedCabbage.value.revision,command:{type:'serve',stamina:999}})).status,422);
  assert.equal((await request(`${profile}/town/action`,'POST',{revision:0,command:{type:'build',blueprintId:'house',x:5,y:8,wood:999}})).status,422);
  assert.equal((await request(`${profile}/town/environment/preview`,'POST',{season:'winter',precipitation:'rain',snowCover:true})).status,200);
  const secondToken=`test-session-${randomUUID()}`;await pool.query('INSERT INTO sessions(id,token_hash,family_id,expires_at) VALUES ($3,$1,$2,now()+interval \'1 hour\')',[hashSessionToken(secondToken),tag,randomUUID()]);
  const isolated=await app.request(`https://town.example.test/api/v1/profiles/${profile}/town/environment`,{headers:{cookie:`${config.sessionCookieName}=${secondToken}`}});assert.notEqual((await isolated.json()).weatherSource,'preview');
  for(const nodeEnv of ['development','production']){const locked=createApp({config:{...config,nodeEnv:nodeEnv as 'development'|'production'},db,logger:quiet});const denied=await locked.request(`https://town.example.test/api/v1/profiles/${profile}/town/environment/preview`,{method:'POST',headers:{cookie:`${config.sessionCookieName}=${token}`,origin:'https://town.example.test','Content-Type':'application/json'},body:JSON.stringify({season:'winter',precipitation:'snow',snowCover:true})});assert.equal(denied.status,403);}
  // Network removal remains authenticated, strict, atomic and revision-checked.
  for (const y of [30,31,32,35]) {
    state=await town.get(profile);
    await town.mutate(profile,state.revision,{type:'build',blueprintId:'dirt-road',x:12,y});
  }
  state=await town.get(profile);
  const selected=state.entities.find(entity=>entity.x===12&&entity.y===31)!;
  const removal={revision:state.revision,command:{type:'remove-line',entityId:selected.id}};
  assert.equal((await request(`${profile}/town/action`,'POST',removal,false)).status,401);
  assert.equal((await request('not-owned/town/action','POST',removal)).status,404);
  assert.equal((await request(`${profile}/town/action`,'POST',{...removal,command:{...removal.command,entityIds:state.entities.map(entity=>entity.id)}})).status,422);
  const removed=await request(`${profile}/town/action`,'POST',removal);
  assert.equal(removed.status,200);
  const afterRemoval=await town.get(profile);
  assert.equal(afterRemoval.revision,state.revision+1);
  assert.deepEqual(afterRemoval.entities,state.entities.filter(entity=>!(entity.x===12&&[30,31,32].includes(entity.y))));
  assert.deepEqual(afterRemoval.materials,state.materials,'removal must not refund or spend materials');
  assert.deepEqual(afterRemoval.earned,state.earned,'removal must not change earned achievements');
  assert.equal((await request(`${profile}/town/action`,'POST',removal)).status,409,'a stale retry cannot delete more roads');
  state=afterRemoval;
  const isolatedRoad=state.entities.find(entity=>entity.x===12&&entity.y===35)!;
  const concurrentRemoval=await Promise.allSettled([
    town.mutate(profile,state.revision,{type:'remove-line',entityId:isolatedRoad.id}),
    town.mutate(profile,state.revision,{type:'remove-line',entityId:isolatedRoad.id}),
  ]);
  assert.equal(concurrentRemoval.filter(result=>result.status==='fulfilled').length,1);
  assert.equal((await town.get(profile)).revision,state.revision+1);
  assert.deepEqual((await town.get(profile)).entities,state.entities.filter(entity=>entity.id!==isolatedRoad.id));
  // Garden rewards and fence placement are atomic in the existing JSON row.
  let gardenState=await town.get(other);gardenState.materials.wood=30;
  gardenState.entities.push({id:'garden-patch',blueprintId:'vegetable-patch',x:9,y:13,paidCost:{wood:4},garden:freshPatch('summer')});
  gardenState.entities.at(-1)!.garden!.slots.slice(0,3).forEach(slot=>slot.growth=300);gardenState.entities.at(-1)!.garden!.slots[3]!.growth=100;
  await pool.query('UPDATE town_state SET state=$2 WHERE profile_id=$1',[other,JSON.stringify(gardenState)]);
  const harvest={type:'harvest' as const,entityId:'garden-patch',generation:0};const oldStamina=gardenState.materials.stamina;
  const harvests=await Promise.allSettled([town.mutate(other,gardenState.revision,harvest),town.mutate(other,gardenState.revision,harvest)]);
  assert.equal(harvests.filter(result=>result.status==='fulfilled').length,1);
  gardenState=await town.get(other);assert.equal(gardenState.materials.stamina,oldStamina+6);assert.equal(gardenState.gardening!.harvests,3);assert.equal(gardenState.entities.at(-1)!.garden!.slots[3]!.growth,100);
  await assert.rejects(()=>town.mutate(other,gardenState.revision,harvest),/garden changed/);
  const fenceBefore=structuredClone(gardenState);gardenState.entities.push({id:'block-wrap',blueprintId:'dirt-road',x:8,y:12,paidCost:{}});
  await pool.query('UPDATE town_state SET state=$2 WHERE profile_id=$1',[other,JSON.stringify(gardenState)]);
  await assert.rejects(()=>town.mutate(other,gardenState.revision,{type:'wrap-fence',entityId:'garden-patch'}),/occupied/);
  assert.deepEqual(await town.get(other),gardenState);
  await pool.query('UPDATE town_state SET state=$2 WHERE profile_id=$1',[other,JSON.stringify(fenceBefore)]);
  gardenState=await town.mutate(other,fenceBefore.revision,{type:'wrap-fence',entityId:'garden-patch'});
  assert.equal(gardenState.materials.wood,fenceBefore.materials.wood-12);assert.equal(gardenState.entities.filter(e=>e.blueprintId==='wooden-fence').length,12);
  const stripBody={revision:gardenState.revision,command:{type:'remove-line',entityId:gardenState.entities.find(e=>e.blueprintId==='wooden-fence')!.id}};
  assert.equal((await request(`${other}/town/action`,'POST',stripBody,false)).status,401);
  assert.equal((await request('not-owned/town/action','POST',stripBody)).status,404);
  assert.equal((await request(`${other}/town/action`,'POST',{...stripBody,command:{...stripBody.command,entityIds: gardenState.entities.map(e=>e.id)}})).status,422);
  const fenceBalance=structuredClone(gardenState.materials),fenceBadges=structuredClone(gardenState.earned);
  const stripReplies=await Promise.all([request(`${other}/town/action`,'POST',stripBody),request(`${other}/town/action`,'POST',stripBody)]);
  assert.deepEqual(stripReplies.map(r=>r.status).sort(),[200,409],'connected fences are removed once under a revision lock');
  gardenState=await town.get(other);assert.equal(gardenState.entities.filter(e=>e.blueprintId==='wooden-fence').length,0);
  assert.deepEqual(gardenState.materials,fenceBalance);assert.deepEqual(gardenState.earned,fenceBadges);
  assert.equal((await request(`${other}/town/action`,'POST',stripBody)).status,409,'stale fence removal cannot remove more objects');
  const otherVersion=async()=>(await pool.query('SELECT xmin::text AS version FROM town_state WHERE profile_id=$1',[other])).rows[0].version;
  const gardenVersion=await otherVersion(),gardenRevision=gardenState.revision;
  await town.tick!(other,'town',{season:'summer',precipitation:'none',timeOfDay:'noon'},true);clock+=5000;
  await Promise.all([town.tick!(other,'town',{season:'summer',precipitation:'none',timeOfDay:'noon'},false),town.tick!(other,'town',{season:'summer',precipitation:'none',timeOfDay:'noon'},false)]);
  const elapsed=(await town.get(other)).entities.find(e=>e.id==='garden-patch')!.garden!.slots[0]!.growth;
  assert.ok(elapsed>=4.999&&elapsed<5.001,'overlapping tabs credit only real elapsed seconds');
  assert.equal(await otherVersion(),gardenVersion,'garden presence must never update the town row');
  assert.equal((await town.get(other)).revision,gardenRevision,'growth does not conflict with construction');
  assert.deepEqual((await town.get(other)).gardening!.animals,[],'decorative positions never cross the API');
  const persistedBefore=(await pool.query('SELECT state FROM town_state WHERE profile_id=$1',[other])).rows[0].state;
  assert.equal(persistedBefore.entities.find((e:any)=>e.id==='garden-patch').garden.slots[0].growth,0);
  const checkpointed=await town.checkpoint!(other);
  assert.equal(checkpointed.revision,gardenRevision,'pausing cannot make in-flight build requests stale');
  const checkpointVersion=await otherVersion();assert.notEqual(checkpointVersion,gardenVersion,'pause checkpoints verified crop changes');
  await town.checkpoint!(other);assert.equal(await otherVersion(),checkpointVersion,'repeated unchanged pause is read-only');
  gardenState=await town.mutate(other,gardenRevision,{type:'build',blueprintId:'dirt-road',x:12,y:30});
  const persistedAfter=(await pool.query('SELECT state FROM town_state WHERE profile_id=$1',[other])).rows[0].state;
  assert.ok(Math.abs(persistedAfter.entities.find((e:any)=>e.id==='garden-patch').garden.slots[0].growth-elapsed)<.0001,'a real action checkpoints verified growth');
  assert.deepEqual(persistedAfter.gardening.animals,[]);assert.equal(persistedAfter.gardening.lastTick,0);
  const restarted=createTownRepository(pool,()=>clock+5000);
  const resumed=await restarted.tick!(other,'town',{season:'summer',precipitation:'none',timeOfDay:'noon'},false);
  assert.ok(Math.abs(resumed.entities.find(e=>e.id==='garden-patch')!.garden!.slots[0]!.growth-elapsed)<.0001,'fresh API lease cannot credit persisted or offline elapsed time');
  assert.equal((await request(`${other}/town/garden/checkpoint`,'POST',{},false)).status,401);
  assert.equal((await request('not-owned/town/garden/checkpoint','POST',{})).status,404);
  assert.equal((await request(`${other}/town/garden/checkpoint`,'POST',{growth:300})).status,422);
  assert.equal((await request(`${other}/town/garden/tick`,'POST',{resume:false},false)).status,401);
  assert.equal((await request('not-owned/town/garden/tick','POST',{resume:false})).status,404);
  assert.equal((await request(`${other}/town/garden/tick`,'POST',{resume:false,elapsed:300})).status,422);
  assert.equal((await request(`${other}/town/environment/preview`,'POST',{season:'summer',precipitation:'none',snowCover:false})).status,200);
  const liveTick=await request(`${other}/town/garden/tick`,'POST',{resume:true});assert.equal(liveTick.status,200);
  assert.equal((await liveTick.json()).gardening.season,null,'appearance previews cannot choose a growth season');
  await db.achievements!.sync(TOWN_ACHIEVEMENT_GROUP);const before=await town.get(profile);await db.achievements!.sync(TOWN_ACHIEVEMENT_GROUP);assert.deepEqual(await town.get(profile),before);
 }finally{await pool.query('DELETE FROM families WHERE id=$1',[tag]);await pool.query('DELETE FROM items WHERE id=$1',[item]);await pool.query('DELETE FROM ufo_words WHERE id=$1',[word]);await db.close?.();await pool.end();}
});

test('in-flight garden simulation holds no database lock and serializes harvest and pause safely',{skip:configured?false:'TEST_DATABASE_URL is not configured'},async()=>{
 const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((v):v is string=>!!v),process.env.ALLOW_NONLOCAL_TEST_DATABASE);
 const pool=new Pool({connectionString:url,max:4}),tag=`garden-worker-${randomUUID()}`,kid=`${tag}-kid`;
 let now=1000,hold=false,release!:()=>void,started!:()=>void;
 const waiting=new Promise<void>(resolve=>release=resolve),entered=new Promise<void>(resolve=>started=resolve);
 const town=createTownRepository(pool,()=>now,async(...args)=>{if(hold){started();await waiting;}return simulateGarden(...args);});
 const pending:Promise<unknown>[]=[];
 try {
  await migrate(drizzle({client:pool}),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  await pool.query('INSERT INTO families(id,email,display_name,password_hash,role) VALUES ($1,$2,$3,$4,$5)',[tag,`${tag}@example.test`,'Garden worker','not-a-real-password','family']);
  await pool.query('INSERT INTO profiles(id,family_id,name,emoji,color,public_id) VALUES ($1,$2,$3,$4,$5,$6)',[kid,tag,'Gardener','star','green',kid]);
  const saved=initialTown();saved.entities.push({id:'patch',blueprintId:'vegetable-patch',x:8,y:14,paidCost:{wood:4},garden:freshPatch('summer')});
  saved.entities.at(-1)!.garden!.slots.forEach(slot=>slot.growth=299);
  await pool.query('INSERT INTO town_state(profile_id,state) VALUES ($1,$2)',[kid,JSON.stringify(saved)]);
  const weather={season:'summer' as const,precipitation:'none' as const,timeOfDay:'noon'};
  await town.tick!(kid,'town',weather,true);now=6000;hold=true;
  const heartbeat=town.tick!(kid,'town',weather,false);pending.push(heartbeat);await entered;
  // Simulation must not reserve a spending lock or a pool connection.
  await pool.query('SELECT profile_id FROM town_state WHERE profile_id=$1 FOR UPDATE NOWAIT',[kid]);
  const command={type:'harvest' as const,entityId:'patch',generation:0};
  const harvests=[town.mutate(kid,saved.revision,command),town.mutate(kid,saved.revision,command)];pending.push(...harvests);
  const outcomes=Promise.allSettled(harvests),checkpoint=town.checkpoint!(kid);pending.push(checkpoint);
  release();await heartbeat;assert.equal((await outcomes).filter(r=>r.status==='fulfilled').length,1);await checkpoint;
  const persisted=(await pool.query('SELECT state FROM town_state WHERE profile_id=$1',[kid])).rows[0].state;
  assert.equal(persisted.materials.stamina,8,'only one harvest can spend the matured plants');
  assert.equal(persisted.gardening.harvests,4);assert.deepEqual(persisted.gardening.animals,[]);
  assert.ok(persisted.entities.find((e:any)=>e.id==='patch').garden.slots.every((slot:any)=>slot.growth===0));
 }finally{release();await Promise.allSettled(pending);await pool.query('DELETE FROM families WHERE id=$1',[tag]);await pool.end();}
});
