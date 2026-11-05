import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { EVENT_ICON_KEYS, GENERIC_EVENT_ICON_GROUPS, SYSTEM_EVENT_KEYS } from '../src/calendar/catalog.js';

const catalogUrl = new URL('../../frontend/src/lib/calendarEventCatalog.ts', import.meta.url);

interface FrontendEventCatalog {
  SYSTEM_EVENT_CATALOG: readonly { key: string }[];
  GENERIC_EVENT_CATALOG: readonly { key: string; group: string }[];
  GENERIC_EVENT_GROUPS: readonly string[];
  EVENT_ICON_ENTRIES: readonly { key: string }[];
}

test('frontend system event labels match the server system event keys in both directions', async (context) => {
  try { await access(catalogUrl); } catch {
    context.skip('Frontend event catalog has not been added yet');
    return;
  }
  const frontend = await import(catalogUrl.href) as FrontendEventCatalog;
  const frontendKeys = frontend.SYSTEM_EVENT_CATALOG.map((entry) => entry.key);
  assert.equal(new Set(frontendKeys).size, frontendKeys.length, 'no duplicate system keys');
  assert.deepEqual([...frontendKeys].sort(), [...SYSTEM_EVENT_KEYS].sort());
});

test('frontend generic event groups match the server generic icon groups in both directions', async (context) => {
  try { await access(catalogUrl); } catch {
    context.skip('Frontend event catalog has not been added yet');
    return;
  }
  const frontend = await import(catalogUrl.href) as FrontendEventCatalog;
  assert.deepEqual([...frontend.GENERIC_EVENT_GROUPS].sort(), Object.keys(GENERIC_EVENT_ICON_GROUPS).sort());
  for (const group of frontend.GENERIC_EVENT_GROUPS) {
    const frontendKeys = frontend.GENERIC_EVENT_CATALOG.filter((entry) => entry.group === group).map((entry) => entry.key);
    const serverKeys = GENERIC_EVENT_ICON_GROUPS[group as keyof typeof GENERIC_EVENT_ICON_GROUPS];
    assert.ok(serverKeys, `server group ${group}`);
    assert.deepEqual([...frontendKeys].sort(), [...serverKeys].sort(), `keys in ${group}`);
  }
  assert.equal(frontend.GENERIC_EVENT_CATALOG.length, Object.values(GENERIC_EVENT_ICON_GROUPS).flat().length);
});

test('the frontend kid-event icon picker offers exactly the server event icon keys', async (context) => {
  try { await access(catalogUrl); } catch {
    context.skip('Frontend event catalog has not been added yet');
    return;
  }
  const frontend = await import(catalogUrl.href) as FrontendEventCatalog;
  const frontendKeys = frontend.EVENT_ICON_ENTRIES.map((entry) => entry.key);
  assert.equal(new Set(frontendKeys).size, frontendKeys.length, 'picker keys are unique');
  assert.deepEqual([...frontendKeys].sort(), [...EVENT_ICON_KEYS].sort());
});
