const PENDING_KEY = "plg-language-picker-pending";
const GOOGLE_SIGNUP_INTENT_KEY = "plg-google-signup-intent";
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function isLanguagePromptPending(): boolean {
  return storage()?.getItem(PENDING_KEY) === "true";
}

export function setLanguagePromptPending(): void {
  try {
    storage()?.setItem(PENDING_KEY, "true");
  } finally {
    notify();
  }
}

export function clearLanguagePromptPending(): void {
  try {
    storage()?.removeItem(PENDING_KEY);
  } finally {
    notify();
  }
}

export function subscribeLanguagePrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markGoogleSignupIntent(): void {
  try {
    storage()?.setItem(GOOGLE_SIGNUP_INTENT_KEY, "true");
  } catch {
    // Continue without persistence in privacy modes that block storage.
  }
}

export function hasGoogleSignupIntent(): boolean {
  return storage()?.getItem(GOOGLE_SIGNUP_INTENT_KEY) === "true";
}

export function clearGoogleSignupIntent(): void {
  try {
    storage()?.removeItem(GOOGLE_SIGNUP_INTENT_KEY);
  } catch {
    // Continue without persistence in privacy modes that block storage.
  }
}
