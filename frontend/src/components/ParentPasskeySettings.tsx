import { useQueryClient } from '@tanstack/react-query';
import { familyQueryKey, familyScopedQuery } from '../lib/familyQueries';
import { useFamilyStore } from '../stores/familyStore';
import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiMessage, uiText } from '../i18n/uiText';
import { ApiError } from '../api/core';
import { useCallback, useEffect, useRef, useState } from "react";
import { useParentAccess } from "./ParentGate";
import {
  elevateParentWithPassword,
  listPasskeys,
  parentAccessStatus,
  registerPasskey,
  removePasskey,
  type ParentAccessStatus,
  type StoredPasskey,
} from "../api/passkeys";

export function ParentPasskeySettings() {
  const language = useUiLanguage();
  const parentAccess = useParentAccess();
  const cache = useQueryClient();
  const familyId = useFamilyStore(state => state.familyId);
  const [status, setStatus] = useState<ParentAccessStatus | null>(null);
  const [passkeys, setPasskeys] = useState<StoredPasskey[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<"load" | "refresh" | null>(null);
  const [password, setPassword] = useState("");
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const refreshVersion = useRef(0);
  const operationVersion = useRef(0);
  const mounted = useRef(false);
  const sessionGeneration = useFamilyStore(state => state.sessionGeneration);

  const refresh = useCallback(async (afterRemoval = false) => {
    const version = ++refreshVersion.current;
    setLoading(true);
    setLoadError(null);
    const [access, saved] = await Promise.allSettled([
      familyScopedQuery(familyId, parentAccessStatus)(),
      familyScopedQuery(familyId, listPasskeys)(),
    ]);
    const session = useFamilyStore.getState();
    if (!mounted.current || version !== refreshVersion.current || session.familyId !== familyId || session.sessionGeneration !== sessionGeneration) return false;
    setStatus(access.status === 'fulfilled' ? access.value : null);
    setPasskeys(saved.status === 'fulfilled' ? saved.value : null);
    if (saved.status === 'fulfilled') {
      setPendingRemovalId(current => saved.value.some(passkey => passkey.id === current) ? current : null);
    }
    const succeeded = access.status === 'fulfilled' && saved.status === 'fulfilled';
    setLoadError(succeeded ? null : afterRemoval ? "refresh" : "load");
    setLoading(false);
    void cache.invalidateQueries({ queryKey: familyQueryKey('family-onboarding', familyId) });
    return succeeded;
  }, [cache, familyId, sessionGeneration]);

  useEffect(() => {
    mounted.current = true;
    setPending(false);
    setMessage(null);
    setPassword("");
    setPendingRemovalId(null);
    void refresh();
    return () => { mounted.current = false; ++refreshVersion.current; ++operationVersion.current; };
  }, [refresh]);

  useEffect(() => {
    if (!status?.password_confirmed || !status.expires_at) return;
    const confirmedUntil = Date.parse(status.expires_at) - (86_400 - 900) * 1000;
    const timer = window.setTimeout(() => {
      setStatus((current) => current ? { ...current, password_confirmed: false } : null);
    }, Math.max(0, confirmedUntil - Date.now()));
    return () => window.clearTimeout(timer);
  }, [status?.password_confirmed, status?.expires_at]);

  useEffect(() => {
    if (pendingRemovalId && !status?.password_confirmed) passwordInput.current?.focus();
  }, [pendingRemovalId, status?.password_confirmed]);

  function startOperation() {
    // A queued newer action also invalidates any older action's list refresh.
    ++refreshVersion.current;
    setLoading(false);
    return ++operationVersion.current;
  }

  function isCurrentOperation(version: number) {
    const session = useFamilyStore.getState();
    return mounted.current && version === operationVersion.current && session.familyId === familyId && session.sessionGeneration === sessionGeneration;
  }

  async function deleteSavedPasskey(id: string, version: number) {
    await familyScopedQuery(familyId, () => removePasskey(id))();
    if (!isCurrentOperation(version)) return;
    setPendingRemovalId(null);
    setMessage("Passkey removed.");
    await refresh(true);
    if (!isCurrentOperation(version)) return;
    await parentAccess.refresh();
  }

  async function handleRemovalError(error: unknown, id: string, version: number) {
    if (error instanceof ApiError && error.code === 'PASSKEY_NOT_FOUND') {
      await refresh();
      if (!isCurrentOperation(version)) return;
    }
    if (error instanceof ApiError && error.code === 'PASSWORD_RECHECK_REQUIRED') {
      setStatus(current => current ? { ...current, password_confirmed: false } : null);
      setPendingRemovalId(id);
    }
    setMessage(error instanceof Error ? error.message : "Unable to remove passkey.");
  }

  async function confirmPassword() {
    const version = startOperation();
    const removalId = pendingRemovalId;
    setPending(true); setMessage(null);
    try {
      await familyScopedQuery(familyId, () => elevateParentWithPassword(password))();
      if (!isCurrentOperation(version)) return;
      setPassword("");
      // Elevation returns only access fields. Always read a complete status.
      if (removalId) await deleteSavedPasskey(removalId, version);
      else {
        const refreshed = await refresh();
        if (!isCurrentOperation(version)) return;
        await parentAccess.refresh();
        if (isCurrentOperation(version) && refreshed) setMessage("Password confirmed. You can now add a passkey.");
      }
    } catch (error) {
      if (!isCurrentOperation(version)) return;
      if (removalId) await handleRemovalError(error, removalId, version);
      else setMessage(error instanceof Error ? error.message : "Password check failed.");
    }
    finally { if (isCurrentOperation(version)) setPending(false); }
  }

  async function add() {
    const version = startOperation();
    setPending(true); setMessage(null);
    try {
      await familyScopedQuery(familyId, registerPasskey)();
      if (!isCurrentOperation(version)) return;
      const refreshed = await refresh();
      if (!isCurrentOperation(version)) return;
      await parentAccess.refresh();
      if (isCurrentOperation(version) && refreshed) setMessage("Passkey added. It will be offered first on this device.");
    } catch (error) {
      if (isCurrentOperation(version)) setMessage(error instanceof Error ? error.message : "Passkey setup failed.");
    }
    finally { if (isCurrentOperation(version)) setPending(false); }
  }

  async function remove(id: string) {
    const version = startOperation();
    if (!status?.password_confirmed) {
      setPendingRemovalId(id);
      setPassword("");
      setMessage(null);
      return;
    }
    setPending(true); setMessage(null);
    try {
      await deleteSavedPasskey(id, version);
    } catch (error) { if (isCurrentOperation(version)) await handleRemovalError(error, id, version); }
    finally { if (isCurrentOperation(version)) setPending(false); }
  }

  const pendingRemovalIndex = passkeys?.findIndex(passkey => passkey.id === pendingRemovalId) ?? -1;
  const passwordConfirmed = status?.password_confirmed === true;
  const passwordAvailable = status?.password_available !== false;
  const disabled = pending || loading || loadError !== null;
  return <section className="mb-6 rounded-2xl border border-sky-100 bg-white p-5 shadow-sm" aria-labelledby="passkey-settings-title" aria-busy={loading}>
    <h2 id="passkey-settings-title" className="text-xl font-bold text-gray-900">{uiText("Parent sign-in")}</h2>
    <p className="mt-1 text-sm text-gray-600">{uiText("Add a passkey for quick sign-in. Your family password stays available as a fallback.")}</p>
    {loading && <p role="status" className="mt-3 text-sm text-gray-600">{uiText('Loading passkey settings…')}</p>}
    {loadError && <p role={loadError === 'refresh' ? 'status' : 'alert'} className="mt-3 text-sm text-rose-700">{uiText(loadError === 'refresh' ? 'Passkey removed. The saved passkey list could not be refreshed.' : 'Unable to load passkey settings.')} <button type="button" disabled={pending || loading} onClick={() => void refresh(loadError === 'refresh')} className="min-h-11 px-3 font-semibold underline">{uiText('Retry')}</button></p>}
    {status && !status.passkeys_enabled && <p className="mt-3 text-sm text-gray-600">{uiText('Passkeys are not available yet. You can keep using your family password.')}</p>}
    {status && !passwordAvailable && <p className="mt-3 text-sm text-gray-600">{uiText('Set a parent password before managing passkeys.')}</p>}
    {status && passwordAvailable && !passwordConfirmed && <form onSubmit={(event) => { event.preventDefault(); void confirmPassword(); }} className="mt-4 flex flex-wrap items-end gap-3">
      {pendingRemovalIndex >= 0 && <p className="w-full text-sm text-gray-700">{uiMessage('Confirm your password to remove Passkey {number}.', { number: pendingRemovalIndex + 1 })}</p>}
      <label className="flex-1 text-sm font-semibold text-gray-700">{uiText("Confirm family password to add or remove a passkey")}<input ref={passwordInput} type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}
          className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 px-3 text-base" />
      </label>
      <button type="submit" disabled={disabled} className="min-h-11 rounded-lg bg-sky-700 px-4 font-semibold text-white disabled:opacity-50">{uiText(pendingRemovalId ? "Confirm password and remove passkey" : "Confirm password")}</button>
      {pendingRemovalId && <button type="button" disabled={disabled} onClick={() => { setPendingRemovalId(null); setPassword(""); setMessage(null); }} className="min-h-11 px-3 font-semibold underline">{uiText('Cancel')}</button>}
    </form>}
    <button type="button" onClick={() => void add()} disabled={disabled || !status?.passkeys_enabled || !passwordAvailable || !passwordConfirmed}
      className="mt-4 min-h-11 rounded-lg bg-sky-700 px-4 font-semibold text-white disabled:opacity-50">{uiText("Add passkey")}</button>
    {passkeys?.length === 0 && <p className="mt-3 text-sm text-gray-600">{uiText('No passkeys registered yet.')}</p>}
    {passkeys && passkeys.length > 0 && <ul className="mt-4 space-y-2">
      {passkeys.map((passkey, index) => <li key={passkey.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-sky-50 px-4 py-3 text-sm">
        <span>{uiText("Passkey ")}{index + 1}{passkey.created_at ? ` · ${uiMessage('Added {date}', { date: new Date(passkey.created_at).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-GB') })}` : ""}</span>
        <button type="button" disabled={disabled || !passwordAvailable} onClick={() => void remove(passkey.id)} className="min-h-11 px-3 font-semibold text-rose-700 underline disabled:opacity-50">{uiText("Remove")}</button>
      </li>)}
    </ul>}
    {message && loadError !== "refresh" && <p role="status" className="mt-3 text-sm text-gray-700">{uiText(message)}</p>}
  </section>;
}
