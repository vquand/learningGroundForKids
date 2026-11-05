import { GoogleSignInButton, GoogleAuthError } from "../components/GoogleAuth/GoogleSignInButton";
import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiText } from '../i18n/uiText';
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { registerFamily, registrationErrorMessage } from "../api/auth";
import { SeasonalScreen } from "../components/SeasonalScreen";
import { useRegistrationAvailability } from "../hooks/useRegistrationAvailability";
import { useFamilyStore } from "../stores/familyStore";
import { PasswordInput } from "../components/PasswordInput";
import { clearGoogleSignupIntent, markGoogleSignupIntent, setLanguagePromptPending } from "../lib/languagePrompt";
import { ConsentDialog, type ConsentAction } from "../components/Landing/ConsentDialog";

export function RegisterPage() {
  useUiLanguage();
  const navigate = useNavigate();
  const availability = useRegistrationAvailability();
  const session = useFamilyStore((state) => state.session);
  const initSession = useFamilyStore((state) => state.initSession);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [consentAction, setConsentAction] = useState<ConsentAction | null>(null);
  const consentTriggerRef = useRef<HTMLElement | null>(null);
  const googleContinueRef = useRef<((legalVersion?: string) => void) | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("google_error")) clearGoogleSignupIntent();
  }, []);

  async function createAccount(legalVersion: string) {
    if (pending.current || availability.data !== true) return;
    pending.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await registerFamily(name, email, password, legalVersion);
      setLanguagePromptPending();
      await initSession();
      if (!useFamilyStore.getState().session) {
        throw new Error("Your account was created. Please return to sign in.");
      }
      navigate("/", { replace: true });
    } catch (caught) {
      setError(uiText(registrationErrorMessage(caught)));
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || availability.data !== true) return;
    if (password !== confirmation) {
      setError(uiText("Passwords do not match."));
      return;
    }
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    consentTriggerRef.current = submitter instanceof HTMLElement
      ? submitter
      : document.activeElement instanceof HTMLElement ? document.activeElement : submitButtonRef.current;
    setConsentAction("password");
  }

  if (session) return <Navigate replace to="/" />;

  function interceptGoogleStart(continueSignIn: (legalVersion?: string) => void, button: HTMLButtonElement) {
    googleContinueRef.current = continueSignIn;
    consentTriggerRef.current = button;
    setConsentAction("google");
    return true;
  }

  function closeConsent() {
    googleContinueRef.current = null;
    setConsentAction(null);
  }

  function agreeToConsent(legalVersion: string) {
    const action = consentAction;
    const continueGoogle = googleContinueRef.current;
    googleContinueRef.current = null;
    setConsentAction(null);
    if (action === "password") void createAccount(legalVersion);
    if (action === "google") continueGoogle?.(legalVersion);
  }

  const inputClass = "mt-1 w-full cursor-text rounded-xl border-2 border-gray-200 px-4 py-3 text-base caret-sky-700 focus:border-sky-500 focus:outline-none";
  const passwordClass = "w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base caret-sky-700 focus:border-sky-500 focus:outline-none";
  return (
    <SeasonalScreen className="flex min-h-screen items-center justify-center px-4 py-8">
      <main className="w-full max-w-md rounded-3xl border border-sky-100 bg-white p-6 shadow-lg sm:p-8">
        <h1 className="text-center text-3xl font-extrabold text-gray-800">{uiText("Create your family account")}</h1>
        {availability.isPending ? (
          <p role="status" className="mt-6 text-center text-gray-500">{uiText("Checking registration availability…")}</p>
        ) : availability.isError ? (
          <div className="mt-6 text-center">
            <p role="alert">{uiText("We couldn’t check registration availability.")}</p>
            <button type="button" onClick={() => void availability.refetch()} className="mt-3 min-h-11 font-semibold text-sky-700 underline">{uiText("Try again")}</button>
          </div>
        ) : !availability.data ? (
          <p role="status" className="mt-6 text-center text-gray-600">{uiText("New family registration is currently closed. Please contact the administrator to get started.")}</p>
        ) : (
          <>
          <GoogleAuthError />
          <GoogleSignInButton purpose="signup" onStart={markGoogleSignupIntent} onBeforeStart={interceptGoogleStart} />
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-gray-700">
              {uiText("Family name")}<input name="name" autoComplete="organization" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
            </label>
            <label htmlFor="register-email" className="block text-sm font-semibold text-gray-700">
              {uiText("Email")}<input id="register-email" name="email" type="email" autoComplete="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
            </label>
            <div><label htmlFor="register-password" className="block text-sm font-semibold text-gray-700">{uiText("Password")}</label>
              <PasswordInput id="register-password" name="password" autoComplete="new-password" required minLength={12} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby="password-help" className={passwordClass} />
            </div>
            <p id="password-help" className="text-sm text-gray-500">{uiText("Use at least 12 characters.")}</p>
            <div><label htmlFor="register-confirmation" className="block text-sm font-semibold text-gray-700">{uiText("Confirm password")}</label>
              <PasswordInput id="register-confirmation" name="confirmation" autoComplete="new-password" required minLength={12} maxLength={256} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={passwordClass} />
            </div>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <button ref={submitButtonRef} type="submit" disabled={submitting} className="min-h-13 w-full rounded-xl bg-sky-700 px-5 py-3 text-lg font-bold text-white hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-700 focus:ring-offset-2 disabled:opacity-60">
              {submitting ? uiText("Creating account…") : uiText("Create family account")}
            </button>
          </form>
          </>
        )}
        <p className="mt-6 text-center text-sm text-gray-500"><Link to="/login" className="font-semibold text-sky-700 underline">{uiText("Back to sign in")}</Link></p>
      </main>
      <ConsentDialog pendingAction={consentAction} onAgree={agreeToConsent} onClose={closeConsent} returnFocusRef={consentTriggerRef} />
    </SeasonalScreen>
  );
}
