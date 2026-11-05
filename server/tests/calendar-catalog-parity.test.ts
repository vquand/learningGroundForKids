import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { STUDY_KEYS, STUDY_GROUP_BY_KEY } from '../src/calendar/catalog.js';
const catalogUrl = new URL('../../frontend/src/lib/calendarCatalog.ts', import.meta.url);
test('frontend calendar study catalog matches the authoritative keys and groups symmetrically', async context => {
  try { await access(catalogUrl); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') { context.skip('Frontend calendar catalog has not been added yet'); return; }
    throw error;
  }
  // Frontend exports the key-only arrays/map alongside labels. Import only after
  // existence check so a server-only checkout remains runnable.
  const frontend = await import(catalogUrl.href) as { STUDY_KEYS?: readonly string[]; STUDY_GROUP_BY_KEY?: Record<string, string> };
  assert.ok(frontend.STUDY_KEYS, 'Frontend catalog must export STUDY_KEYS');
  assert.ok(frontend.STUDY_GROUP_BY_KEY, 'Frontend catalog must export STUDY_GROUP_BY_KEY');
  assert.equal(new Set(frontend.STUDY_KEYS).size, frontend.STUDY_KEYS.length);
  assert.deepEqual([...frontend.STUDY_KEYS].sort(), [...STUDY_KEYS].sort());
  assert.deepEqual(frontend.STUDY_GROUP_BY_KEY, STUDY_GROUP_BY_KEY);
});
