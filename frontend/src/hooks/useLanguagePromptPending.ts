import { useSyncExternalStore } from "react";
import { isLanguagePromptPending, subscribeLanguagePrompt } from "../lib/languagePrompt";

export function useLanguagePromptPending(): boolean {
  return useSyncExternalStore(subscribeLanguagePrompt, isLanguagePromptPending, () => false);
}
