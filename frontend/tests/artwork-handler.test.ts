import assert from 'node:assert/strict';
import { test } from 'node:test';
import catalog from '../server/artwork/catalog.json' with { type: 'json' };
import { createArtworkHandler } from '../server/artwork/handler.ts';

const [name, entry] = Object.entries(catalog.entries)[0]!;
const env = { ARTWORK_BLOB_ENABLED: 'true', BLOB_STORE_ID: 'store_test', RENDER_API_ORIGIN: 'https://api.example.test' };
function fixture(session: unknown = { authenticated: true, user: { id: 'family' } }) {
  const authCalls: Array<{ url: string; init?: RequestInit }> = [];
  const blobCalls: string[] = [];
  const readBlob = async (key: string) => {
    blobCalls.push(key);
    return { body: new Blob([new Uint8Array(entry.size)]).stream(), size: entry.size };
  };
  const fetcher: typeof fetch = async (input, init) => {
    authCalls.push({ url: String(input), init });
    return Response.json(session);
  };
  const handle = createArtworkHandler({ env, fetcher, readBlob });
  const request = (headers: HeadersInit = {}, method = 'GET', path = name) => new Request('https://app.test/api/artwork?path=' + encodeURIComponent(path), {
    method, headers: { cookie: 'irrelevant=secret; plg_session=valid_session; another=secret', ...headers },
  });
  return { handle, authCalls, blobCalls, readBlob, fetcher, request };
}

test('authenticated images use the catalog key and forward only the session cookie to the fixed Render origin', async () => {
  const f = fixture();
  const response = await f.handle(f.request({ authorization: 'Bearer forged', 'x-forwarded-host': 'evil.test' }));
  assert.equal(response.status, 200);
  assert.equal((await response.arrayBuffer()).byteLength, entry.size);
  assert.deepEqual(f.blobCalls, [entry.key]);
  assert.equal(f.authCalls[0]!.url, 'https://api.example.test/api/v1/auth/session');
  assert.deepEqual(Object.fromEntries(new Headers(f.authCalls[0]!.init!.headers)), { accept: 'application/json', cookie: 'plg_session=valid_session' });
  assert.equal(f.authCalls[0]!.init!.redirect, 'error');
  assert.equal(f.authCalls[0]!.init!.cache, 'no-store');
  assert.equal(response.headers.get('content-type'), entry.contentType);
  assert.equal(response.headers.get('vercel-cdn-cache-control'), 'no-store');
  assert.equal(response.headers.get('cache-control'), 'private, no-cache');
});

test('missing, ambiguous, or malformed cookies cannot use forged identity headers', async () => {
  const f = fixture();
  for (const cookie of ['', 'plg_session=a; plg_session=b', 'plg_session=invalid%20cookie']) {
    assert.equal((await f.handle(f.request({ cookie, authorization: 'Bearer forged' }))).status, 401);
  }
  assert.equal(f.authCalls.length, 0);
  assert.equal(f.blobCalls.length, 0);
});

test('Render denies anonymous and incomplete Google signup sessions before Blob access', async () => {
  for (const [session, status] of [
    [{ authenticated: false }, 401],
    [{ authenticated: true, user: { id: 'family' }, parentPasswordRequired: true }, 403],
    [{ authenticated: true }, 503],
    [{ authenticated: 'true', user: { id: 'family' } }, 503],
  ] as const) {
    const f = fixture(session);
    assert.equal((await f.handle(f.request())).status, status);
    assert.equal(f.blobCalls.length, 0);
  }
});

test('HEAD and conditional requests still verify the session every time', async () => {
  const f = fixture();
  const head = await f.handle(f.request({}, 'HEAD'));
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-length'), String(entry.size));
  const cached = await f.handle(f.request({ 'if-none-match': head.headers.get('etag')! }));
  assert.equal(cached.status, 304);
  assert.equal(f.authCalls.length, 2);
  assert.equal(f.blobCalls.length, 0);
  const anonymous = fixture({ authenticated: false });
  assert.equal((await anonymous.handle(anonymous.request({ 'if-none-match': head.headers.get('etag')! }))).status, 401);
});

