import { ApiError, coreRequest } from "./core.ts";

export const SESSION_PATH = "/api/v1/auth/session";
export const LOGIN_PATH = "/api/v1/auth/login";
export const LOGOUT_PATH = "/api/v1/auth/logout";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isRoot?: true;
}

export interface AuthSession {
  onboarding?: true;
  parentPasswordRequired?: true;
  visitorCountry?: string;
  user: AuthUser;
}

export async function fetchRegistrationAvailability(): Promise<boolean> {
  const result = await coreRequest<unknown>("/api/v1/auth/registration", { cache: "no-store" });
  if (!result || typeof result !== "object" || !("enabled" in result) || typeof result.enabled !== "boolean") {
    throw new Error("Unable to check whether registration is available.");
  }
  return result.enabled;
}

export async function registerFamily(name: string, email: string, password: string, legalVersion: string): Promise<void> {
  await coreRequest("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: name.trim(), email: email.trim(), password, legalVersion }),
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseSessionResponse(value: unknown): AuthSession | null {
  if (!value || typeof value !== "object" || !("authenticated" in value)) {
    return null;
  }

  const response = value as { onboarding?: unknown; authenticated?: unknown; user?: unknown; visitorCountry?: unknown; parentPasswordRequired?: unknown };
  if (response.authenticated !== true || !response.user || typeof response.user !== "object") {
    return null;
  }

  const user = response.user as Record<string, unknown>;
  if (
    !isNonEmptyString(user.id)
    || !isNonEmptyString(user.email)
    || !isNonEmptyString(user.name)
  ) {
    return null;
  }

  return {
    ...(response.onboarding === true ? { onboarding: true as const } : {}),
    ...(response.parentPasswordRequired===true?{parentPasswordRequired:true as const}:{}),
    ...(typeof response.visitorCountry==='string'&&/^[A-Z]{2}$/.test(response.visitorCountry)?{visitorCountry:response.visitorCountry}:{}),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      ...(user.isRoot === true ? { isRoot: true as const } : {}),
    },
  };
}

export async function fetchSession(): Promise<AuthSession | null> {
  const response = await fetch(SESSION_PATH, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Unable to check your sign-in.");
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error("The authentication server returned an invalid response.");
  }

  return parseSessionResponse(value);
}

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch(LOGIN_PATH, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error("Unable to sign in with those credentials.");
  }
}

export async function logout(): Promise<void> {
  const response = await fetch(LOGOUT_PATH, {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Unable to sign out.");
  }
}

export interface RootPasswordUpdate {
  newPassword: string;
  confirmPassword: string;
  fallbackPassword: string;
}

export async function updateRootPassword(passwords: RootPasswordUpdate, signal?: AbortSignal): Promise<void> {
  await coreRequest<void>("/api/v1/admin/root/password", {
    method: "PATCH",
    body: JSON.stringify(passwords),
    signal,
  });
}

export async function fetchLegalVersion(): Promise<string> {
  const result = await coreRequest<unknown>("/api/v1/legal/version", { cache: "no-store" });
  if (!result || typeof result !== "object" || !("version" in result) || typeof result.version !== "string" || !result.version.trim()) {
    throw new Error("Unable to load the legal text version. Please reload the page and try again.");
  }
  return result.version;
}

// Authored UI copy only: callers localize this result with uiText.
export function registrationErrorMessage(caught: unknown): string {
  if (caught instanceof ApiError) {
    if (caught.code === "REGISTRATION_FAILED") return "We could not create this account. Try signing in, or use a different email.";
    if (caught.code === "LEGAL_VERSION_MISMATCH") return "Our legal text has changed. Please reload the page and read the updated text.";
    if (caught.code === "CONSENT_REQUIRED") return "Please read and accept the Privacy Policy and Terms of Use.";
  }
  return caught instanceof Error ? caught.message : "Unable to create your family account.";
}
