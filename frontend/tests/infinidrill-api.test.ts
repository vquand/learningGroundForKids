import assert from 'node:assert/strict';
import test from 'node:test';
import { getInfinidrill, sendInfinidrill } from '../src/api/infinidrill.ts';
import { fetchAchievementCatalog, migrateAchievementCatalog } from '../src/api/achievementCatalog.ts';
import { isPrivateQueryKey } from '../src/lib/familyQueries.ts';
test('Infinidrill and catalog clients use cookie-authenticated same-origin routes and commands', async () => {
  const original = globalThis.fetch;
  const requests: Array<{ path: string; init: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => { requests.push({ path: String(input), init: init! }); return Response.json({ revision: 1 }); }) as typeof fetch;
  try {
    await getInfinidrill('profile/one');
    await sendInfinidrill('profile/one', 4, { type: 'submit-answer', questionId: 'q-1', answer: 42 });
    await fetchAchievementCatalog();
    await migrateAchievementCatalog();
    assert.equal(requests[0]!.path, '/api/v1/profiles/profile%2Fone/infinidrill');
    assert.equal(requests[1]!.path, '/api/v1/profiles/profile%2Fone/infinidrill/action');
    assert.deepEqual(JSON.parse(requests[1]!.init.body as string), { revision: 4, command: { type: 'submit-answer', questionId: 'q-1', answer: 42 } });
    assert.equal(requests[2]!.path, '/api/v1/admin/achievements');
    assert.equal(requests[3]!.path, '/api/v1/admin/achievements/migrate');
    assert.equal(requests[3]!.init.method, 'POST');
    assert.equal(requests[3]!.init.body, undefined);
    for (const request of requests) {
      assert.equal(request.init.credentials, 'same-origin');
      assert.equal(new Headers(request.init.headers).has('Authorization'), false);
    }
  } finally { globalThis.fetch = original; }
});
test('Infinidrill badges are cleared with private family query data', () => {
  assert.equal(isPrivateQueryKey(['infinidrill-badges', 'family-a', 'profile-a']), true);
});
