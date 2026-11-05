import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { createDatabase } from "../../src/db/index.js";
import { assertSafeTestDatabaseUrl } from "../../src/db/test-database.js";
import { hashSessionToken } from "../../src/auth.js";

const configuredTestUrl = process.env.TEST_DATABASE_URL;

test("admin own-family passkey enrollment and parent elevation stay scoped and elevated", {
  skip: configuredTestUrl ? false : "TEST_DATABASE_URL is not configured",
}, async () => {
  const url = assertSafeTestDatabaseUrl(configuredTestUrl!, [
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_UNPOOLED,
  ].filter((value): value is string => Boolean(value)), process.env.ALLOW_NONLOCAL_TEST_DATABASE);
  const pool = new Pool({ connectionString: url, max: 1, allowExitOnIdle: true });
  const db = createDatabase(url);
  const suffix = `${Date.now()}-${process.pid}`;
  const adminId = `parent-access-admin-${suffix}`;
  const familyId = `parent-access-family-${suffix}`;
  const inactiveId = `parent-access-inactive-${suffix}`;
  const unknownRoleId = `parent-access-unknown-role-${suffix}`;
  const adminSession = `parent-access-admin-session-${suffix}`;
  const lockSession = `parent-access-lock-session-${suffix}`;
  const familySession = `parent-access-family-session-${suffix}`;
  const expiredSession = `parent-access-expired-session-${suffix}`;
  const passkeyId = `parent-access-passkey-${suffix}`;
  const secondPasskeyId = `parent-access-passkey-2-${suffix}`;
  const adminSessionHash = hashSessionToken(adminSession);
  const lockSessionHash = hashSessionToken(lockSession);
  const familySessionHash = hashSessionToken(familySession);
  const expiredSessionHash = hashSessionToken(expiredSession);
  const inactiveSessionHash = hashSessionToken(`parent-access-inactive-session-${suffix}`);
  const unknownRoleSessionHash = hashSessionToken(`parent-access-unknown-role-session-${suffix}`);
  const now = Date.now();
  const future = new Date(now + 60_000);
  const passwordUntil = new Date(now + 86_400_000);
  const later = new Date(now + 120_000);

  try {
    const rollback = await readFile(new URL("../../drizzle/rollback_all.sql", import.meta.url), "utf8");
    await pool.query(rollback);
    await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await migrate(drizzle({ client: pool }), {
      migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
    });

    await db.auth.createFamily({ id: adminId, email: `${adminId}@example.test`, displayName: "Admin owner", passwordHash: "admin-hash", role: "admin" });
    await db.auth.createFamily({ id: familyId, email: `${familyId}@example.test`, displayName: "Other family", passwordHash: "family-hash", role: "family" });
    await db.auth.createFamily({ id: inactiveId, email: `${inactiveId}@example.test`, displayName: "Inactive family", passwordHash: "inactive-hash", role: "family" });
    await db.auth.createFamily({ id: unknownRoleId, email: `${unknownRoleId}@example.test`, displayName: "Unknown role", passwordHash: "unknown-role-hash", role: "family" });
    await pool.query("UPDATE families SET role = 'mystery' WHERE id = $1", [unknownRoleId]);
    await db.auth.createSession({ tokenHash: adminSessionHash, familyId: adminId, expiresAt: future });
    await db.auth.createSession({ tokenHash: lockSessionHash, familyId: adminId, expiresAt: later });
    await db.auth.createSession({ tokenHash: familySessionHash, familyId, expiresAt: future });
    await db.auth.createSession({ tokenHash: expiredSessionHash, familyId: adminId, expiresAt: new Date(now - 1) });
    await db.auth.createSession({ tokenHash: inactiveSessionHash, familyId: inactiveId, expiresAt: future });
    await db.auth.createSession({ tokenHash: unknownRoleSessionHash, familyId: unknownRoleId, expiresAt: future });

    const adminPasskey = {
      id: passkeyId,
      familyId: adminId,
      publicKey: "AA==",
      counter: 0,
      transports: null,
      deviceType: "singleDevice" as const,
      backedUp: false,
    };
    const inactivePasskey = { ...adminPasskey, id: `parent-access-inactive-passkey-${suffix}`, familyId: inactiveId };
    const unknownRolePasskey = { ...adminPasskey, id: `parent-access-unknown-role-passkey-${suffix}`, familyId: unknownRoleId };
    await assert.rejects(
      () => db.auth.addPasskey(adminPasskey, adminSessionHash),
      (error: unknown) => error instanceof Error && /PASSWORD_RECHECK_REQUIRED|password/i.test(error.message),
    );

    assert.equal(await db.auth.grantParentAccess(adminSessionHash, adminId, passwordUntil, "password"), true);
    await db.auth.addPasskey(adminPasskey, adminSessionHash);
    assert.deepEqual((await db.auth.listPasskeys(adminId)).map((entry) => entry.id), [passkeyId]);
    assert.equal(await db.auth.grantParentAccess(inactiveSessionHash, inactiveId, passwordUntil, "password"), true);
    await db.auth.addPasskey(inactivePasskey, inactiveSessionHash);
    assert.equal(await db.auth.grantParentAccess(unknownRoleSessionHash, unknownRoleId, passwordUntil, "password"), true);
    await db.auth.addPasskey(unknownRolePasskey, unknownRoleSessionHash);

    assert.equal(await db.auth.finalizePasskeyParentAccess({
      familyId: adminId, credentialId: passkeyId, previousCounter: 0, nextCounter: 1,
      sessionHash: adminSessionHash, until: later,
    }), true);
    const elevated = await db.auth.parentAccess(adminSessionHash, adminId, new Date());
    assert.equal(elevated?.method, "passkey");
    assert.ok(elevated && elevated.until > new Date());
    assert.equal((await db.auth.findPasskey(passkeyId))?.counter, 1);

    await assert.rejects(
      () => db.auth.addPasskey({ ...adminPasskey, id: secondPasskeyId }, familySessionHash),
      (error: unknown) => error instanceof Error && /PASSWORD_RECHECK_REQUIRED|password/i.test(error.message),
    );
    assert.equal(await db.auth.finalizePasskeyParentAccess({
      familyId: adminId, credentialId: passkeyId, previousCounter: 1, nextCounter: 2,
      sessionHash: familySessionHash, until: later,
    }), false);
    assert.equal((await db.auth.findPasskey(passkeyId))?.counter, 1);

    assert.equal(await db.auth.grantParentAccess(expiredSessionHash, adminId, future, "password"), false);
    await assert.rejects(
      () => db.auth.addPasskey({ ...adminPasskey, id: secondPasskeyId }, expiredSessionHash),
      (error: unknown) => error instanceof Error && /PASSWORD_RECHECK_REQUIRED|password/i.test(error.message),
    );

    await pool.query("UPDATE families SET is_active = false WHERE id = $1", [inactiveId]);

    await db.auth.grantParentAccess(adminSessionHash, adminId, future, "passkey");
    await assert.rejects(
      () => db.auth.addPasskey({ ...adminPasskey, id: secondPasskeyId }, adminSessionHash),
      (error: unknown) => error instanceof Error && /PASSWORD_RECHECK_REQUIRED|password/i.test(error.message),
    );

    const adminLoginToken = hashSessionToken(`admin-login-${suffix}`);
    assert.equal(await db.auth.finalizePasskeyLogin({
      familyId: adminId, credentialId: passkeyId, previousCounter: 1, nextCounter: 2,
      tokenHash: adminLoginToken, expiresAt: later,
    }), true, "active admin passkeys can become full login credentials");
    assert.equal((await db.auth.findPasskey(passkeyId))?.counter, 2);
    assert.equal(await db.auth.parentAccess(adminLoginToken, adminId, new Date()), null,
      "passkey account login must not unlock the parent space");
    assert.equal((await db.auth.findFamilyBySessionHash(adminLoginToken, new Date()))?.role, "admin",
      "admin passkey login retains the stored admin role");

    assert.equal(await db.auth.finalizePasskeyLogin({
      familyId: adminId, credentialId: passkeyId, previousCounter: 1, nextCounter: 3,
      tokenHash: hashSessionToken(`admin-replay-${suffix}`), expiresAt: later,
    }), false, "passkey counter rollback/replay must be rejected");
    assert.equal((await db.auth.findPasskey(passkeyId))?.counter, 2);

    const familyPasskeyId = `parent-access-family-passkey-${suffix}`;
    await db.auth.grantParentAccess(familySessionHash, familyId, passwordUntil, "password");
    await db.auth.addPasskey({ ...adminPasskey, id: familyPasskeyId, familyId }, familySessionHash);
    const familyLoginToken = hashSessionToken(`family-login-${suffix}`);
    assert.equal(await db.auth.finalizePasskeyLogin({
      familyId, credentialId: familyPasskeyId, previousCounter: 0, nextCounter: 1,
      tokenHash: familyLoginToken, expiresAt: later,
    }), true, "active family passkeys remain valid login credentials");
    assert.equal((await db.auth.findPasskey(familyPasskeyId))?.counter, 1);
    assert.equal(await db.auth.parentAccess(familyLoginToken, familyId, new Date()), null,
      "family passkey login must not unlock the parent space");
    assert.equal((await db.auth.findFamilyBySessionHash(familyLoginToken, new Date()))?.role, "family",
      "family passkey login retains the stored family role");

    assert.equal(await db.auth.finalizePasskeyLogin({
      familyId: inactiveId, credentialId: inactivePasskey.id, previousCounter: 0, nextCounter: 1,
      tokenHash: hashSessionToken(`inactive-login-${suffix}`), expiresAt: later,
    }), false, "inactive families cannot finalize passkey login");
    assert.equal(await db.auth.finalizePasskeyLogin({
      familyId: unknownRoleId, credentialId: unknownRolePasskey.id, previousCounter: 0, nextCounter: 1,
      tokenHash: hashSessionToken(`unknown-role-login-${suffix}`), expiresAt: later,
    }), false, "unknown stored roles cannot finalize passkey login");
    assert.equal(await db.auth.finalizePasskeyLogin({
      familyId: "unknown-family", credentialId: passkeyId, previousCounter: 2, nextCounter: 3,
      tokenHash: hashSessionToken(`unknown-login-${suffix}`), expiresAt: later,
    }), false, "unknown families cannot finalize passkey login");
    assert.equal(await db.auth.finalizePasskeyLogin({
      familyId: adminId, credentialId: "revoked-credential", previousCounter: 0, nextCounter: 1,
      tokenHash: hashSessionToken(`revoked-login-${suffix}`), expiresAt: later,
    }), false, "unknown/revoked credentials cannot finalize passkey login");

    assert.equal(await db.auth.grantParentAccess(lockSessionHash, adminId, passwordUntil, "password"), true);
    await db.auth.createPasskeyChallenge({
      tokenHash: hashSessionToken(`lock-challenge-${suffix}`), challenge: "challenge", purpose: "parent",
      sessionHash: lockSessionHash, familyId: adminId, expiresAt: later,
    });
    const rotatedTokenHash = hashSessionToken(`rotated-lock-session-${suffix}`);
    assert.equal(await db.auth.lockParentAccess({ familyId: adminId, sessionHash: familySessionHash,
      tokenHash: hashSessionToken(`cross-family-lock-${suffix}`) }), null,
    "a family session cannot lock another family's parent space");
    assert.equal(await db.auth.lockParentAccess({ familyId: adminId, sessionHash: expiredSessionHash,
      tokenHash: hashSessionToken(`expired-lock-${suffix}`) }), null,
    "an expired session cannot be rotated by parent lock");
    assert.equal((await db.auth.lockParentAccess({ familyId: adminId, sessionHash: lockSessionHash, tokenHash: rotatedTokenHash }))?.getTime(), later.getTime(),
      "locking preserves the original login session expiry");
    assert.equal(await db.auth.findFamilyBySessionHash(lockSessionHash, new Date()), null,
      "the old session is invalidated when parent space is locked");
    assert.equal((await db.auth.findFamilyBySessionHash(rotatedTokenHash, new Date()))?.id, adminId,
      "locking rotates to a fresh family session");
    assert.equal(await db.auth.parentAccess(rotatedTokenHash, adminId, new Date()), null,
      "the rotated session has no parent capability");
    assert.equal(await db.auth.finalizePasskeyParentAccess({
      familyId: adminId, credentialId: passkeyId, previousCounter: 2, nextCounter: 3,
      sessionHash: lockSessionHash, until: later,
    }), false, "an in-flight parent verification bound to the old session cannot resurrect access");
    assert.equal(await db.auth.consumePasskeyChallenge(hashSessionToken(`lock-challenge-${suffix}`), "parent", new Date()), null,
      "locking invalidates pending parent ceremonies");
  } finally {
    await pool.query("DELETE FROM passkey_challenges WHERE family_id IN ($1, $2, $3, $4)", [adminId, familyId, inactiveId, unknownRoleId]).catch(() => undefined);
    await pool.query("DELETE FROM passkeys WHERE family_id IN ($1, $2, $3, $4)", [adminId, familyId, inactiveId, unknownRoleId]).catch(() => undefined);
    await pool.query("DELETE FROM sessions WHERE family_id IN ($1, $2, $3, $4)", [adminId, familyId, inactiveId, unknownRoleId]).catch(() => undefined);
    await pool.query("DELETE FROM families WHERE id IN ($1, $2, $3, $4)", [adminId, familyId, inactiveId, unknownRoleId]).catch(() => undefined);
    await pool.end();
  }
});
