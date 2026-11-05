import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { readCatalogFixtures } from '../../src/catalog-refresh.js';
import { buildCatalogSeed, catalogContentHash, catalogItemId } from '../../src/db/catalog-seed.js';
import { runSeedTransaction } from '../../src/db/seed-runner.js';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';

const configured=process.env.TEST_DATABASE_URL;
test('reviewed SQL replaces only 30 system lessons atomically, preserves history and repeats without writes', {skip:configured?false:'TEST_DATABASE_URL not configured'}, async()=>{
  const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((v):v is string=>!!v));
  const pool=new Pool({connectionString:url,max:1});
  const {items}=await readCatalogFixtures(fileURLToPath(new URL('../../../',import.meta.url)));
  const reviewed=items.filter(item=>item.content_review?.batch==='exploring-30-2026-10-23');
  const ids=reviewed.map(catalogItemId);
  const sql=await readFile(new URL('../../../docs/migrations/neon-2026-10-23-exploring-content.sql',import.meta.url),'utf8');
  const family='exploring-content-sql-test';
  try{
    await migrate(drizzle({client:pool}),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
    // These canonical system IDs are used only in the explicitly guarded test database.
    const legacy=reviewed.map(item=>{
      const previous=structuredClone(item); delete previous.flashcards; delete previous.content_review;
      return {...previous,is_published:false,
      translations:item.translations!.map(t=>({...t,description:'Previous lesson description.',history:'Previous lesson history.'})),
      quiz_questions:item.quiz_questions!.map(q=>({...q,question:`Previous: ${q.question}`}))};});
    await runSeedTransaction(pool,buildCatalogSeed(legacy,{}).statements);
    await pool.query("INSERT INTO items (id,category,latitude,longitude,is_published,source_type,location_desc) VALUES ($1,'landmark',0,0,false,'custom','Unrelated family lesson')",[family]);
    const unrelated=(await pool.query('SELECT * FROM items WHERE id=$1',[family])).rows;
    await pool.query("INSERT INTO families (id,email,display_name,password_hash) VALUES ($1,$2,'Test','unused')",[family,`${family}@example.test`]);
    await pool.query("INSERT INTO profiles (id,family_id,name,emoji,color,public_id) VALUES ($1,$1,'Test','star','blue',$1)",[family]);
    await pool.query("INSERT INTO profile_progress (id,profile_id,item_id,category) VALUES ($1,$1,$2,$3)",[family,ids[0],reviewed[0]!.category]);
    await pool.query("INSERT INTO family_disabled_lessons (family_id,item_id) VALUES ($1,$2)",[family,ids[0]]);
    const oldQuestion=(await pool.query('SELECT * FROM quiz_questions WHERE item_id=$1 ORDER BY id LIMIT 1',[ids[0]])).rows[0];
    const oldCard=(await pool.query('SELECT * FROM flashcards WHERE item_id=$1 ORDER BY id LIMIT 1',[ids[0]])).rows[0];
    await pool.query("INSERT INTO daily_quiz_snapshots (id,profile_id,snapshot_date,lang,question_ids) VALUES ($1,$1,'2026-10-23','en',$2::jsonb)",[family,JSON.stringify([oldQuestion.id])]);
    await pool.query("INSERT INTO flashcard_study_sessions (id,profile_id,theme_type,theme_value,lang,cards_shown,got_it_count,review_again_count,responses,started_at) VALUES ($1,$1,'item',$2,'en',1,1,0,$3::jsonb,now())",[family,ids[0],JSON.stringify([{flashcard_id:oldCard.id,rating:'got_it'}])]);
    await pool.query("INSERT INTO flashcards (id,item_id,lang,front,back,is_published,source_type) VALUES ($1,$2,'en','Family-added prompt','Keep this manual card',true,'manual')",[family,ids[0]]);
    const histories=async()=>Promise.all(['profile_progress','daily_quiz_snapshots','flashcard_study_sessions','family_disabled_lessons'].map(table=>pool.query(`SELECT * FROM ${table} ORDER BY 1`).then(r=>r.rows)));
    const beforeHistory=await histories();
    // Missing or custom-owned targets abort before any of the other 29 can change.
    const beforeItems=(await pool.query('SELECT * FROM items WHERE id=ANY($1::text[]) ORDER BY id',[ids])).rows;
    await pool.query("UPDATE items SET source_type='custom' WHERE id=$1",[ids[29]]);
    await assert.rejects(()=>pool.query(sql),/Missing or non-system/);await pool.query('ROLLBACK');
    await pool.query("UPDATE items SET source_type='system' WHERE id=$1",[ids[29]]);
    assert.deepEqual((await pool.query('SELECT * FROM items WHERE id=ANY($1::text[]) ORDER BY id',[ids])).rows.map(r=>({...r,updated_at:null})),beforeItems.map(r=>({...r,updated_at:null})));
    await pool.query(sql);
    for(const item of reviewed){
      const id=catalogItemId(item);
      const stored=(await pool.query('SELECT is_published,catalog_content_hash FROM items WHERE id=$1',[id])).rows[0];
      assert.equal(stored.is_published,true);assert.equal(stored.catalog_content_hash,catalogContentHash(item));
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM quiz_questions WHERE item_id=$1 AND is_active',[id])).rows[0].n,item.quiz_questions!.length);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM flashcards WHERE item_id=$1 AND is_published AND source_type='catalog_authored'",[id])).rows[0].n,4);
      const translations=(await pool.query('SELECT lang,title,description,history FROM item_translations WHERE item_id=$1 ORDER BY lang',[id])).rows;
      assert.deepEqual(translations,[...item.translations!].sort((a,b)=>a.lang.localeCompare(b.lang)));
      const quizzes=(await pool.query('SELECT lang,question,options,correct_answers,question_group_id FROM quiz_questions WHERE item_id=$1 AND is_active ORDER BY lang,sort_order',[id])).rows;
      assert.equal(new Set(quizzes.map(q=>q.question_group_id)).size,2);
      assert.deepEqual(quizzes.map(({question_group_id,...q})=>q),[...item.quiz_questions!].sort((a,b)=>a.lang.localeCompare(b.lang)||(a.sort_order??0)-(b.sort_order??0)).map(q=>({lang:q.lang,question:q.question,options:q.options,correct_answers:q.correct_answers})));
      const cards=(await pool.query("SELECT lang,front,back FROM flashcards WHERE item_id=$1 AND is_published AND source_type='catalog_authored' ORDER BY lang,sort_order",[id])).rows;
      assert.deepEqual(cards,[...item.flashcards!].sort((a,b)=>a.lang.localeCompare(b.lang)||(a.sort_order??0)-(b.sort_order??0)).map(c=>({lang:c.lang,front:c.front,back:c.back})));
    }
    assert.deepEqual(await histories(),beforeHistory);
    assert.deepEqual((await pool.query('SELECT * FROM items WHERE id=$1',[family])).rows,unrelated);
    const retiredQuestion=(await pool.query('SELECT * FROM quiz_questions WHERE id=$1',[oldQuestion.id])).rows[0];
    assert.deepEqual({...retiredQuestion,is_active:true},oldQuestion);
    assert.equal(retiredQuestion.is_active,false);
    assert.equal((await pool.query('SELECT is_published FROM flashcards WHERE id=$1',[oldCard.id])).rows[0].is_published,false);
    assert.equal((await pool.query('SELECT is_published FROM flashcards WHERE id=$1',[family])).rows[0].is_published,true);
    const snapshot=async()=>Promise.all(['items','item_translations','quiz_questions','flashcards','explore_revisions'].map(table=>pool.query(`SELECT * FROM ${table} ORDER BY 1`).then(r=>r.rows)));
    const first=await snapshot();await pool.query(sql);assert.deepEqual(await snapshot(),first,'repeat performs no content or revision writes');
    // A subsequent normal seed keeps authored-only cards and stable active question IDs.
    await runSeedTransaction(pool,buildCatalogSeed(reviewed,{}).statements);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM flashcards WHERE item_id=ANY($1::text[]) AND is_published AND source_type IN ('catalog_description','catalog_history','catalog_quiz')",[ids])).rows[0].n,0);
    assert.deepEqual(await histories(),beforeHistory);
  }finally{
    await pool.query('ROLLBACK');
    await pool.query('DELETE FROM families WHERE id=$1',[family]);
    await pool.query('DELETE FROM items WHERE id=ANY($1::text[])',[ids]);
    await pool.query('DELETE FROM items WHERE id=$1',[family]);
    await pool.end();
  }
});
