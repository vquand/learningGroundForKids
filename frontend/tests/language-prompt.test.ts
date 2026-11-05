import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearGoogleSignupIntent,
  clearLanguagePromptPending,
  hasGoogleSignupIntent,
  isLanguagePromptPending,
  markGoogleSignupIntent,
  setLanguagePromptPending,
} from "../src/lib/languagePrompt.ts";

test("language picker pending state is device-local and clears after the choice", () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
  });
  try {
    clearLanguagePromptPending();
    assert.equal(isLanguagePromptPending(), false);
    setLanguagePromptPending();
    assert.equal(isLanguagePromptPending(), true);
    clearLanguagePromptPending();
    assert.equal(isLanguagePromptPending(), false);
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("Google signup intent is separate from the picker completion flag", () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
  });
  try {
    clearGoogleSignupIntent();
    markGoogleSignupIntent();
    assert.equal(hasGoogleSignupIntent(), true);
    clearGoogleSignupIntent();
    assert.equal(hasGoogleSignupIntent(), false);
    assert.equal(isLanguagePromptPending(), false);
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
