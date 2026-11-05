import { useState } from "react";
import { loadUiLanguage, uiText } from "../../i18n/uiText";
import { useUiLanguage } from "../../hooks/useUiLanguage";
import { clearLanguagePromptPending } from "../../lib/languagePrompt";
import { setUiLanguage, type UiLanguage } from "../../lib/uiLanguage";
import { LanguageFlag } from "./LanguageFlag";
import "./languagePrompt.css";

const LANGUAGES: readonly UiLanguage[] = ["vi", "en"];

export function LanguagePrompt() {
  const currentLanguage = useUiLanguage();
  const [selected, setSelected] = useState<UiLanguage | null>(null);

  async function choose(language: UiLanguage): Promise<void> {
    await loadUiLanguage(language);
    setUiLanguage(language);
    setSelected(language);
  }

  function continueToHome(): void {
    if (!selected) return;
    clearLanguagePromptPending();
  }

  const confirmation = selected === "vi"
    ? uiText("Selecting language: Vietnamese", "vi")
    : selected === "en"
      ? uiText("Selecting language: English", "en")
      : "";
  const language = selected ?? currentLanguage;

  return (
    <main className="language-prompt" aria-labelledby="language-prompt-title">
      <div className="language-prompt__content">
        <p className="language-prompt__eyebrow">{uiText("A little welcome choice", language)}</p>
        <h1 id="language-prompt-title">{uiText("Choose your interface language", language)}</h1>
        <p className="language-prompt__hint">{uiText("You can change this later on your device.", language)}</p>

        <div className="language-prompt__choices" role="radiogroup" aria-label={uiText("Interface language", language)}>
          {LANGUAGES.map((option) => {
            const isVietnamese = option === "vi";
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected === option}
                className={`language-prompt__choice${selected === option ? " is-selected" : ""}`}
                onClick={() => void choose(option)}
              >
                <LanguageFlag language={option} selected={selected === option} />
                <span className="language-prompt__name">{isVietnamese ? "Tiếng Việt" : "English"}</span>
              </button>
            );
          })}
        </div>

        <p className="language-prompt__confirmation" aria-live="polite">{confirmation}</p>
        <button
          type="button"
          className="language-prompt__continue"
          disabled={!selected}
          onClick={continueToHome}
        >
          {uiText("Continue", language)}
        </button>
      </div>
    </main>
  );
}
