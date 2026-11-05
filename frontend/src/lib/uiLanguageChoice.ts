import type { UiLanguage } from './uiLanguage';

export type UiLanguageChoiceResult = 'applied' | 'stale' | 'failed';

export function createUiLanguageChoice(
  load: (language: UiLanguage) => Promise<void>,
  apply: (language: UiLanguage) => void,
) {
  let latest = 0;
  return async (language: UiLanguage): Promise<UiLanguageChoiceResult> => {
    const choice = ++latest;
    try {
      await load(language);
      if (choice !== latest) return 'stale';
      apply(language);
      return 'applied';
    } catch {
      return choice === latest ? 'failed' : 'stale';
    }
  };
}
