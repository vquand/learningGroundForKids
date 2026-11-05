import type { UiLanguage } from "../../lib/uiLanguage";

interface LanguageFlagProps {
  language: UiLanguage;
  selected: boolean;
}

const FLAG_ART: Record<UiLanguage, string> = {
  vi: "/illustrations/language-flags/flag-vi-v1.webp",
  en: "/illustrations/language-flags/flag-en-v1.webp",
};

/** Chubby waving flag (art and prompt: art/ui/language-flags-v1). Decorative: the radio's own label names the language. */
export function LanguageFlag({ language, selected }: LanguageFlagProps) {
  return (
    <img
      className="language-prompt-flag"
      src={FLAG_ART[language]}
      alt=""
      width={512}
      height={512}
      draggable={false}
      data-language={language}
      data-selected={selected}
    />
  );
}
