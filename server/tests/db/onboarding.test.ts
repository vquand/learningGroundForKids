import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from '../../src/db/index.js';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
const url=process.env.TEST_DATABASE_URL;
test('new families persist setup and Skip across sessions while historical/default inserts stay dismissed',{skip:url?false:'TEST_DATABASE_URL not configured'},async()=>{
  const safeUrl=assertSafeTestDatabaseUrl(url!,[process.env.DATABASE_URL??'',process.env.DATABASE_URL_UNPOOLED??'']);
  const pool=new Pool({connectionString:safeUrl}),db=createDatabase(safeUrl);
  const id=randomUUID(),other=randomUUID(),old=randomUUID();
  try{
    await migrate(drizzle(pool),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
    for(const familyId of [id,other])await db.auth.createFamily({id:familyId,email:`${familyId}@test.local`,displayName:'Setup test',passwordHash:'unused',role:'family'});
    await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',[old,`${old}@test.local`,'Historical/default','unused']);
    assert.equal((await db.auth.findFamilyById(old))!.onboardingDismissed,true);
    assert.equal((await db.auth.findFamilyById(id))!.onboardingDismissed,false);
    await db.auth.createSession({familyId:id,tokenHash:id,expiresAt:new Date(Date.now()+60000)});
    await Promise.all([db.auth.updateOnboarding(id,'visit'),db.auth.updateOnboarding(id,'dismiss')]);
    await db.auth.updateOnboarding(id,'dismiss');
    const session=await db.auth.findFamilyBySessionHash(id,new Date());
    assert.equal(session!.onboardingDismissed,true);assert.equal(session!.onboardingParentVisited,true);
    assert.equal((await db.auth.findFamilyById(other))!.onboardingDismissed,false);
    assert.equal((await db.auth.findFamilyById(other))!.onboardingParentVisited,false);
  }finally{await pool.query('DELETE FROM families WHERE id=ANY($1)',[[id,other,old]]);await db.close?.();await pool.end();}
});
