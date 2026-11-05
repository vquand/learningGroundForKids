import assert from 'node:assert/strict';
import test from 'node:test';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createPasskeyRepository } from '../src/db/passkeys.js';

type Credential = { id: string; familyId: string };

// Exercise real Drizzle transactions and SQL without a database connection.
function fixture(initial: Credential[], failRemainingRead = false) {
  let committed = [...initial];
  let transaction: Credential[] | null = null;
  const statements: string[] = [];
  const client = {
    async query(query: { text: string }, values: unknown[] = []) {
      statements.push(query.text);
      if (query.text === 'begin') { transaction = [...committed]; return { rows: [] }; }
      if (query.text === 'commit') { assert.ok(transaction); committed = transaction; transaction = null; return { rows: [] }; }
      if (query.text === 'rollback') { transaction = null; return { rows: [] }; }
      assert.ok(transaction, 'deletion and preference reads must share a transaction');
      if (query.text.includes('from "families"')) {
        assert.match(query.text, /for update$/);
        return { rows: [[values[0]]] };
      }
      if (query.text.startsWith('delete from "passkeys"')) {
        const matches = transaction.filter(row => row.id === values[0] && row.familyId === values[1]);
        transaction = transaction.filter(row => !matches.includes(row));
        return { rows: matches.map(row => [row.id]) };
      }
      if (query.text.startsWith('select "id" from "passkeys"')) {
        if (failRemainingRead) throw new Error('remaining credentials unavailable');
        return { rows: transaction.filter(row => row.familyId === values[0]).slice(0, 1).map(row => [row.id]) };
      }
      throw new Error(`Unexpected SQL: ${query.text}`);
    },
    release() {},
  };
  const orm = drizzle({ client: { ...client, connect: async () => client } as never });
  return { repository: createPasskeyRepository(orm), get committed() { return committed; }, statements };
}

test('deletion derives preference from remaining credentials inside the transaction', async () => {
  const f = fixture([{ id: 'one', familyId: 'a' }, { id: 'two', familyId: 'a' }, { id: 'other', familyId: 'b' }]);
  assert.deepEqual(await f.repository.deletePasskey('one', 'a'), { removed: true, preferred: true });
  assert.deepEqual(await f.repository.deletePasskey('two', 'a'), { removed: true, preferred: false });
  assert.deepEqual(f.committed, [{ id: 'other', familyId: 'b' }]);
  assert.equal(f.statements.at(-1), 'commit');
});

test('a foreign or missing passkey cannot change enrollment or the resulting preference', async () => {
  const initial = [{ id: 'one', familyId: 'a' }];
  const f = fixture(initial);
  assert.deepEqual(await f.repository.deletePasskey('one', 'b'), { removed: false, preferred: false });
  assert.deepEqual(await f.repository.deletePasskey('missing', 'a'), { removed: false, preferred: true });
  assert.deepEqual(f.committed, initial);
});

test('failure to reconcile preference rolls back the credential deletion', async () => {
  const initial = [{ id: 'one', familyId: 'a' }];
  const f = fixture(initial, true);
  await assert.rejects(f.repository.deletePasskey('one', 'a'));
  assert.deepEqual(f.committed, initial);
  assert.equal(f.statements.at(-1), 'rollback');
});
