import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt, inArray, lt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthRepository } from '../contracts/db.js';
import { AppError } from '../errors.js';
import { PARENT_ACCESS_SECONDS, PASSWORD_CONFIRMATION_SECONDS } from '../parent-access.js';
import { families, sessions, passkeys, passkeyChallenges } from './schema.js';

type PasskeyRepository = Pick<AuthRepository,
  'lockParentAccess' | 'finalizePasskeyLogin' | 'finalizePasskeyParentAccess' | 'listPasskeys' | 'findPasskey' | 'addPasskey' | 'deletePasskey' | 'createPasskeyChallenge' | 'consumePasskeyChallenge'>;

/** Keep credential counters, session binding, and parent elevation atomic. */
export function createPasskeyRepository(orm: NodePgDatabase): PasskeyRepository {
  return {
  async lockParentAccess(input) {
    return orm.transaction(async (tx) => {
      const owners = await tx.select({ id: families.id }).from(families)
        .where(and(eq(families.id, input.familyId), eq(families.isActive, true)))
        .for("update").limit(1);
      if (!owners.length) return null;
      const active = await tx.select({ id: sessions.id, expiresAt: sessions.expiresAt }).from(sessions)
        .where(and(eq(sessions.tokenHash, input.sessionHash), eq(sessions.familyId, input.familyId),
          gt(sessions.expiresAt, new Date()))).for("update").limit(1);
      const session = active[0];
      if (!session) return null;
      // Rotation also invalidates ceremonies already bound to the old session.
      await tx.delete(passkeyChallenges).where(eq(passkeyChallenges.sessionHash, input.sessionHash));
      await tx.delete(sessions).where(eq(sessions.id, session.id));
      await tx.insert(sessions).values({ id: randomUUID(), tokenHash: input.tokenHash,
        familyId: input.familyId, expiresAt: session.expiresAt });
      return session.expiresAt;
    });
  },

  async finalizePasskeyLogin(input) {
    return orm.transaction(async (tx) => {
      const owners = await tx.select({ id: families.id }).from(families)
        .where(and(eq(families.id, input.familyId), inArray(families.role, ["family", "admin"]), eq(families.isActive, true)))
        .for("update").limit(1);
      if (!owners.length) return false;
      const updated = await tx.update(passkeys).set({ counter: input.nextCounter, lastUsedAt: new Date() })
        .where(and(eq(passkeys.id, input.credentialId), eq(passkeys.familyId, input.familyId),
          eq(passkeys.counter, input.previousCounter))).returning({ id: passkeys.id });
      if (!updated.length) return false;
      await tx.insert(sessions).values({ id: randomUUID(), tokenHash: input.tokenHash,
        familyId: input.familyId, expiresAt: input.expiresAt });
      return true;
    });
  },

  async finalizePasskeyParentAccess(input) {
    return orm.transaction(async (tx) => {
      const owners = await tx.select({ id: families.id }).from(families)
        .where(and(eq(families.id, input.familyId), eq(families.isActive, true)))
        .for("update").limit(1);
      if (!owners.length) return false;
      const active = await tx.select({ id: sessions.id }).from(sessions)
        .where(and(eq(sessions.tokenHash, input.sessionHash), eq(sessions.familyId, input.familyId),
          gt(sessions.expiresAt, new Date()))).for("update").limit(1);
      if (!active.length) return false;
      const updated = await tx.update(passkeys).set({ counter: input.nextCounter, lastUsedAt: new Date() })
        .where(and(eq(passkeys.id, input.credentialId), eq(passkeys.familyId, input.familyId),
          eq(passkeys.counter, input.previousCounter))).returning({ id: passkeys.id });
      if (!updated.length) return false;
      const elevated = await tx.update(sessions)
        .set({ parentVerifiedUntil: input.until, parentVerifiedBy: "passkey" })
        .where(eq(sessions.id, active[0]!.id)).returning({ id: sessions.id });
      return elevated.length > 0;
    });
  },

  async listPasskeys(familyId) {
    const rows = await orm.select().from(passkeys).where(eq(passkeys.familyId, familyId))
      .orderBy(asc(passkeys.createdAt)).limit(20);
    return rows.map((row) => ({ ...row, deviceType: row.deviceType as "singleDevice" | "multiDevice" }));
  },

  async findPasskey(id) {
    const rows = await orm.select().from(passkeys).where(eq(passkeys.id, id)).limit(1);
    const row = rows[0];
    return row ? { ...row, deviceType: row.deviceType as "singleDevice" | "multiDevice" } : null;
  },

  async addPasskey(input, sessionHash) {
    await orm.transaction(async (tx) => {
      // The family row serializes concurrent registrations for this family.
      const owners = await tx.select({ id: families.id }).from(families)
        .where(and(eq(families.id, input.familyId), eq(families.isActive, true)))
        .for("update").limit(1);
      if (!owners.length) throw new AppError(403, "FAMILY_REQUIRED", "A family account is required.");
      const active = await tx.select({ id: sessions.id }).from(sessions)
        .where(and(eq(sessions.tokenHash, sessionHash), eq(sessions.familyId, input.familyId),
          gt(sessions.expiresAt, new Date()),
          gt(sessions.parentVerifiedUntil, new Date(Date.now() + (PARENT_ACCESS_SECONDS - PASSWORD_CONFIRMATION_SECONDS) * 1000)),
          eq(sessions.parentVerifiedBy, "password"))).for("update").limit(1);
      if (!active.length) throw new AppError(403, "PASSWORD_RECHECK_REQUIRED", "Confirm your family password before adding a passkey.");
      const existing = await tx.select({ id: passkeys.id }).from(passkeys)
        .where(eq(passkeys.familyId, input.familyId)).limit(10);
      if (existing.length >= 10) throw new AppError(409, "PASSKEY_LIMIT", "Maximum passkeys reached.");
      await tx.insert(passkeys).values({
        id: input.id, familyId: input.familyId, publicKey: input.publicKey,
        counter: input.counter, transports: input.transports,
        deviceType: input.deviceType, backedUp: input.backedUp,
      });
    });
  },

  async deletePasskey(id, familyId) {
    return orm.transaction(async (tx) => {
      await tx.select({ id: families.id }).from(families).where(eq(families.id, familyId)).for("update").limit(1);
      const rows = await tx.delete(passkeys).where(and(eq(passkeys.id, id), eq(passkeys.familyId, familyId)))
        .returning({ id: passkeys.id });
      // The family lock also serializes registration and other deletions. Derive
      // the preference here, never from a pre-delete browser/list snapshot.
      const remaining = await tx.select({ id: passkeys.id }).from(passkeys)
        .where(eq(passkeys.familyId, familyId)).limit(1);
      return { removed: rows.length > 0, preferred: remaining.length > 0 };
    });
  },

  async createPasskeyChallenge(input) {
    await orm.delete(passkeyChallenges).where(lt(passkeyChallenges.expiresAt, new Date()));
    await orm.insert(passkeyChallenges).values(input);
  },

  async consumePasskeyChallenge(tokenHash, purpose, now) {
    const rows = await orm.delete(passkeyChallenges).where(and(
      eq(passkeyChallenges.tokenHash, tokenHash), eq(passkeyChallenges.purpose, purpose),
    )).returning();
    const row = rows[0];
    if (!row || row.expiresAt <= now) return null;
    return { tokenHash: row.tokenHash, challenge: row.challenge,
      purpose: row.purpose as "login" | "parent" | "register", sessionHash: row.sessionHash,
      familyId: row.familyId, expiresAt: row.expiresAt };
  },
  };
}
