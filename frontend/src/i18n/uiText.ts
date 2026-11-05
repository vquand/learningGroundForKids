import { getUiLanguage, type UiLanguage } from '../lib/uiLanguage';
const entities: Record<string, string> = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", larr: '←'};
function decodeEntities(text: string) { return text.replace(/&(amp|lt|gt|quot|apos|larr);/g, (_match, key: string) => entities[key]!); }
let catalog: Readonly<Record<string, string>> | undefined;
let catalogLoad: Promise<void> | undefined;

export function loadUiLanguage(language: UiLanguage): Promise<void> {
  if (language === 'en' || catalog) return Promise.resolve();
  catalogLoad ??= import('./vi.json').then(({ default: loaded }) => {
    catalog = loaded;
  }).catch(error => {
    catalogLoad = undefined;
    throw error;
  });
  return catalogLoad;
}

/** Only call for authored interface copy. Never translate user or learning content. */
export function uiText(english: string, language: UiLanguage = getUiLanguage()): string {
  const match = english.match(/^(\s*)(.*?)(\s*)$/s);
  if (language === 'en') return decodeEntities(english.replace(/Infinidrill/g, 'InfiniDrill'));
  if (!match) return english;
  const [, before = '', key = '', after = ''] = match;
  return before + decodeEntities(catalog?.[key] ?? key.replace(/Infinidrill/g, 'InfiniDrill')) + after;
}

/** Interpolate authored UI templates; values remain unchanged unless explicitly localized. */
export function uiMessage(template: string, values: Record<string, string | number>): string {
  return uiText(template).replace(/\{(\w+)\}/g, (token, key: string) => Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : token);
}
