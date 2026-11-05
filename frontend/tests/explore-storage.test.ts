import assert from 'node:assert/strict';
import test from 'node:test';

test('active child selection is memory-only and old persisted identity is removed', async () => {
  const values = new Map([['plg-active-profile', JSON.stringify({ state: { activeProfileId: 'legacy-child' }, version: 0 })]]);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key),
  } });
  try {
    const { useProfileStore } = await import(new URL('../src/stores/profileStore.ts?storage-test', import.meta.url).href);
    assert.equal(useProfileStore.getState().activeProfileId, null);
    useProfileStore.getState().setActiveProfile('current-child');
    assert.equal(useProfileStore.getState().activeProfileId, 'current-child');
    assert.equal(values.has('plg-active-profile'), false);
    assert.ok(!JSON.stringify([...values]).includes('current-child'));
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
