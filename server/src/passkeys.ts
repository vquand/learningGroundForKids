import { randomBytes } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { Context } from "hono";
import { AuthRateLimiter } from "./auth-rate-limiter.js";
import type { App, AppDependencies } from "./contracts/app.js";
import { createSessionToken, getSessionToken, hashSessionToken, setFamilySessionCookie, toPublicUser, verifyPassword } from "./auth.js";
import { AppError } from "./errors.js";
import { parseJson } from "./input.js";
import { hasRecentParentPassword, PARENT_ACCESS_SECONDS } from "./parent-access.js";

const CHALLENGE_COOKIE = "plg_passkey_challenge";
const CHALLENGE_SECONDS = 300;
const MAX_PASSKEYS = 10;
const responseSchema = z.object({
  id: z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/),
  type: z.literal("public-key"),
  response: z.record(z.string(), z.unknown()),
}).passthrough();
const passwordSchema = z.object({ password: z.string().min(1).max(256) }).strict();

function configured(deps: AppDependencies) {
  if (!deps.config.webauthn) throw new AppError(503, "PASSKEY_UNAVAILABLE", "Passkeys are not configured.");
  return deps.config.webauthn;
}

const familyAuthLimiters = new WeakMap<AppDependencies, AuthRateLimiter>();

async function consumeFamilyAuthBudget(c: Context, deps: AppDependencies, familyId: string): Promise<void> {
  let limiter = familyAuthLimiters.get(deps);
  if (!limiter) {
    limiter = new AuthRateLimiter(deps.config.authRateLimitMax,
      deps.config.authRateLimitWindowSeconds * 1000, deps.config.authRateLimitMaxKeys);
    familyAuthLimiters.set(deps, limiter);
  }
  const budget = limiter.check(familyId);
  if (!budget.allowed) {
    c.header("retry-after", String(budget.retryAfterSeconds));
    throw new AppError(429, "RATE_LIMITED", "Too many authentication attempts.");
  }
}

function currentSessionHash(c: Context, deps: AppDependencies): string {
  const token = getSessionToken(c, deps.config);
  if (!token) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Sign in again.");
  return hashSessionToken(token);
}

function challengeCookie(c: Context, deps: AppDependencies, token: string): void {
  setCookie(c, CHALLENGE_COOKIE, token, {
    httpOnly: true, secure: deps.config.nodeEnv === "production", sameSite: "Lax",
    path: "/api/v1/", maxAge: CHALLENGE_SECONDS,
  });
}

function clearChallengeCookie(c: Context, deps: AppDependencies): void {
  setCookie(c, CHALLENGE_COOKIE, "", {
    httpOnly: true, secure: deps.config.nodeEnv === "production", sameSite: "Lax",
    path: "/api/v1/", maxAge: 0,
  });
}

// Device-local sign-in presentation only; this cookie never grants access. The
// database's enrolled credentials are the source of truth, so there is no
// separate account preference bit that can remain true after the last deletion.
function reflectPasskeyPreference(c: Context, deps: AppDependencies, enrolled: boolean): void {
  setCookie(c, "plg_passkey_preferred", String(Boolean(deps.config.webauthn) && enrolled), {
    secure: deps.config.nodeEnv === "production", sameSite: "Lax", path: "/", maxAge: 365 * 86_400,
  });
}

async function saveChallenge(
  c: Context,
  deps: AppDependencies,
  challenge: string,
  purpose: "login" | "parent" | "register",
  familyId: string | null,
  sessionHash: string | null,
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await deps.db.auth.createPasskeyChallenge({
    tokenHash: hashSessionToken(token), challenge, purpose, familyId, sessionHash,
    expiresAt: new Date(Date.now() + CHALLENGE_SECONDS * 1000),
  });
  challengeCookie(c, deps, token);
}

