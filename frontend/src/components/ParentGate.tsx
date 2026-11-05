import { GoogleSignInButton, GoogleAuthError } from "./GoogleAuth/GoogleSignInButton";
import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiText } from '../i18n/uiText';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/core";
import { useFamilyStore } from "../stores/familyStore";
import { PasswordInput } from "./PasswordInput";
import {
  elevateParentWithPasskey,
  elevateParentWithPassword,
  parentAccessStatus,
  lockParentAccess,
  type ParentAccessStatus,
} from "../api/passkeys";

const ParentAccessContext = createContext<{
  lock: () => Promise<void>;
  refresh: () => Promise<void>;
} | null>(null);

export function useParentAccess() {
  const access = useContext(ParentAccessContext);
  if (!access) throw new Error("Parent access controls require ParentGate.");
  return access;
}

export function ParentGate({ children, onAccessLost }: { children: ReactNode; onAccessLost?: () => void | Promise<void> }) {
  useUiLanguage();
  const familyId = useFamilyStore((state) => state.familyId);
  const familyName = useFamilyStore((state) => state.familyName);
  const generation = useFamilyStore((state) => state.sessionGeneration);
  const [status, setStatus] = useState<ParentAccessStatus | null>(null);
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const accessLost = useRef(onAccessLost);
  accessLost.current = onAccessLost;
  const channel = useRef<BroadcastChannel | null>(null);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const next = await parentAccessStatus();
      if (version !== requestVersion.current) return;
      if (!next.elevated) void accessLost.current?.();
      setStatus(next);
      setUsePassword(!next.passkeys_enabled || !next.passkeys_enrolled);
      setError(null);
    } catch (caught) {
      if (version !== requestVersion.current) return;
      if (caught instanceof ApiError && [400, 401, 403].includes(caught.status)) {
        void accessLost.current?.();
        setStatus(null);
      }
      setError(caught instanceof ApiError ? caught.message : "Unable to check parent access. Please try again.");
    }
  }, []);

  useEffect(() => {
    setStatus(null);
    setPassword("");
    setError(null);
    void refresh();
    return () => { ++requestVersion.current; };
  }, [familyId, generation, refresh]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const connection = new BroadcastChannel("plg-parent-access");
    channel.current = connection;
    connection.onmessage = () => {
      ++requestVersion.current;
      setStatus(null);
      void refresh();
    };
    return () => { channel.current = null; connection.close(); };
  }, [refresh]);

  useEffect(() => {
    if (!status?.elevated || !status.expires_at) return;
    const delay = Math.max(0, Date.parse(status.expires_at) - Date.now());
    const timer = window.setTimeout(() => { void accessLost.current?.(); setStatus((current) => current ? { ...current, elevated: false } : null); }, delay);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!status?.elevated) return;
    const recheck = () => {
      if (document.visibilityState !== "visible") return;
      void refresh();
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [status?.elevated, refresh]);

  async function lock() {
    await lockParentAccess();
    void accessLost.current?.();
    ++requestVersion.current;
    setStatus((current) => current ? { ...current, elevated: false, method: null, expires_at: null, password_confirmed: false } : null);
    setPassword("");
    setError(null);
    channel.current?.postMessage("locked");
  }

  async function unlock(method: "password" | "passkey") {
    const version = ++requestVersion.current;
    setPending(true);
    setError(null);
    try {
      const elevation = await (method === "password"
        ? elevateParentWithPassword(password)
        : elevateParentWithPasskey());
      if (version !== requestVersion.current) return;
      setStatus(current => current ? { ...current, ...elevation } : current);
      setPassword("");
    } catch (caught) {
      if (version === requestVersion.current) setError(caught instanceof Error ? caught.message : "Unable to confirm parent access.");
    } finally {
      setPending(false);
    }
  }

  if (status?.elevated && status.expires_at && Date.parse(status.expires_at) > Date.now()) {
    return <ParentAccessContext.Provider value={{ lock, refresh }}>
      {error && <div role="alert" className="p-3 text-sm text-rose-700">{error}
        <button type="button" onClick={() => void refresh()} className="ml-2 underline">{uiText("Retry")}</button>
      </div>}
      {children}
    </ParentAccessContext.Provider>;
  }

  return <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-amber-50 p-6">
    <div className="mx-auto max-w-md rounded-[2rem] border border-sky-100 bg-white p-8 shadow-xl">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-500">{uiText("Parent Access")}</p>
      <h1 className="mt-2 text-3xl font-bold text-gray-900">{uiText("Enter Parent Space")}</h1>
      <p className="mt-3 text-sm text-gray-600">{uiText("Confirm you are a parent for ")}{familyName ?? uiText("your family")}.</p>
      <p className="mt-2 text-sm text-gray-500">{uiText("Parent Space stays unlocked for one day, or until you lock it. Kids can keep playing in their profiles.")}</p>
      {!status && !error && <p className="mt-6 text-gray-600">{uiText("Checking access…")}</p>}
      <GoogleAuthError />
      {status && <div className="mt-6">
        {status.password_available===false && <GoogleSignInButton purpose="parent" disabled={pending} />}
        {status.password_available!==false && (usePassword ? <form onSubmit={(event) => { event.preventDefault(); void unlock("password"); }}>
          <div><label htmlFor="parent-access-password" className="block text-sm font-semibold text-gray-700">{uiText("Family password")}</label><PasswordInput id="parent-access-password" autoComplete="current-password" required value={password}
              onChange={(event) => setPassword(event.target.value)}
              containerClassName="mt-2" className="w-full rounded-xl border-2 border-sky-100 px-4 py-3 text-base caret-sky-700 focus:border-sky-500 focus:outline-none" />
          </div>
          <button type="submit" disabled={pending} className="mt-5 min-h-12 w-full rounded-xl bg-sky-700 px-5 py-3 font-bold text-white disabled:opacity-50">
            {pending ? uiText("Checking…") : uiText("Enter Parent Space")}
          </button>
        </form> : <button type="button" onClick={() => void unlock("passkey")} disabled={pending}
          className="min-h-12 w-full rounded-xl bg-sky-700 px-5 py-3 font-bold text-white disabled:opacity-50">
          {pending ? uiText("Checking…") : uiText("Continue with passkey")}
        </button>)}
        {status.passkeys_enabled && status.passkeys_enrolled && <button type="button" onClick={() => { setUsePassword(!usePassword); setError(null); }}
          className="mt-4 text-sm font-semibold text-sky-700 underline underline-offset-2">
          {usePassword ? uiText("Use passkey instead") : uiText("Use password instead")}
        </button>}
      </div>}
      {error && <div role="alert" className="mt-4 text-sm text-rose-700">{error}
        {!status && <button type="button" onClick={() => void refresh()} className="ml-2 underline">{uiText("Retry")}</button>}
      </div>}
      <Link to="/" className="mt-6 inline-block text-sm font-semibold text-sky-700 underline underline-offset-2">{uiText("Back to members")}</Link>
    </div>
  </div>;
}
