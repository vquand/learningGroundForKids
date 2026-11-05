import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { coreRequest } from "./core.ts";

export interface ParentAccessStatus {
  elevated: boolean;
  method: "password" | "passkey" | "google" | null;
  expires_at: string | null;
  passkeys_enabled: boolean;
  passkeys_enrolled: boolean;
  password_confirmed?: boolean;
  password_available?: boolean;
}

export interface StoredPasskey {
  id: string;
  created_at: string | null;
  last_used_at: string | null;
}

const LEGACY_PASSKEY_PREFERENCE = "plg-passkey-preferred";
// The server cookie wins, including an explicit false. Older enrollments keep
// their sign-in hint until an authenticated read reconciles the device.
export const passkeyPreferred = () => {
  try {
    const cookie = document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith("plg_passkey_preferred="));
    return cookie !== undefined ? cookie === "plg_passkey_preferred=true" : localStorage.getItem(LEGACY_PASSKEY_PREFERENCE) === "true";
  }
  catch { return false; }
};

function clearLegacyPasskeyPreference() {
  try { localStorage.removeItem(LEGACY_PASSKEY_PREFERENCE); } catch { /* Storage may be disabled. */ }
}

export type ParentElevation = Pick<ParentAccessStatus, "elevated" | "method" | "expires_at" | "password_confirmed">;

export async function parentAccessStatus(): Promise<ParentAccessStatus> {
  const status = await coreRequest<ParentAccessStatus>("/api/v1/parent/access", { cache: "no-store" });
  clearLegacyPasskeyPreference();
  return status;
}

export function lockParentAccess(): Promise<void> {
  return coreRequest<void>("/api/v1/parent/access/lock", { method: "POST" });
}

export function elevateParentWithPassword(password: string): Promise<ParentElevation> {
  return coreRequest<ParentElevation>("/api/v1/parent/access/password", {
    method: "POST", body: JSON.stringify({ password }),
  });
}

export async function elevateParentWithPasskey(): Promise<ParentElevation> {
  const optionsJSON = await coreRequest<PublicKeyCredentialRequestOptionsJSON>("/api/v1/parent/access/passkey/options", { method: "POST" });
  const assertion = await startAuthentication({ optionsJSON });
  return coreRequest<ParentElevation>("/api/v1/parent/access/passkey/verify", {
    method: "POST", body: JSON.stringify(assertion),
  });
}

async function performPasskeyLogin(useBrowserAutofill: boolean, signal?: AbortSignal): Promise<void> {
  const optionsJSON = await coreRequest<PublicKeyCredentialRequestOptionsJSON>("/api/v1/auth/passkey/options", { method: "POST", signal });
  if (signal?.aborted) return;
  const assertion = await startAuthentication({ optionsJSON, useBrowserAutofill });
  if (signal?.aborted) return;
  await coreRequest("/api/v1/auth/passkey/verify", { method: "POST", body: JSON.stringify(assertion) });
}

export function loginWithPasskey(): Promise<void> { return performPasskeyLogin(false); }
export function loginWithPasskeyAutofill(signal: AbortSignal): Promise<void> { return performPasskeyLogin(true, signal); }

export async function listPasskeys(): Promise<StoredPasskey[]> {
  const passkeys = await coreRequest<StoredPasskey[]>("/api/v1/parent/passkeys", { cache: "no-store" });
  clearLegacyPasskeyPreference();
  return passkeys;
}

export async function registerPasskey(): Promise<void> {
  const optionsJSON = await coreRequest<PublicKeyCredentialCreationOptionsJSON>("/api/v1/parent/passkeys/options", { method: "POST" });
  const credential = await startRegistration({ optionsJSON });
  await coreRequest("/api/v1/parent/passkeys/verify", { method: "POST", body: JSON.stringify(credential) });
}

export function removePasskey(id: string): Promise<void> {
  return coreRequest<void>(`/api/v1/parent/passkeys/${encodeURIComponent(id)}`, { method: "DELETE" });
}
