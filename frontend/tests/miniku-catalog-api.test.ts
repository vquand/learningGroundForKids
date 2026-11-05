import assert from 'node:assert/strict';
import test from 'node:test';
import { createMinikuPuzzle, fetchMinikuPuzzles, fetchMinikuSettings, updateMinikuPuzzle, updateMinikuSettings, type MinikuPuzzle } from '../src/api/minikuCatalog.ts';
import { isPrivateQueryKey } from '../src/lib/familyQueries.ts';
test('custom puzzle menus use scoped APIs without sending owners or solutions', async () => {
  const original=globalThis.fetch;
  const calls: Array<{path:string; init?:RequestInit}>=[];
  globalThis.fetch=async(path,init)=>{calls.push({path:String(path),init});return Response.json({hints:false});};
  const puzzle:MinikuPuzzle={id:'puzzle/a',size:3,givens:[1,0,0,0,2,0,0,0,3],enabled:true,revision:2,ownerFamilyId:'family'};
  try {
    await fetchMinikuPuzzles(true); await fetchMinikuPuzzles(false);
    await createMinikuPuzzle(puzzle,false); await updateMinikuPuzzle(puzzle,true); await updateMinikuPuzzle(puzzle,false);
    await fetchMinikuSettings(); await updateMinikuSettings(false);
    assert.deepEqual(calls.map(c=>c.path),['/api/v1/admin/miniku/puzzles','/api/v1/parent/miniku/puzzles','/api/v1/parent/miniku/puzzles','/api/v1/admin/miniku/puzzles/puzzle%2Fa','/api/v1/parent/miniku/puzzles/puzzle%2Fa','/api/v1/parent/miniku/settings','/api/v1/parent/miniku/settings']);
    assert.deepEqual(JSON.parse(String(calls[2]!.init?.body)),{size:3,givens:puzzle.givens,enabled:true});
    assert.deepEqual(JSON.parse(String(calls[3]!.init?.body)),{givens:puzzle.givens,enabled:true,revision:2});
    assert.deepEqual(JSON.parse(String(calls[6]!.init?.body)),{hints:false});
    for(const call of calls){assert.equal(call.init?.credentials,'same-origin');assert.equal(new Headers(call.init?.headers).has('Authorization'),false);}
    assert.ok(isPrivateQueryKey(['miniku-puzzles','family']));assert.ok(isPrivateQueryKey(['miniku-settings','family']));
  } finally { globalThis.fetch=original; }
});
