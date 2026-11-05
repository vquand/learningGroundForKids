import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { updateRootPassword, type AuthSession } from "../../api/auth";
import { useAdminStore } from "../../stores/adminStore";
import { useFamilyStore } from "../../stores/familyStore";

export function RootPasswordControl() {
  useUiLanguage();
  const session = useFamilyStore((state) => state.session);
  const generation = useFamilyStore((state) => state.sessionGeneration);
  if (session?.user.isRoot !== true) return null;
  return <RootPasswordDialog session={session} generation={generation} />;
}

function RootPasswordDialog({ session, generation }: { session: AuthSession; generation: number }) {
  useUiLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function ownsSession() {
    const current = useFamilyStore.getState();
    return current.session === session && current.sessionGeneration === generation && !current.isInitializing;
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    const form = formRef.current;
    function discard() {
      requestRef.current?.abort();
      requestRef.current = null;
      form?.reset();
      dialog?.close();
    }
    const unsubscribe = useFamilyStore.subscribe((current) => {
      if (current.session !== session || current.sessionGeneration !== generation || current.isInitializing) {
        discard();
        setPending(false);
        setError(null);
      }
    });
    return () => { unsubscribe(); discard(); };
  }, [session, generation]);

  function resetDialog() {
    formRef.current?.reset();
    setError(null);
    triggerRef.current?.focus();
  }

  function closeDialog() {
    dialogRef.current?.close();
    resetDialog();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current || !ownsSession()) return;
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");
    const fallbackPassword = String(data.get("fallbackPassword") ?? "");
    setError(null);
    if (newPassword.length < 12 || newPassword.length > 256 || fallbackPassword.length < 20 || fallbackPassword.length > 256) {
      setError("Use 12–256 characters for the new password and 20–256 characters for the fallback password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords must match.");
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(true);
    const isCurrent = () => requestRef.current === controller && !controller.signal.aborted && ownsSession();
    try {
      await updateRootPassword({ newPassword, confirmPassword, fallbackPassword }, controller.signal);
      if (!isCurrent()) return;
      formRef.current?.reset();
      useAdminStore.getState().logout();
      useFamilyStore.getState().clearSession();
      navigate("/admin", { replace: true, state: { rootPasswordUpdated: true } });
    } catch (caught) {
      if (isCurrent()) setError(caught instanceof Error ? caught.message : "Unable to update the root password.");
    } finally {
      if (isCurrent()) {
        requestRef.current = null;
        setPending(false);
      }
    }
  }

  const inputClass = "mt-1 block min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60";
  return <>
    <button ref={triggerRef} type="button" onClick={() => {
      if (!ownsSession()) return;
      formRef.current?.reset();
      setError(null);
      dialogRef.current?.showModal();
    }} className="fixed bottom-4 right-4 z-50 min-h-11 max-w-[calc(100%-2rem)] rounded-md bg-blue-700 px-4 py-3 font-semibold text-white shadow-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2">
      {uiText("Update root password")}</button>
    <dialog ref={dialogRef} aria-labelledby="root-password-title" aria-describedby="root-password-help" aria-busy={pending}
      onCancel={(event) => { event.preventDefault(); if (!requestRef.current) closeDialog(); }}
      onClose={() => { if (!dialogRef.current?.open) resetDialog(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-lg bg-white p-6 text-gray-800 shadow-lg backdrop:bg-black/50">
      <h2 id="root-password-title" className="text-xl font-bold">{uiText("Update root password")}</h2>
      <p id="root-password-help" className="mt-3 text-sm text-gray-600">{uiText("All root sessions will be signed out. Enter the existing fallback password exactly, including any spaces.")}</p>
      <form ref={formRef} onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="root-new-password" className="block text-sm font-medium">{uiText("New password")}</label>
          <input id="root-new-password" name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={256} disabled={pending} autoFocus aria-describedby="root-new-password-help" className={inputClass} />
          <p id="root-new-password-help" className="mt-1 text-sm text-gray-600">{uiText("12–256 characters.")}</p>
        </div>
        <div>
          <label htmlFor="root-confirm-password" className="block text-sm font-medium">{uiText("Retype new password")}</label>
          <input id="root-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={256} disabled={pending} className={inputClass} />
        </div>
        <div>
          <label htmlFor="root-fallback-password" className="block text-sm font-medium">{uiText("Fallback password")}</label>
          <input id="root-fallback-password" name="fallbackPassword" type="password" autoComplete="off" required minLength={20} maxLength={256} disabled={pending} aria-describedby="root-fallback-password-help" className={inputClass} />
          <p id="root-fallback-password-help" className="mt-1 text-sm text-gray-600">{uiText("20–256 characters. The fallback password stays unchanged.")}</p>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {pending && <p role="status" className="text-sm text-gray-600">{uiText("Updating password…")}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" disabled={pending} onClick={() => { if (!requestRef.current) closeDialog(); }} className="min-h-11 rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60">{uiText("Cancel")}</button>
          <button type="submit" disabled={pending} className="min-h-11 rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-60">{pending ? uiText("Updating…") : uiText("Update password")}</button>
        </div>
      </form>
    </dialog>
  </>;
}