test('only cataloged images and read methods are accepted', async () => {
  const f = fixture();
  for (const path of ['https://evil.test/image.png', '../secret', '__proto__', 'minigames/AGENTS.md']) {
    assert.equal((await f.handle(f.request({}, 'GET', path))).status, 404);
  }
  assert.equal((await f.handle(f.request({}, 'POST'))).status, 405);
  assert.equal((await f.handle(new Request(f.request().url + '&path=other', { headers: { cookie: 'plg_session=a' } }))).status, 400);
  assert.equal(f.authCalls.length, 0);
  assert.equal(f.blobCalls.length, 0);
});

test('disabled or unsafe configuration and failed session checks fail closed', async () => {
  const f = fixture();
  for (const patch of [{ ARTWORK_BLOB_ENABLED: 'false' }, { RENDER_API_ORIGIN: 'http://evil.test' }, { RENDER_API_ORIGIN: 'https://api.test/path' }, { BLOB_STORE_ID: '' }]) {
    const handle = createArtworkHandler({ env: { ...env, ...patch }, fetcher: f.fetcher, readBlob: f.readBlob });
    assert.equal((await handle(f.request())).status, 503);
  }
  for (const fetcher of [
    async () => { throw new Error('secret credential'); },
    async () => new Response('not JSON'),
    async () => Response.json({ authenticated: true }, { status: 500 }),
    async () => new Response('x'.repeat(17000)),
  ]) {
    const handle = createArtworkHandler({ env, fetcher, readBlob: f.readBlob });
    const response = await handle(f.request());
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes('secret credential'));
  }
  assert.equal(f.blobCalls.length, 0);
});

test('Blob failures are redacted and a size mismatch never serves an image', async () => {
  const f = fixture();
  for (const [readBlob, status] of [
    [async () => null, 404],
    [async () => { throw new Error('provider secret'); }, 502],
    [async () => ({ body: new Blob(['bad']).stream(), size: 3 }), 502],
  ] as const) {
    const response = await createArtworkHandler({ env, fetcher: f.fetcher, readBlob })(f.request());
    assert.equal(response.status, status);
    assert.ok(!(await response.text()).includes('provider secret'));
  }
});

test('truncated, oversized, and failed provider streams cannot return successful bytes', async () => {
  const f = fixture();
  for (const body of [
    new Blob(['short']).stream(),
    new Blob([new Uint8Array(entry.size + 1)]).stream(),
    new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('provider credential')); } }),
  ]) {
    const readBlob = async () => ({ body, size: entry.size });
    const response = await createArtworkHandler({ env, fetcher: f.fetcher, readBlob })(f.request());
    assert.equal(response.status, 200); // A stream may fail after headers have been sent.
    await assert.rejects(() => response.arrayBuffer(), /^Error: Artwork stream unavailable$/);
  }
});

test('the configured session cookie is supported without forwarding unrelated cookies', async () => {
  const f = fixture();
  const handle = createArtworkHandler({ env: { ...env, SESSION_COOKIE_NAME: 'custom_session' }, fetcher: f.fetcher, readBlob: f.readBlob });
  const response = await handle(f.request({ cookie: 'custom_session=valid; plg_session=wrong' }, 'HEAD'));
  assert.equal(response.status, 200);
  assert.equal(new Headers(f.authCalls[0]!.init!.headers).get('cookie'), 'custom_session=valid');
});

test('operational logs contain only fixed reason codes, never raw provider errors', async () => {
  const f = fixture();
  const reasons: string[] = [];
  const handle = createArtworkHandler({
    env, fetcher: f.fetcher,
    readBlob: async () => { throw new Error('provider credential and request details'); },
    reportFailure(reason) { reasons.push(reason); },
  });
  assert.equal((await handle(f.request())).status, 502);
  assert.deepEqual(reasons, ['blob_unavailable']);
});
