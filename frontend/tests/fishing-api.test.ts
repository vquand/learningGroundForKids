import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actFishing, fetchFishing } from '../src/api/fishing.ts';
test('fishing transport uses profile-scoped same-origin revisioned commands without claims', async () => {
  const original = globalThis.fetch; const requests: { path: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => { requests.push({ path: String(input), init }); return Response.json({ revision: 8 }); };
  try {
    await fetchFishing('kid/a'); await actFishing('kid/a', 7, { type: 'answer', questionId: 'issued-1', answer: 42 });
    assert.equal(requests[0]?.path, '/api/v1/profiles/kid%2Fa/fishing');
    assert.equal(requests[1]?.init?.credentials, 'same-origin');
    assert.deepEqual(JSON.parse(String(requests[1]?.init?.body)), { revision: 7, command: { type: 'answer', questionId: 'issued-1', answer: 42 } });
  } finally { globalThis.fetch = original; }
});
