import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from "react";
import { useUiLanguage } from "../../hooks/useUiLanguage";
import { uiText } from "../../i18n/uiText";
import { landingAchievements, type LandingAchievementDifficulty } from "./landingContent";

const difficultyLabels: Record<LandingAchievementDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const difficultyStars: Record<LandingAchievementDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function DifficultyStars({ difficulty, language }: { difficulty: LandingAchievementDifficulty; language: ReturnType<typeof useUiLanguage> }) {
  const filledStars = difficultyStars[difficulty];
  return <div className="achievement-showcase__difficulty" aria-label={`${uiText(difficultyLabels[difficulty], language)} ${filledStars} ${uiText("stars", language)}`}>
    <span className="achievement-showcase__stars" aria-hidden="true">
      {[0, 1, 2].map((star) => <svg key={star} className={star < filledStars ? "is-filled" : undefined} viewBox="0 0 24 24" focusable="false"><path d="M12 2.7 14.9 9l6.8.7-5.1 4.6 1.4 6.7-6-3.5-6 3.5 1.4-6.7-5.1-4.6L9.1 9 12 2.7Z" /></svg>)}
    </span>
    <span>{uiText(difficultyLabels[difficulty], language)}</span>
  </div>;
}

export function AchievementShowcase() {
  const language = useUiLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isDocumentHidden, setIsDocumentHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeAchievement = landingAchievements[activeIndex] ?? landingAchievements[0];

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const updateVisibility = () => setIsDocumentHidden(document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (reducedMotion || isPaused || isDocumentHidden) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % landingAchievements.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [isDocumentHidden, isPaused, reducedMotion]);

  function selectAchievement(index: number, focus = false) {
    setActiveIndex(index);
    if (focus) requestAnimationFrame(() => buttonRefs.current[index]?.focus());
  }

  function moveSelection(index: number, event: KeyboardEvent<HTMLButtonElement>) {
    const nextIndex = event.key === "ArrowRight" ? (index + 1) % landingAchievements.length : event.key === "ArrowLeft" ? (index - 1 + landingAchievements.length) % landingAchievements.length : event.key === "Home" ? 0 : event.key === "End" ? landingAchievements.length - 1 : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    selectAchievement(nextIndex, true);
  }

  function leaveFocus(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsPaused(false);
  }

  if (!activeAchievement) return null;

  return <div className="landing-band landing-band--arc achievement-showcase" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)} onFocusCapture={() => setIsPaused(true)} onBlurCapture={leaveFocus}>
    <div className="achievement-showcase__intro">
      <h2>{uiText("Conquer achievements", language)}</h2>
      <p>{uiText("Each badge celebrates a real challenge completed in a game. Pick one to see what it takes to earn it.", language)}</p>
    </div>
    <div className="achievement-showcase__scene">
      <div className="achievement-showcase__arch">
        <div className="achievement-showcase__rainbow" aria-hidden="true">
          <span className="achievement-showcase__cloud achievement-showcase__cloud--left" />
          <span className="achievement-showcase__cloud achievement-showcase__cloud--right" />
          <span className="achievement-showcase__sparkle achievement-showcase__sparkle--one" />
          <span className="achievement-showcase__sparkle achievement-showcase__sparkle--two" />
          <span className="achievement-showcase__sparkle achievement-showcase__sparkle--three" />
        </div>
        <ul className="achievement-showcase__thumbs" aria-label={uiText("Achievement collection", language)}>
          {landingAchievements.map((achievement, index) => <li key={achievement.id} style={{ "--a": `${168 - index * 19}deg` } as CSSProperties}>
            <button ref={(element) => { buttonRefs.current[index] = element; }} type="button" aria-label={uiText(achievement.name, language)} aria-pressed={index === activeIndex} tabIndex={index === activeIndex ? 0 : -1} onClick={() => selectAchievement(index)} onFocus={() => setActiveIndex(index)} onKeyDown={(event) => moveSelection(index, event)}>
              <img src={achievement.image} alt="" />
            </button>
          </li>)}
        </ul>
        <div className="achievement-showcase__feature-art">
          <span className="achievement-showcase__feature-sparkle achievement-showcase__feature-sparkle--left" aria-hidden="true" />
          <span className="achievement-showcase__feature-sparkle achievement-showcase__feature-sparkle--right" aria-hidden="true" />
          <img src={activeAchievement.image} alt={uiText(activeAchievement.name, language)} />
        </div>
      </div>
      <div className="achievement-showcase__ribbon" aria-live="polite" aria-atomic="true">
        <h3>{uiText(activeAchievement.name, language)}</h3>
        <span className="achievement-showcase__game">{uiText(activeAchievement.game, language)}</span>
        <DifficultyStars difficulty={activeAchievement.difficulty} language={language} />
        <p>{uiText(activeAchievement.description, language)}</p>
      </div>
    </div>
    <p className="achievement-showcase__caption">{uiText("A few of the badges waiting for you.", language)}</p>
  </div>;
}
