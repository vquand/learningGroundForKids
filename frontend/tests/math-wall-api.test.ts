import assert from 'node:assert/strict';
import test from 'node:test';
import { actMathWall, startMathWall, fetchMathLeaders } from '../src/api/mathWall.ts';
import { isPrivateQueryKey } from '../src/lib/familyQueries.ts';

test('math game uses same-origin cookies and sends only settings or server-validated actions', async () => {
  const original = globalThis.fetch;
  const calls: { path: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (path, init) => { calls.push({ path: String(path), init }); return Response.json({ revision: 1 }); };
  try {
    await startMathWall('kid/one', 0, { animal: 'cow', language: 'vi', wall: 'stone' });
    await actMathWall('kid/one', 1, { type: 'lane', lane: 2 });
    await fetchMathLeaders('kid/one');
    assert.equal(calls[0]!.path, '/api/v1/profiles/kid%2Fone/math-wall/start');
    assert.deepEqual(JSON.parse(String(calls[1]!.init?.body)), { revision: 1, action: { type: 'lane', lane: 2 } });
    for (const call of calls) {
      assert.equal(call.init?.credentials, 'same-origin');
      assert.equal(new Headers(call.init?.headers).has('Authorization'), false);
    }
  } finally { globalThis.fetch = original; }
});

test('math progress and friends rankings are removed with private session caches', () => {
  assert.equal(isPrivateQueryKey(['math-wall', 'family-a', 'kid-a']), true);
  assert.equal(isPrivateQueryKey(['math-wall-leaders', 'family-a', 'kid-a', 4]), true);
});
