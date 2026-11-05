import assert from "node:assert/strict";
import test from "node:test";

import type { AppDatabase, CreateFamilyInput, FamilyRecord } from "../../src/contracts/db.js";
import { bootstrapFamily, readBootstrapCredentials } from "../../src/db/bootstrap.js";

function fakeDatabase(existing: FamilyRecord | null = null) {
  let created: CreateFamilyInput | undefined;
  const db = {
    auth: {
      async findFamilyByEmail() { return existing; },
      async createFamily(input: CreateFamilyInput) {
        created = input;
        return input;
      },
    },
  } as unknown as AppDatabase;
  return { db, created: () => created };
}

test("readBootstrapCredentials accepts credentials only from environment and stdin", () => {
  assert.deepEqual(readBootstrapCredentials({
    BOOTSTRAP_EMAIL: " ADMIN@example.com ",
    BOOTSTRAP_NAME: " Admin ",
  }, "a sufficiently long password\n"), {
    email: "admin@example.com",
    displayName: "Admin",
    password: "a sufficiently long password",
  });
  assert.throws(() => readBootstrapCredentials({}, ""), /BOOTSTRAP_EMAIL/);
});

test("bootstrapFamily hashes the password and creates one admin without retaining plaintext", async () => {
  const fake = fakeDatabase();
  const family = await bootstrapFamily(fake.db, {
    email: "admin@example.com",
    displayName: "Admin",
    password: "a sufficiently long password",
  }, {
    id: () => "family-1",
    hash: async (password) => `argon2id:${password.length}`,
  });

  assert.equal(family.role, "admin");
  assert.equal(fake.created()?.passwordHash, "argon2id:28");
  assert.notEqual(fake.created()?.passwordHash, "a sufficiently long password");
});

test("bootstrapFamily refuses a duplicate email before hashing", async () => {
  const fake = fakeDatabase({
    id: "existing",
    email: "admin@example.com",
    displayName: "Admin",
    passwordHash: "hash",
    role: "admin",
  });
  let hashed = false;
  await assert.rejects(
    bootstrapFamily(fake.db, {
      email: "admin@example.com",
      displayName: "Admin",
      password: "a sufficiently long password",
    }, {
      id: () => "family-2",
      hash: async () => { hashed = true; return "hash"; },
    }),
    /already exists/,
  );
  assert.equal(hashed, false);
  assert.equal(fake.created(), undefined);
});

test("operator bootstrap cannot claim the reserved root email", async () => {
  const fake = fakeDatabase();
  await assert.rejects(() => bootstrapFamily(fake.db, {
    email: "root@system.local", displayName: "Not root", password: "a sufficiently long password",
  }, {
    id: () => "ordinary-admin", hash: async () => { throw new Error("must not hash"); },
  }), /reserved/);
  assert.equal(fake.created(), undefined);
});
