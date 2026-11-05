import assert from 'node:assert/strict';
import test from 'node:test';
import { actMiniku, fetchMiniku } from '../src/api/miniku.ts';
import { isPrivateQueryKey } from '../src/lib/familyQueries.ts';

test('Miniku uses same-origin profile routes and sends only the selected action', async () => {
  const original = globalThis.fetch;
  const calls: { path: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (path, init) => { calls.push({ path: String(path), init }); return Response.json({ revision: 1 }); };
  try {
    await fetchMiniku('kid/one');
    await actMiniku('kid/one', 0, { type: 'start', size: 3 });
    await actMiniku('kid/one', 1, { type: 'set-cell', index: 2, value: 3 });
    assert.equal(calls[0]!.path, '/api/v1/profiles/kid%2Fone/miniku');
    assert.deepEqual(JSON.parse(String(calls[2]!.init?.body)), { revision: 1, command: { type: 'set-cell', index: 2, value: 3 } });
    for (const call of calls) {
      assert.equal(call.init?.credentials, 'same-origin');
      assert.equal(new Headers(call.init?.headers).has('Authorization'), false);
    }
  } finally { globalThis.fetch = original; }
});

test('Miniku progress stays in the private family cache', () => {
  assert.equal(isPrivateQueryKey(['miniku', 'family-a', 'kid-a']), true);
});
