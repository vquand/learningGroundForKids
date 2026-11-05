import { getUiLanguage, initializeUiLanguage } from '../../src/lib/uiLanguage';
import { loadUiLanguage } from '../../src/i18n/uiText';

export async function bootstrapUiLanguage() {
  initializeUiLanguage();
  await loadUiLanguage(getUiLanguage());
}
