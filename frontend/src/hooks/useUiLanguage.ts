import { useSyncExternalStore } from 'react';
import { getUiLanguage, subscribeUiLanguage } from '../lib/uiLanguage';
export function useUiLanguage() {
  return useSyncExternalStore(subscribeUiLanguage, getUiLanguage, () => 'en' as const);
}