async function consumeChallenge(c: Context, deps: AppDependencies, purpose: "login" | "parent" | "register") {
  const token = getCookie(c, CHALLENGE_COOKIE);
  clearChallengeCookie(c, deps);
  if (!token || token.length > 256) throw new AppError(401, "PASSKEY_FAILED", "Passkey verification failed. Try again.");
  const challenge = await deps.db.auth.consumePasskeyChallenge(hashSessionToken(token), purpose, new Date());
  if (!challenge) throw new AppError(401, "PASSKEY_FAILED", "Passkey verification failed. Try again.");
  return challenge;
}

async function verifyAssertion(c: Context, deps: AppDependencies, purpose: "login" | "parent") {
  const input = await parseJson(c.req.raw, responseSchema, deps.config.maxBodyBytes);
  const challenge = await consumeChallenge(c, deps, purpose);
  if (purpose === "parent" && challenge.sessionHash !== currentSessionHash(c, deps)) {
    throw new AppError(401, "PASSKEY_FAILED", "Passkey verification failed. Try again.");
  }
  const passkey = await deps.db.auth.findPasskey(input.id);
  if (!passkey || (challenge.familyId && passkey.familyId !== challenge.familyId)) {
    throw new AppError(401, "PASSKEY_FAILED", "Passkey verification failed. Try again.");
  }
  await consumeFamilyAuthBudget(c, deps, passkey.familyId);
  const userHandle = input.response.userHandle;
  if (userHandle !== null && userHandle !== undefined
    && (typeof userHandle !== "string" || userHandle !== Buffer.from(passkey.familyId).toString("base64url"))) {
    throw new AppError(401, "PASSKEY_FAILED", "Passkey verification failed. Try again.");
  }
  const { rpId, origin } = configured(deps);
  try {
    const result = await verifyAuthenticationResponse({
      response: input as unknown as AuthenticationResponseJSON,
      expectedChallenge: challenge.challenge, expectedOrigin: origin, expectedRPID: rpId,
      requireUserVerification: true,
      credential: {
        id: passkey.id,
        publicKey: Buffer.from(passkey.publicKey, "base64url"),
        counter: passkey.counter,
        ...(passkey.transports ? { transports: passkey.transports } : {}),
      },
    });
    if (!result.verified || !result.authenticationInfo.userVerified) {
      throw new Error("Passkey assertion was not accepted");
    }
    return { challenge, passkey, nextCounter: result.authenticationInfo.newCounter };
  } catch {
    throw new AppError(401, "PASSKEY_FAILED", "Passkey verification failed. Try again.");
  }
}

