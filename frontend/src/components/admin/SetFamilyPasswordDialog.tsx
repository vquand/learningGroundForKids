import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useRef, useState, type FormEvent } from "react";
import { adminSetFamilyPassword } from "../../api/admin";
import { useFamilyStore } from "../../stores/familyStore";

export function SetFamilyPasswordDialog({ familyId, familyName, onClose, onSaved }: {
  familyId: string; familyName: string; onClose: () => void; onSaved: () => void;
}) {
  useUiLanguage();
  const session = useFamilyStore((state) => state.session);
  const generation = useFamilyStore((state) => state.sessionGeneration);
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); formRef.current?.reset(); requestRef.current?.abort(); };
  }, []);
  useEffect(() => () => { requestRef.current?.abort(); formRef.current?.reset(); }, [session, generation]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password") ?? "");
    const confirmation = String(values.get("confirmation") ?? "");
    const reason = String(values.get("reason") ?? "").trim();
    if (password !== confirmation) { setError("Passwords must match."); return; }
    if (password.length < 12 || password.length > 256) { setError("Use 12–256 characters for the password."); return; }
    if (reason.length < 3 || reason.length > 500) { setError("Enter a reason of 3–500 characters."); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(true);
    setError(null);
    const ownsRequest = () => {
      const current = useFamilyStore.getState();
      return !controller.signal.aborted && current.session === session && current.sessionGeneration === generation;
    };
    try {
      await adminSetFamilyPassword(familyId, password, reason, controller.signal);
      if (ownsRequest()) { form.reset(); onSaved(); }
    } catch (caught) {
      if (ownsRequest()) {
        const passwordField = form.elements.namedItem("password");
        const confirmationField = form.elements.namedItem("confirmation");
        if (passwordField instanceof HTMLInputElement) passwordField.value = "";
        if (confirmationField instanceof HTMLInputElement) confirmationField.value = "";
        setError(caught instanceof Error ? caught.message : "Unable to set the family password.");
      }
    } finally {
      if (ownsRequest()) { requestRef.current = null; setPending(false); }
    }
  }

  const inputClass = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600";
  return <dialog ref={dialogRef} aria-labelledby="set-family-password-title" aria-busy={pending}
    onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}
    className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 text-gray-900 backdrop:bg-black/40 sm:p-6">
    <h2 id="set-family-password-title" className="text-xl font-semibold">{uiText("Set password for ")}{familyName}</h2>
    <p className="mt-2 text-sm text-gray-600">{uiText("This password remains valid until changed again. All current sessions for this family will end when you save.")}</p>
    <form ref={formRef} onSubmit={submit} aria-label={uiText("Set family password")} className="mt-4 space-y-4">
      <fieldset disabled={pending} className="space-y-4">
        <div><label htmlFor="set-family-password" className="text-sm font-medium">{uiText("New password")}</label>
          <input id="set-family-password" name="password" type="password" required minLength={12} maxLength={256} autoComplete="new-password" autoFocus className={inputClass} /></div>
        <div><label htmlFor="set-family-confirmation" className="text-sm font-medium">{uiText("Confirm new password")}</label>
          <input id="set-family-confirmation" name="confirmation" type="password" required minLength={12} maxLength={256} autoComplete="new-password" className={inputClass} /></div>
        <div><label htmlFor="set-family-reason" className="text-sm font-medium">{uiText("Support reason")}</label>
          <textarea id="set-family-reason" name="reason" required minLength={3} maxLength={500} rows={3} className={inputClass} /></div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {pending && <p role="status" className="text-sm text-gray-600">{uiText("Setting password...")}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className="min-h-11 rounded-md bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{uiText("Set password")}</button>
        <button type="button" disabled={pending} onClick={() => { formRef.current?.reset(); onClose(); }} className="min-h-11 rounded-md border border-gray-300 px-4 py-2 disabled:opacity-50">{uiText("Cancel")}</button>
      </div>
    </form>
  </dialog>;
}
