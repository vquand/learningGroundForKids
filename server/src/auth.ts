import argon2 from "argon2";
import { requireLegalVersion } from "./legal.js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import type { AppConfig } from "./config.js";
import { AppError } from "./errors.js";
import type { AppDatabase, CreateFamilyInput, FamilyRecord } from "./contracts/db.js";
import { isRootAccount, ROOT_ACCOUNT_EMAIL } from "./root-account.js";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  isRoot?: true;
}

export function toPublicUser(family: FamilyRecord): PublicUser {
  return { id: family.id, email: family.email, name: family.displayName, ...(isRootAccount(family) ? { isRoot: true as const } : {}) };
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

export function getSessionToken(c: Context, config: AppConfig): string | null {
  const token = getCookie(c, config.sessionCookieName);
  if (!token || token.length > 256) return null;
  return token;
}

export async function findSessionFamily(c: Context, db: AppDatabase, config: AppConfig): Promise<FamilyRecord | null> {
  const token = getSessionToken(c, config);
  if (!token) return null;
  return db.auth.findFamilyBySessionHash(hashSessionToken(token), new Date());
}

export async function createFamilySession(
  c: Context,
  db: AppDatabase,
  config: AppConfig,
  familyId: string,
  expectedPasswordHash?: string,
): Promise<string> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + config.sessionMaxAgeSeconds * 1000);
  await db.auth.createSession({
    tokenHash: hashSessionToken(token),
    familyId,
    expiresAt,
    ...(expectedPasswordHash !== undefined ? { expectedPasswordHash } : {}),
  });
  setFamilySessionCookie(c, config, token);
  return token;
}

export function setFamilySessionCookie(c: Context, config: AppConfig, token: string, maxAgeSeconds = config.sessionMaxAgeSeconds): void {
  setCookie(c, config.sessionCookieName, token, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function deleteCurrentSession(c: Context, db: AppDatabase, config: AppConfig): Promise<void> {
  const token = getSessionToken(c, config);
  if (token) await db.auth.deleteSession(hashSessionToken(token));
  clearSessionCookie(c, config);
}

export function clearSessionCookie(c: Context, config: AppConfig): void {
  setCookie(c, config.sessionCookieName, "", {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });
}

export async function registerFamily(
  db: AppDatabase,
  input: { email: string; password: string; name: string; legalVersion?: string },
  publicRegistration = false,
): Promise<FamilyRecord> {
  const legalVersion = publicRegistration ? requireLegalVersion(input.legalVersion) : null;
  // Always pay for one Argon2 hash, including existing and reserved addresses.
  // This reduces disclosure; full enumeration resistance needs email verification,
  // which this app does not have (successful registration still differs).
  const passwordHash = await hashPassword(input.password);
  try {
    if (input.email === ROOT_ACCOUNT_EMAIL) throw new AppError(409, "FAMILY_EXISTS", "That account is reserved.");
    const existing = await db.auth.findFamilyByEmail(input.email);
    if (existing) throw new AppError(409, "FAMILY_EXISTS", "An account with that email already exists.");
    const familyInput: CreateFamilyInput = {
      id: randomUUID(),
      email: input.email,
      displayName: input.name,
      passwordHash,
      role: "family",
      ...(legalVersion ? { legalAcceptedAt: new Date(), legalAcceptedVersion: legalVersion } : {}),
    };
    return await db.auth.createFamily(familyInput);
  } catch (caught) {
    // Also cover a concurrent insert that wins after our email lookup.
    if (publicRegistration && caught instanceof AppError && caught.code === 'FAMILY_EXISTS') {
      throw new AppError(409, 'REGISTRATION_FAILED', 'We could not create this account. Try signing in, or use a different email.');
    }
    throw caught;
  }
}
