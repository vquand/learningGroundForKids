import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { uiText } from "../i18n/uiText";
import { useUiLanguage } from "../hooks/useUiLanguage";
import { getTourPopoverPosition, KID_TOUR_STEPS, type KidTourTarget, type TourPopoverPosition } from "../lib/kidTour";
import "./kidPlaygroundTour.css";

interface KidPlaygroundTourProps {
  stepIndex: number;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
}

export function KidPlaygroundTour({ stepIndex, onBack, onNext, onFinish }: KidPlaygroundTourProps) {
  const language = useUiLanguage();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<TourPopoverPosition | null>(null);
  const step = KID_TOUR_STEPS[stepIndex] ?? KID_TOUR_STEPS[0];
  const isLast = stepIndex === KID_TOUR_STEPS.length - 1;

  useLayoutEffect(() => {
    if (!step) return;
    const target = document.querySelector<HTMLElement>(`[data-tour="${step.target satisfies KidTourTarget}"]`);
    if (!target) return;
    target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    const update = () => {
      const targetRect = target.getBoundingClientRect();
      const popoverRect = popoverRef.current?.getBoundingClientRect();
      if (!popoverRect) return;
      setPosition(getTourPopoverPosition(
        { x: targetRect.x, y: targetRect.y, width: targetRect.width, height: targetRect.height },
        { width: popoverRect.width, height: popoverRect.height },
        { width: window.innerWidth, height: window.innerHeight },
      ));
    };
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [step]);

  useEffect(() => {
    popoverRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onFinish();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onFinish, stepIndex]);

  if (!step) return null;
  return (
    <>
      <div className="kid-tour-backdrop" aria-hidden="true" />
      <div
        ref={popoverRef}
        className={`kid-tour-popover kid-tour-popover--${position?.placement ?? "below"}`}
        style={position ? { left: position.left, top: position.top } : undefined}
        role="dialog"
        aria-label={uiText("Playground guide", language)}
        tabIndex={-1}
      >
        <p className="kid-tour-progress">{uiText("Playground guide", language)} · {stepIndex + 1}/{KID_TOUR_STEPS.length}</p>
        <p className="kid-tour-message">{uiText(step.message, language)}</p>
        <div className="kid-tour-actions">
          <button type="button" className="kid-tour-secondary" onClick={onBack} disabled={stepIndex === 0}>{uiText("Back", language)}</button>
          <button type="button" className="kid-tour-secondary" onClick={onFinish}>{uiText(isLast ? "Done" : "Skip", language)}</button>
          {!isLast && <button type="button" className="kid-tour-primary" onClick={onNext}>{uiText("Next", language)}</button>}
        </div>
      </div>
    </>
  );
}
