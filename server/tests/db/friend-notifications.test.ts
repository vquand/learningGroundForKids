import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {fileURLToPath} from 'node:url';
import {assertSafeTestDatabaseUrl} from '../../src/db/test-database.ts';
import {createDatabase} from '../../src/db/index.ts';
test('friend notifications expose only participating avatar identities and current authorized photos',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((s):s is string=>!!s));
 const pool=new Pool({connectionString:url}),db=createDatabase(url),a=randomUUID(),b=randomUUID(),outside=randomUUID(),kid=randomUUID(),target=randomUUID();
 const key=`profile-avatars/${a}/${kid}/photo.png`,targetKey=`profile-avatars/${b}/${target}/photo.png`;
 try{
  await migrate(drizzle(pool),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
  for(const id of [a,b,outside])await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',[id,`${id}@notifications.test`,'Willow','unused']);
  for(const [id,family,name]of [[kid,a,'Mina'],[target,b,'Theo']])await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)',[id,family,name,'🐱','#776655']);
  await pool.query('UPDATE profiles SET avatar_type=$2,avatar_url=$3 WHERE id=$1',[kid,'custom',`/media/${key}`]);
  const request=await db.friendRequests.create(a,{requesting_scope:'profile',requesting_profile_id:kid,target_scope:'profile',target_code:target});
  const [row]=await db.friendRequests.list(b,100);
  assert.equal(row!.requesting_party!.name,'Mina');assert.equal(row!.target_party!.name,'Theo');assert.equal(row!.requesting_party!.avatar_url,`/media/${key}`);
  assert.deepEqual(Object.keys(row!.requesting_party!).sort(),['avatar_frame','avatar_type','avatar_url','color','emoji','name']);
  assert.deepEqual(await db.friendRequests.list(outside,100),[]);
  await pool.query('UPDATE profiles SET avatar_type=$2,avatar_url=$3 WHERE id=$1',[target,'custom',`/media/${targetKey}`]);
  // Asking is not enough: the asker sees the asked person's photo only after acceptance.
  assert.equal(await db.friendRequests.canReadAvatar!(a,targetKey),false);
  assert.equal((await db.friendRequests.list(a,100))[0]!.target_party!.avatar_url,null);
  assert.equal(await db.friendRequests.canReadAvatar!(b,key),true);assert.equal(await db.friendRequests.canReadAvatar!(outside,key),false);
  assert.equal(await db.friendRequests.canReadAvatar!(b,key.replace('photo.png','old-photo.png')),false);
  await db.friendRequests.respond(b,request.id,true);assert.equal(await db.friendRequests.canReadAvatar!(b,key),true);assert.equal(await db.friendRequests.canReadAvatar!(a,targetKey),true);
  await pool.query('UPDATE friend_requests SET status=$2 WHERE id=$1',[request.id,'rejected']);
  assert.equal(await db.friendRequests.canReadAvatar!(b,key),false);
  assert.equal((await db.friendRequests.list(b,100))[0]!.requesting_party!.avatar_url,null);
 }finally{await pool.query('DELETE FROM families WHERE id=ANY($1::text[])',[[a,b,outside]]);await pool.end();await db.close?.();}
});
