import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { LEGAL_VERSION, requireLegalVersion } from '../src/legal.js';
import { adminRegisterSchema, registerSchema } from '../src/input.js';
import { AppError } from '../src/errors.js';

test('only the server legal version is accepted; password consent is required but admin creation is independent', () => {
  const credentials = { email: 'parent@example.test', password: 'a secure password', name: 'Parent' };
  assert.equal(registerSchema.parse({ ...credentials, legalVersion: LEGAL_VERSION }).legalVersion, LEGAL_VERSION);
  assert.deepEqual(adminRegisterSchema.parse(credentials), credentials);
  for (const value of [undefined, null, '', true, {}, 'stale']) {
    assert.throws(() => requireLegalVersion(value), (caught: unknown) => caught instanceof AppError && caught.status === 400);
  }
  assert.throws(() => registerSchema.parse(credentials), /read and accept/);
  assert.equal(registerSchema.safeParse({ ...credentials, legalVersion: LEGAL_VERSION, legalAcceptedAt: '2000-01-01' }).success, false);
});

test('legal consent operator handoff matches the canonical migration and preserves nullable grandfathering', async () => {
  const migration = await readFile(new URL('../drizzle/0038_legal_consent.sql', import.meta.url), 'utf8');
  const handoff = await readFile(new URL('../../docs/migrations/neon-0038-legal-consent.sql', import.meta.url), 'utf8');
  const hash = createHash('sha256').update(migration).digest('hex');
  assert.ok(handoff.includes(hash));
  for (const column of ['legal_accepted_at', 'legal_accepted_version', 'legal_version']) {
    assert.match(handoff, new RegExp(`ADD COLUMN IF NOT EXISTS "${column}"`));
    assert.doesNotMatch(migration, new RegExp(`"${column}"[^;]*NOT NULL`));
  }
  assert.doesNotMatch(migration, /UPDATE "families"/);
  assert.match(handoff, /-- Rollback ONLY/);
  assert.match(handoff, /0037_profile_tour/);
});
