import argon2 from "argon2";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AppDatabase, FamilyRecord } from "./contracts/db.js";

// These are reserved server-owned identifiers, never assigned by registration.
export const ROOT_ACCOUNT_ID = "root";
export const ROOT_ACCOUNT_EMAIL = "root@system.local";

export function isRootAccount(family: FamilyRecord): boolean {
  return family.id === ROOT_ACCOUNT_ID && family.email === ROOT_ACCOUNT_EMAIL
    && family.role === "admin" && family.isActive !== false;
}

export function verifyRootFallback(configured: string | undefined, supplied: string): boolean {
  if (!configured) return false;
  // The secret lives only in runtime configuration. Fixed-size digests prevent
  // timing/length leaks during comparison; no fallback credential is stored in DB.
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(configured), digest(supplied));
}

export async function initializeRoot(db: AppDatabase, savePassword: (password: string) => Promise<void>): Promise<boolean> {
  const existing = await db.auth.findFamilyByEmail(ROOT_ACCOUNT_EMAIL);
  if (existing) {
    if (!isRootAccount(existing)) throw new Error("The reserved root account conflicts with an existing or inactive account.");
    return false;
  }
  const password = randomBytes(32).toString("base64url");
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  // Persist securely before inserting: a filesystem failure must not create an
  // account whose generated password cannot be retrieved.
  await savePassword(password);
  return db.auth.createRootIfMissing(passwordHash);
}
