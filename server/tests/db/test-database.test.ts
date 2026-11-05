import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSafeTestDatabaseUrl,
  NONLOCAL_TEST_DATABASE_OPT_IN,
} from "../../src/db/test-database.js";

test("assertSafeTestDatabaseUrl accepts explicitly test-named PostgreSQL databases", () => {
  assert.equal(
    assertSafeTestDatabaseUrl("postgresql://user:secret@localhost:5432/plg_test"),
    "postgresql://user:secret@localhost:5432/plg_test",
  );
  assert.equal(
    assertSafeTestDatabaseUrl("postgresql://user:secret@[::1]/plg_test"),
    "postgresql://user:secret@[::1]/plg_test",
  );
});

test("assertSafeTestDatabaseUrl rejects production-looking and runtime database URLs", () => {
  assert.throws(
    () => assertSafeTestDatabaseUrl("postgresql://user:secret@db.example/prod"),
    /production-looking/,
  );
  assert.throws(
    () => assertSafeTestDatabaseUrl(
      "postgresql://user:secret@localhost/plg_test",
      ["postgresql://user:secret@localhost/plg_test"],
    ),
    /runtime database/,
  );
  assert.throws(
    () => assertSafeTestDatabaseUrl("postgresql://user:secret@localhost/app"),
    /test marker/,
  );
});

test("runtime identity comparison treats default ports and query strings as equivalent", () => {
  assert.throws(
    () => assertSafeTestDatabaseUrl(
      "postgresql://user:test-password@db.example:5432/plg_test?sslmode=require&application_name=tests",
      ["postgres://user:runtime-password@DB.EXAMPLE/plg_test?sslmode=verify-full"],
      NONLOCAL_TEST_DATABASE_OPT_IN,
    ),
    /runtime database/,
  );
});

test("nonlocal test databases require the exact destructive-test opt-in", () => {
  const nonlocal = "postgresql://user:secret@test-db.example/plg_test";
  assert.throws(() => assertSafeTestDatabaseUrl(nonlocal), /nonlocal.*opt-in/i);
  assert.throws(() => assertSafeTestDatabaseUrl(nonlocal, [], "true"), /nonlocal.*opt-in/i);
  assert.equal(
    assertSafeTestDatabaseUrl(nonlocal, [], NONLOCAL_TEST_DATABASE_OPT_IN),
    nonlocal,
  );
});
