import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from '../../src/db/index.js';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { registerFamily } from '../../src/auth.js';
import { LEGAL_VERSION } from '../../src/legal.js';

const configured = process.env.TEST_DATABASE_URL;
test('password registration persists server consent; admin-created and grandfathered families stay NULL',
  { skip: configured ? false : 'TEST_DATABASE_URL is not configured' }, async () => {
    const url = assertSafeTestDatabaseUrl(configured!, [process.env.DATABASE_URL ?? '', process.env.DATABASE_URL_UNPOOLED ?? '']);
    const pool = new Pool({ connectionString: url }), db = createDatabase(url);
    const prefix = randomUUID();
    const emails = ['public', 'admin', 'old'].map(kind => `${prefix}-${kind}@test.local`);
    try {
      await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
      const before = Date.now();
      const account = await registerFamily(db, { name: 'Public family', email: emails[0]!, password: 'a secure test password', legalVersion: LEGAL_VERSION }, true);
      const adminCreated = await registerFamily(db, { name: 'Admin created', email: emails[1]!, password: 'a secure test password' });
      await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES ($1,$2,$3,$4)', [randomUUID(), emails[2], 'Grandfathered', 'unused']);
      const rows = (await pool.query('SELECT email, legal_accepted_at, legal_accepted_version FROM families WHERE email = ANY($1)', [emails])).rows;
      const accepted = rows.find(row => row.email === emails[0]);
      assert.equal(accepted.legal_accepted_version, LEGAL_VERSION);
      assert.ok(accepted.legal_accepted_at instanceof Date);
      assert.ok(accepted.legal_accepted_at.getTime() >= before && accepted.legal_accepted_at.getTime() <= Date.now());
      for (const email of emails.slice(1)) {
        const row = rows.find(row => row.email === email);
        assert.equal(row.legal_accepted_at, null);
        assert.equal(row.legal_accepted_version, null);
      }
      assert.equal((await db.auth.findFamilyById(account.id))?.legalAcceptedVersion, LEGAL_VERSION);
      assert.equal((await db.auth.findFamilyById(adminCreated.id))?.legalAcceptedAt, null);
      // Operator handoff must be safe to repeat after the canonical test migrator.
      const handoff = await readFile(new URL('../../../docs/migrations/neon-0038-legal-consent.sql', import.meta.url), 'utf8');
      await pool.query(handoff);
      await pool.query(handoff);
      assert.deepEqual((await pool.query('SELECT legal_accepted_at FROM families WHERE id=$1', [account.id])).rows[0].legal_accepted_at, accepted.legal_accepted_at);
    } finally {
      await pool.query('DELETE FROM families WHERE email = ANY($1)', [emails]);
      await db.close?.();
      await pool.end();
    }
  });
