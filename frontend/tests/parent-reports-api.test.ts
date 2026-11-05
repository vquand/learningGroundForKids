import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchParentReports, fetchParentContentItem } from '../src/api/parentReports.ts';
import { ApiError } from '../src/api/core.ts';
import { clearParentQueryCache, isParentQueryKey, getParentAccessGeneration } from '../src/lib/parentQueryCache.ts';
import { familyScopedQuery, InactiveFamilySessionError, isPrivateQueryKey, type FamilySessionSnapshot } from '../src/lib/familyQueries.ts';
import { createRequestLifecycle } from '../src/lib/requestLifecycle.ts';

test('parent reports and item reads stay same-origin and send no client family identity', async () => {
  const original = globalThis.fetch;
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  globalThis.fetch = async (path, init) => { calls.push({ path: String(path), init }); return Response.json({}); };
  try {
    await fetchParentReports(); await fetchParentContentItem('item/one?private=true#fragment');
  } finally { globalThis.fetch = original; }
  assert.deepEqual(calls.map(call => call.path), ['/api/v1/parent/reports', '/api/v1/parent/content/item%2Fone%3Fprivate%3Dtrue%23fragment']);
  for (const call of calls) {
    const headers = new Headers(call.init?.headers);
    assert.equal(call.init?.credentials, 'same-origin');
    assert.equal(headers.get('accept'), 'application/json');
    assert.equal(call.init?.body, undefined);
    assert.equal(headers.has('authorization'), false);
  }
});

test('parent report API preserves structured access errors for the parent gate', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json(
    { error: { code: 'PARENT_ACCESS_REQUIRED', message: 'Parent access required' } },
    { status: 403 },
  );
  try {
    await assert.rejects(fetchParentReports(), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 403);
      assert.equal(error.code, 'PARENT_ACCESS_REQUIRED');
      assert.equal(error.message, 'Parent access required');
      return true;
    });
  } finally { globalThis.fetch = original; }
});

test('parent report results cannot cross a family session transition while in flight', async () => {
  const original = globalThis.fetch;
  let resolveFetch!: (response: Response) => void;
  const response = new Promise<Response>(resolve => { resolveFetch = resolve; });
  let snapshot: FamilySessionSnapshot = { familyId: 'family-a', sessionGeneration: 1 };
  globalThis.fetch = async () => response;
  try {
    const pending = familyScopedQuery('family-a', fetchParentReports, () => snapshot)();
    snapshot = { familyId: 'family-b', sessionGeneration: 2 };
    resolveFetch(Response.json({ family: 'family-a' }));
    await assert.rejects(pending, (error: unknown) => error instanceof InactiveFamilySessionError);
  } finally { globalThis.fetch = original; }
});

test('locking clears protected reports and management caches while leaving kid gameplay alone', async () => {
  const queries = ['parent-reports','parent-lesson','parent-lesson-catalog','parent-share-targets','miniku-puzzles','miniku-settings','profiles','town','miniku'].map(prefix => ({ queryKey: [prefix,'family-a'] }));
  let remaining = [...queries];
  let cancelled: string[] = [];
  await clearParentQueryCache({
    async cancelQueries(filters) { cancelled = remaining.filter(query => filters!.predicate!(query as never)).map(query => String(query.queryKey[0])); },
    removeQueries(filters) { remaining = remaining.filter(query => !filters!.predicate!(query as never)); },
  });
  assert.deepEqual(cancelled, ['parent-reports','parent-lesson','parent-lesson-catalog','parent-share-targets','miniku-puzzles','miniku-settings']);
  assert.deepEqual(remaining.map(query => query.queryKey[0]), ['profiles','town','miniku']);
  assert.ok(isPrivateQueryKey(['parent-reports','family-a']));
  assert.ok(isParentQueryKey(['parent-reports','family-a']));
});
test('a late parent mutation is discarded immediately on access loss, even before view unmount', async () => {
  const expected = getParentAccessGeneration();
  const requests = createRequestLifecycle(() => expected === getParentAccessGeneration());
  let resolve!: () => void;
  const response = new Promise<void>(done => { resolve = done; });
  let updates = 0;
  const pending = requests.run(() => response, { success: () => { updates++; }, finish: () => { updates++; } });
  await clearParentQueryCache({ async cancelQueries() {}, removeQueries() {} });
  resolve(); await pending;
  assert.equal(updates, 0);
});
