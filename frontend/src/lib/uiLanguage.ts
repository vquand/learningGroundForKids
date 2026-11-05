export type UiLanguage = 'en' | 'vi';
const STORAGE_KEY = 'plg-ui-language';
const listeners = new Set<() => void>();

// Interface locale is device preference only. Never write learning settings,
// session language, family location, or content queries from this module.
export function getUiLanguage(): UiLanguage {
  return typeof document !== 'undefined' && /^vi(?:-|$)/i.test(document.documentElement.lang) ? 'vi' : 'en';
}
export function setUiLanguage(language: UiLanguage) {
  if (typeof document === 'undefined' || (language !== 'en' && language !== 'vi')) return;
  document.documentElement.lang = language;
  try { localStorage.setItem(STORAGE_KEY, language); } catch { /* Private browsing can block storage. */ }
  listeners.forEach(listener => listener());
}
export function initializeUiLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'vi') setUiLanguage(saved);
  } catch { /* Keep the document default. */ }
}
export function subscribeUiLanguage(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
