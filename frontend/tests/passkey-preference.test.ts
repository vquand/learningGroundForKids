import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPasskeys, parentAccessStatus, passkeyPreferred, removePasskey } from '../src/api/passkeys.ts';

test('legacy passkey preference is a fallback only while the server cookie is absent', () => {
  const documentBefore = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const storageBefore = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'true', setItem: () => { throw new Error('client must not write preference'); } } });
    for (const [cookie, expected] of [
      ['', true], ['plg_passkey_preferred=false', false], ['plg_passkey_preferred=0', false],
      ['other=true; plg_passkey_preferred=true', true],
      ['other_plg_passkey_preferred=true', true],
    ] as const) {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie } });
      assert.equal(passkeyPreferred(), expected);
    }
    Object.defineProperty(globalThis, 'document', { configurable: true, get: () => { throw new Error('storage unavailable'); } });
    assert.equal(passkeyPreferred(), false);
  } finally {
    if (documentBefore) Object.defineProperty(globalThis, 'document', documentBefore); else Reflect.deleteProperty(globalThis, 'document');
    if (storageBefore) Object.defineProperty(globalThis, 'localStorage', storageBefore); else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('authenticated passkey status and list reconcile the legacy flag only after success', async () => {
  const fetchBefore = globalThis.fetch;
  const storageBefore = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const documentBefore = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let legacy: string | null = 'true';
  let fail = false;
  try {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: '' } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem(key: string) { assert.equal(key, 'plg-passkey-preferred'); return legacy; },
      removeItem(key: string) { assert.equal(key, 'plg-passkey-preferred'); legacy = null; },
    } });
    globalThis.fetch = async (url, init) => {
      assert.equal(init?.credentials, 'same-origin');
      assert.equal(init?.cache, 'no-store');
      if (fail) return Response.json({ error: { message: 'Try again', code: 'UNAVAILABLE' } }, { status: 503 });
      if (url === '/api/v1/parent/access') return Response.json({ elevated: false, method: null, expires_at: null, passkeys_enabled: true, passkeys_enrolled: false });
      assert.equal(url, '/api/v1/parent/passkeys');
      return Response.json([]);
    };
    assert.equal(passkeyPreferred(), true);
    fail = true;
    await assert.rejects(parentAccessStatus());
    await assert.rejects(listPasskeys());
    assert.equal(legacy, 'true', 'an unavailable authenticated read cannot reconcile enrollment');
    fail = false;
    await parentAccessStatus();
    assert.equal(legacy, null, 'authenticated status removes the old fallback');
    assert.equal(passkeyPreferred(), false);
    legacy = 'true';
    await listPasskeys();
    assert.equal(legacy, null, 'authenticated list also removes the old fallback');
  } finally {
    globalThis.fetch = fetchBefore;
    if (documentBefore) Object.defineProperty(globalThis, 'document', documentBefore); else Reflect.deleteProperty(globalThis, 'document');
    if (storageBefore) Object.defineProperty(globalThis, 'localStorage', storageBefore); else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('blocked legacy storage does not break a server-confirmed preference or status', async () => {
  const fetchBefore = globalThis.fetch;
  const storageBefore = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const documentBefore = Object.getOwnPropertyDescriptor(globalThis, 'document');
  try {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'plg_passkey_preferred=true' } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
    assert.equal(passkeyPreferred(), true);
    globalThis.fetch = async () => Response.json({ elevated: true, method: 'passkey', expires_at: null, passkeys_enabled: true, passkeys_enrolled: true });
    assert.equal((await parentAccessStatus()).elevated, true);
  } finally {
    globalThis.fetch = fetchBefore;
    if (documentBefore) Object.defineProperty(globalThis, 'document', documentBefore); else Reflect.deleteProperty(globalThis, 'document');
    if (storageBefore) Object.defineProperty(globalThis, 'localStorage', storageBefore); else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('deleting a passkey does not overwrite the preference from a stale browser list', async () => {
  const originalFetch = globalThis.fetch;
  const documentBefore = Object.getOwnPropertyDescriptor(globalThis, 'document');
  try {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: Object.freeze({ cookie: 'plg_passkey_preferred=true' }) });
    globalThis.fetch = async (url, init) => {
      assert.equal(url, '/api/v1/parent/passkeys/stale-key');
      assert.equal(init?.method, 'DELETE');
      assert.equal(init?.credentials, 'same-origin');
      return new Response(null, { status: 204 });
    };
    await removePasskey('stale-key');
    assert.equal(passkeyPreferred(), true);
  } finally {
    globalThis.fetch = originalFetch;
    if (documentBefore) Object.defineProperty(globalThis, 'document', documentBefore); else Reflect.deleteProperty(globalThis, 'document');
  }
});
