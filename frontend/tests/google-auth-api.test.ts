import assert from 'node:assert/strict';
import test from 'node:test';
import { startGoogleAuth } from '../src/api/googleAuth.ts';

test('Google signup sends consent to the same-origin start endpoint; login sends no signup consent', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const destinations: string[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { assign: (url: string) => destinations.push(url) } } });
  try {
    for (const purpose of ['signup', 'login', 'parent'] as const) {
      globalThis.fetch = async (input, init) => {
        assert.equal(String(input), '/api/v1/auth/google/start');
        assert.equal(init?.method, 'POST');
        assert.equal(init?.credentials, 'same-origin');
        assert.deepEqual(JSON.parse(String(init?.body)), { purpose, ...(purpose === 'signup' ? { legalVersion: 'fetched-version' } : {}) });
        return Response.json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?state=opaque' });
      };
      await startGoogleAuth(purpose, 'fetched-version');
    }
    assert.equal(destinations.length, 3);
    globalThis.fetch = async () => Response.json({ url: 'https://evil.example/' });
    await assert.rejects(startGoogleAuth('signup', 'fetched-version'), /Invalid Google/);
    assert.equal(destinations.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
