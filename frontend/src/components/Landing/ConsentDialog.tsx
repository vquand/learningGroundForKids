import { fetchLegalVersion } from "../../api/auth";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useUiLanguage } from "../../hooks/useUiLanguage";
import { uiText } from "../../i18n/uiText";
import { hasReachedConsentEnd } from "./consentState";
import { legalContent } from "./legalContent";
import { LegalBlocks } from "./LegalBlocks";
import "./landing.css";

export type ConsentAction = "password" | "google";

type ConsentDialogProps = {
  pendingAction: ConsentAction | null;
  onAgree: (legalVersion: string) => void;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function ConsentDialog({ pendingAction, onAgree, onClose, returnFocusRef }: ConsentDialogProps) {
  const language = useUiLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const [legalVersion, setLegalVersion] = useState<string | null>(null);
  const [versionError, setVersionError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLegalVersion(null);
    setVersionError(false);
    if (pendingAction !== null) {
      void fetchLegalVersion().then(version => {
        if (!cancelled) setLegalVersion(version);
      }).catch(() => { if (!cancelled) setVersionError(true); });
    }
    return () => { cancelled = true; };
  }, [pendingAction]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pendingAction === null) {
      if (dialog.open) dialog.close();
      return;
    }

    setReachedEnd(false);
    setChecked(false);
    if (!dialog.open) {
      try { dialog.showModal(); } catch { dialog.setAttribute("open", ""); }
    }
    const region = scrollRef.current;
    if (!region) return;
    region.scrollTop = 0;
    region.focus({ preventScroll: true });

    const checkPosition = () => {
      if (hasReachedConsentEnd(region.scrollTop, region.scrollHeight, region.clientHeight)) {
        setReachedEnd(true);
      }
    };
    const frame = window.requestAnimationFrame(checkPosition);
    region.addEventListener("scroll", checkPosition, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(checkPosition);
    observer?.observe(region);
    return () => {
      window.cancelAnimationFrame(frame);
      region.removeEventListener("scroll", checkPosition);
      observer?.disconnect();
    };
  }, [pendingAction]);

  function dismiss() {
    dialogRef.current?.close();
    onClose();
    window.requestAnimationFrame(() => returnFocusRef?.current?.focus());
  }

  function agree() {
    if (!checked || !reachedEnd || !legalVersion) return;
    dialogRef.current?.close();
    onAgree(legalVersion);
  }

  return (
    <dialog
      ref={dialogRef}
      className="landing-consent"
      aria-labelledby="landing-consent-title"
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }}
    >
      <div className="landing-consent__inner">
        <header className="landing-consent__header">
          <h2 id="landing-consent-title">{uiText("Please read before continuing", language)}</h2>
          <button type="button" className="landing-consent__close" aria-label={uiText("Close", language)} onClick={dismiss}>×</button>
        </header>
        <div
          ref={scrollRef}
          className="landing-consent__body"
          role="region"
          tabIndex={0}
          aria-label={uiText("Privacy Policy and Terms of Use", language)}
          aria-describedby="landing-consent-hint"
        >
          <p id="landing-consent-hint" className="landing-consent__hint">{uiText("Scroll to the end to continue", language)}</p>
          {pendingAction === "google" && <p className="landing-consent__google">{uiText("Signing up with Google: Google shares only your email address with us, plus a private account ID so we can recognise you next time. We do not receive your name, photo, contacts or password.", language)}</p>}
          <section aria-labelledby="landing-consent-privacy-title">
            <h3 id="landing-consent-privacy-title">{uiText(legalContent.privacy.title, language)}</h3>
            <LegalBlocks blocks={legalContent.privacy.blocks} language={language} />
          </section>
          <section aria-labelledby="landing-consent-terms-title">
            <h3 id="landing-consent-terms-title">{uiText(legalContent.terms.title, language)}</h3>
            <LegalBlocks blocks={legalContent.terms.blocks} language={language} />
          </section>
        </div>
        <footer className="landing-consent__footer">
          {versionError && <p role="alert">{uiText("Unable to load the legal text version. Please reload the page and try again.", language)}</p>}
          {!legalVersion && !versionError && <p role="status">{uiText("Loading legal text version…", language)}</p>}
          <label className="landing-consent__agreement">
            <input
              type="checkbox"
              checked={checked}
              disabled={!reachedEnd}
              onChange={(event) => setChecked(event.target.checked)}
            />
            <span>{uiText("I have read and agree to the Privacy Policy and Terms of Use", language)}</span>
          </label>
          <div className="landing-consent__actions">
            <button type="button" className="landing-button landing-button--secondary" onClick={dismiss}>{uiText("Cancel", language)}</button>
            <button type="button" className="landing-button landing-button--primary" disabled={!checked || !reachedEnd || !legalVersion} onClick={agree}>{uiText("I agree & continue", language)}</button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
