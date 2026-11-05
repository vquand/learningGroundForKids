import { useEffect, useRef, type RefObject } from "react";
import { useUiLanguage } from "../../hooks/useUiLanguage";
import { uiText } from "../../i18n/uiText";
import { legalContent, type LegalSection } from "./legalContent";
import { LegalBlocks } from "./LegalBlocks";

type LegalDialogProps = {
  section: LegalSection | null;
  onSectionChange: (section: LegalSection) => void;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function LegalDialog({ section, onSectionChange, onClose, returnFocusRef }: LegalDialogProps) {
  const language = useUiLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || section === null) return;
    if (!dialog.open) {
      try { dialog.showModal(); } catch { dialog.setAttribute("open", ""); }
    }
    dialog.querySelector<HTMLElement>(".landing-legal__body")?.focus({ preventScroll: true });
  }, [section]);

  useEffect(() => {
    if (section !== null) return;
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
  }, [section]);

  function close() {
    dialogRef.current?.close();
    onClose();
    window.requestAnimationFrame(() => returnFocusRef?.current?.focus());
  }

  const content = section ? legalContent[section] : legalContent.privacy;
  return (
    <dialog ref={dialogRef} className="landing-legal" aria-labelledby="landing-legal-title" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="landing-legal__inner">
        <header className="landing-legal__header">
          <div className="landing-tabs" role="tablist" aria-label={uiText("Legal documents", language)}>
            {(["privacy", "terms"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={section === value} className="landing-tab" onClick={() => onSectionChange(value)}>{uiText(value === "privacy" ? "Privacy" : "Terms", language)}</button>)}
          </div>
          <button type="button" className="landing-legal__close" aria-label={uiText("Close", language)} onClick={close}>×</button>
        </header>
        <div className="landing-legal__body" tabIndex={-1}>
          <h2 id="landing-legal-title">{uiText(content.title, language)}</h2>
          <LegalBlocks blocks={content.blocks} language={language} />
        </div>
        <footer className="landing-legal__footer"><button type="button" className="landing-button landing-button--primary" onClick={close}>{uiText("Got it", language)}</button></footer>
      </div>
    </dialog>
  );
}
