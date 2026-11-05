import { GoogleSignInButton, GoogleAuthError } from "../components/GoogleAuth/GoogleSignInButton";
import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiText } from '../i18n/uiText';
import { useEffect, useRef, useState, type FormEvent } from "react";
import { browserSupportsWebAuthnAutofill, WebAuthnAbortService } from "@simplewebauthn/browser";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import { SeasonalScreen } from "../components/SeasonalScreen";
import { useFamilyStore } from "../stores/familyStore";
import { loginWithPasskey, loginWithPasskeyAutofill, passkeyPreferred } from "../api/passkeys";
import { PasswordInput } from "../components/PasswordInput";

export function FamilyLoginPage() {
  useUiLanguage();
  const navigate = useNavigate();
  const initSession = useFamilyStore((s) => s.initSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usePassword, setUsePassword] = useState(() => !passkeyPreferred());
  const autofillController = useRef<AbortController | null>(null);

  function stopAutofill() {
    autofillController.current?.abort();
    autofillController.current = null;
    WebAuthnAbortService.cancelCeremony();
  }

  useEffect(() => () => stopAutofill(), []);

  async function handleEmailFocus() {
    if (autofillController.current || isSubmitting) return;
    const controller = new AbortController();
    autofillController.current = controller;
    try {
      if (!await browserSupportsWebAuthnAutofill() || controller.signal.aborted) return;
      await loginWithPasskeyAutofill(controller.signal);
      if (controller.signal.aborted) return;
      await initSession();
      navigate("/");
    } catch {
      // A cancelled or unsupported conditional ceremony leaves password sign-in available.
    } finally {
      if (autofillController.current === controller) autofillController.current = null;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    stopAutofill();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      await initSession();
      navigate("/");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasskeyLogin() {
    stopAutofill();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await loginWithPasskey();
      await initSession();
      navigate("/");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in with a passkey.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SeasonalScreen className="min-h-screen px-4 py-8 sm:px-6 sm:py-10">
      <main className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl content-center items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <section className="mx-auto flex w-full max-w-md flex-col items-center text-center lg:items-start lg:self-end lg:pb-5 lg:text-left">
          <img
            src="/illustrations/rice-grain-explorer-pastel.png"
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            className="h-44 w-44 object-contain sm:h-56 sm:w-56"
          />
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 260 32"
            className="-mt-1 mb-3 h-8 w-56 sm:w-64"
          >
            <path
              d="M8 18 C38 9 63 23 91 16 S143 9 168 16 S216 22 252 12"
              fill="none"
              stroke="#8b5e3c"
              strokeDasharray="0.1 8"
              strokeLinecap="round"
              strokeWidth="3"
            />
            <path
              d="M124 7 138 21 M138 7 124 21"
              fill="none"
              stroke="#75472f"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
          </svg>
        </section>

        <section className="family-login-card mx-auto w-full max-w-md rounded-3xl border border-sky-100 bg-white p-6 text-center shadow-lg sm:p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-xl font-extrabold text-white">
            PL
          </div>
          <h1 className="mb-2 text-3xl font-extrabold text-gray-800">{uiText("Welcome back, explorer!")}</h1>
          <p className="mb-7 text-lg text-gray-500">
            {uiText("Sign in to keep your adventures going.")}</p>

          <GoogleAuthError />
          {usePassword ? <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <label htmlFor="family-login-email" className="block text-sm font-semibold text-gray-700">
              {uiText("Email")}<input
                id="family-login-email"
                type="email"
                name="email"
                autoComplete="username webauthn"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onFocus={() => void handleEmailFocus()}
                className="mt-1 w-full cursor-text rounded-xl border-2 border-gray-200 px-4 py-3 text-base caret-sky-700 focus:border-blue-400 focus:outline-none"
              />
            </label>

            <div>
              <label htmlFor="family-login-password" className="block text-sm font-semibold text-gray-700">{uiText("Password")}</label>
              <PasswordInput
                id="family-login-password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base caret-sky-700 focus:border-blue-400 focus:outline-none"
              />
            </div>

            {errorMessage && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-sky-700 px-5 py-3 text-lg font-bold text-white transition-all hover:bg-sky-800 disabled:cursor-wait disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-sky-700 focus:ring-offset-2"
            >
              {isSubmitting ? uiText("Signing in...") : uiText("Sign in")}
            </button>
          </form> : <button type="button" disabled={isSubmitting} onClick={() => void handlePasskeyLogin()}
            className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-sky-700 px-5 py-3 text-lg font-bold text-white transition-all hover:bg-sky-800 disabled:opacity-60">
            {isSubmitting ? uiText("Signing in…") : uiText("Sign in with passkey")}
          </button>}

          <GoogleSignInButton disabled={isSubmitting} onStart={stopAutofill} />

          <button type="button" onClick={() => { stopAutofill(); setUsePassword(!usePassword); setErrorMessage(null); }}
            className="mt-4 text-sm font-semibold text-sky-700 underline underline-offset-2">
            {usePassword ? uiText("Use passkey instead") : uiText("Use password instead")}
          </button>
          {!usePassword && errorMessage && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>}

          <p className="mt-5 text-sm text-gray-500">
            {uiText("New family?")}{" "}
            <Link to="/register" className="font-semibold text-sky-700 underline hover:text-sky-800">
              {uiText("Create a family account")}</Link>
          </p>

        </section>
      </main>
    </SeasonalScreen>
  );
}
