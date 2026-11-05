import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchUfo, startUfo, actUfo, listUfoWords, saveUfoWord, deleteUfoWord, loadUfoMaster } from '../src/api/ufo.ts';
import { isPrivateQueryKey } from '../src/lib/familyQueries.ts';
test('UFO API sends same-origin actions without client progress or identity',async()=>{
 const original=globalThis.fetch;const requests:{path:string;init:RequestInit}[]=[];
 globalThis.fetch=(async(input,init)=>{requests.push({path:String(input),init:init!});return init?.method==='DELETE'?new Response(null,{status:204}):Response.json({revision:1});}) as typeof fetch;
 try {
  await fetchUfo('profile/one');await startUfo('profile/one',0,{difficulty:'easy',animal:'cow',background:'farm'});await actUfo('profile/one',1,{type:'guess',letter:'E'});
  await listUfoWords();const w={word:'APPLE',clue:'A crunchy fruit.',definition:'A fruit grown on a tree.',difficulty:'easy' as const};await saveUfoWord(w);await saveUfoWord(w,'word/one');await deleteUfoWord('word/one');await loadUfoMaster();
  assert.equal(requests.length,8);assert.equal(requests[0]?.path,'/api/v1/profiles/profile%2Fone/ufo');assert.deepEqual(JSON.parse(requests[2]!.init.body as string),{revision:1,action:{type:'guess',letter:'E'}});
  assert.equal(requests[5]?.init.method,'PUT');assert.equal(requests[6]?.init.method,'DELETE');assert.equal(requests[7]?.path,'/api/v1/admin/ufo/words/master');
  for(const r of requests){assert.equal(r.init.credentials,'same-origin');assert.equal(new Headers(r.init.headers).has('Authorization'),false);}
 }finally{globalThis.fetch=original;}
});
test('UFO achievement state is private family-scoped cache data',()=>assert.equal(isPrivateQueryKey(['ufo','family-1','profile-1']),true));