export function registerPasskeyRoutes(app: App, deps: AppDependencies): void {
  app.get("/api/v1/parent/access", async (c) => {
    const family = c.get("family");
    const storedAccess = await deps.db.auth.parentAccess(currentSessionHash(c, deps), family.id, new Date());
    const access = storedAccess?.method==='google' && family.passwordHash!=='!google-only' ? null : storedAccess;
    const enrolled = deps.config.webauthn ? (await deps.db.auth.listPasskeys(family.id)).length > 0 : false;
    reflectPasskeyPreference(c, deps, enrolled);
    return c.json({ elevated: Boolean(access), method: access?.method ?? null,
      expires_at: access?.until.toISOString() ?? null,
      passkeys_enabled: Boolean(deps.config.webauthn), passkeys_enrolled: enrolled,
      password_confirmed: hasRecentParentPassword(access),
      ...(family.passwordHash==="!google-only"?{password_available:false}: {}) });
  });

  app.post("/api/v1/parent/access/lock", async (c) => {
    const family = c.get("family");
    const token = createSessionToken();
    const expiresAt = await deps.db.auth.lockParentAccess({ familyId: family.id,
      sessionHash: currentSessionHash(c, deps), tokenHash: hashSessionToken(token) });
    if (!expiresAt) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Sign in again.");
    setFamilySessionCookie(c, deps.config, token, Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000)));
    clearChallengeCookie(c, deps);
    return c.body(null, 204);
  });

  app.post("/api/v1/parent/access/password", async (c) => {
    const family = c.get("family");
    const { password } = await parseJson(c.req.raw, passwordSchema, deps.config.maxBodyBytes);
    await consumeFamilyAuthBudget(c, deps, family.id);
    if (!await verifyPassword(family.passwordHash, password)) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Password is incorrect.");
    }
    const until = new Date(Date.now() + PARENT_ACCESS_SECONDS * 1000);
    if (!await deps.db.auth.grantParentAccess(currentSessionHash(c, deps), family.id, until, "password")) {
      throw new AppError(401, "AUTHENTICATION_REQUIRED", "Sign in again.");
    }
    return c.json({ elevated: true, method: "password", expires_at: until.toISOString(), password_confirmed: true });
  });

  app.post("/api/v1/auth/passkey/options", async (c) => {
    const { rpId } = configured(deps);
    const options = await generateAuthenticationOptions({ rpID: rpId, userVerification: "required", timeout: CHALLENGE_SECONDS * 1000 });
    await saveChallenge(c, deps, options.challenge, "login", null, null);
    return c.json(options);
  });

  app.post("/api/v1/auth/passkey/verify", async (c) => {
    const { passkey, nextCounter } = await verifyAssertion(c, deps, "login");
    const family = await deps.db.auth.findFamilyById(passkey.familyId);
    if (!family || family.isActive === false || (family.role !== "family" && family.role !== "admin")) {
      throw new AppError(401, "PASSKEY_FAILED", "Passkey verification failed. Try again.");
    }
    const token = createSessionToken();
    if (!await deps.db.auth.finalizePasskeyLogin({ familyId: family.id, credentialId: passkey.id,
      previousCounter: passkey.counter, nextCounter, tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + deps.config.sessionMaxAgeSeconds * 1000) })) {
      throw new AppError(401, "PASSKEY_FAILED", "Passkey verification failed. Try again.");
    }
    setFamilySessionCookie(c, deps.config, token);
    reflectPasskeyPreference(c, deps, true);
    return c.json({ authenticated: true, user: toPublicUser(family), signOutUrl: "/api/v1/auth/logout" });
  });

  app.post("/api/v1/parent/access/passkey/options", async (c) => {
    const { rpId } = configured(deps);
    const family = c.get("family");
    const credentials = await deps.db.auth.listPasskeys(family.id);
    if (!credentials.length) throw new AppError(404, "PASSKEY_UNAVAILABLE", "No passkey is set up for this family.");
    const options = await generateAuthenticationOptions({
      rpID: rpId, userVerification: "required", timeout: CHALLENGE_SECONDS * 1000,
      allowCredentials: credentials.map((passkey) => ({ id: passkey.id,
        ...(passkey.transports ? { transports: passkey.transports } : {}) })),
    });
    await saveChallenge(c, deps, options.challenge, "parent", family.id, currentSessionHash(c, deps));
    return c.json(options);
  });

  app.post("/api/v1/parent/access/passkey/verify", async (c) => {
    const family = c.get("family");
    const { challenge, passkey, nextCounter } = await verifyAssertion(c, deps, "parent");
    const sessionHash = currentSessionHash(c, deps);
    if (challenge.familyId !== family.id || challenge.sessionHash !== sessionHash) {
      throw new AppError(401, "PASSKEY_FAILED", "Passkey verification failed. Try again.");
    }
    const until = new Date(Date.now() + PARENT_ACCESS_SECONDS * 1000);
    if (!await deps.db.auth.finalizePasskeyParentAccess({ familyId: family.id,
      credentialId: passkey.id, previousCounter: passkey.counter, nextCounter,
      sessionHash, until })) {
      throw new AppError(401, "PASSKEY_FAILED", "Passkey verification failed. Try again.");
    }
    return c.json({ elevated: true, method: "passkey", expires_at: until.toISOString(), password_confirmed: false });
  });

  app.get("/api/v1/parent/passkeys", async (c) => {
    const passkeys = await deps.db.auth.listPasskeys(c.get("family").id);
    reflectPasskeyPreference(c, deps, passkeys.length > 0);
    return c.json(passkeys.map((passkey) => ({ id: passkey.id,
      created_at: passkey.createdAt?.toISOString() ?? null,
      last_used_at: passkey.lastUsedAt?.toISOString() ?? null })));
  });

  app.post("/api/v1/parent/passkeys/options", async (c) => {
    const { rpId } = configured(deps);
    const family = c.get("family");
    const sessionHash = currentSessionHash(c, deps);
    const access = await deps.db.auth.parentAccess(sessionHash, family.id, new Date());
    if (!hasRecentParentPassword(access)) throw new AppError(403, "PASSWORD_RECHECK_REQUIRED", "Confirm your family password before adding a passkey.");
    const existing = await deps.db.auth.listPasskeys(family.id);
    if (existing.length >= MAX_PASSKEYS) throw new AppError(409, "PASSKEY_LIMIT", "Maximum passkeys reached.");
    const options = await generateRegistrationOptions({
      rpName: "Personal Learning Ground", rpID: rpId, userName: family.email,
      userDisplayName: family.displayName, userID: new TextEncoder().encode(family.id),
      attestationType: "none", timeout: CHALLENGE_SECONDS * 1000,
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      excludeCredentials: existing.map((passkey) => ({ id: passkey.id,
        ...(passkey.transports ? { transports: passkey.transports } : {}) })),
    });
    await saveChallenge(c, deps, options.challenge, "register", family.id, sessionHash);
    return c.json(options);
  });

  app.post("/api/v1/parent/passkeys/verify", async (c) => {
    const family = c.get("family");
    const sessionHash = currentSessionHash(c, deps);
    const access = await deps.db.auth.parentAccess(sessionHash, family.id, new Date());
    if (!hasRecentParentPassword(access)) throw new AppError(403, "PASSWORD_RECHECK_REQUIRED", "Confirm your family password before adding a passkey.");
    const input = await parseJson(c.req.raw, responseSchema, deps.config.maxBodyBytes);
    const challenge = await consumeChallenge(c, deps, "register");
    if (challenge.familyId !== family.id || challenge.sessionHash !== sessionHash) {
      throw new AppError(401, "PASSKEY_FAILED", "Passkey verification failed. Try again.");
    }
    const { rpId, origin } = configured(deps);
    try {
      const result = await verifyRegistrationResponse({ response: input as unknown as RegistrationResponseJSON,
        expectedChallenge: challenge.challenge, expectedOrigin: origin, expectedRPID: rpId,
        requireUserVerification: true });
      if (!result.verified || !result.registrationInfo.userVerified) throw new Error("Unverified passkey");
      const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
      await deps.db.auth.addPasskey({ id: credential.id, familyId: family.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter, transports: credential.transports ?? null,
        deviceType: credentialDeviceType, backedUp: credentialBackedUp }, sessionHash);
    } catch (caught) {
      if (caught instanceof AppError && (caught.code === "PASSKEY_LIMIT" || caught.code === "PASSWORD_RECHECK_REQUIRED")) throw caught;
      throw new AppError(401, "PASSKEY_FAILED", "Passkey registration failed. Try again.");
    }
    reflectPasskeyPreference(c, deps, true);
    return c.json({ registered: true }, 201);
  });

  app.delete("/api/v1/parent/passkeys/:id", async (c) => {
    const family = c.get("family");
    const access = await deps.db.auth.parentAccess(currentSessionHash(c, deps), family.id, new Date());
    if (!hasRecentParentPassword(access)) {
      throw new AppError(403, "PASSWORD_RECHECK_REQUIRED", "Confirm your family password before removing a passkey.");
    }
    const result = await deps.db.auth.deletePasskey(c.req.param("id"), family.id);
    reflectPasskeyPreference(c, deps, result.preferred);
    if (!result.removed) throw new AppError(404, "PASSKEY_NOT_FOUND", "Passkey not found.");
    return c.body(null, 204);
  });
}
