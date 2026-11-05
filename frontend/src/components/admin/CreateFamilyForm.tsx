import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useRef, useState, type FormEvent } from "react";
import { adminCreateFamily } from "../../api/admin";
import { useFamilyStore } from "../../stores/familyStore";

export function CreateFamilyForm({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  useUiLanguage();
  const session = useFamilyStore((s) => s.session);
  const generation = useFamilyStore((s) => s.sessionGeneration);
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  useEffect(() => () => { requestRef.current?.abort(); formRef.current?.reset(); }, [session, generation]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password") ?? "");
    if (password !== values.get("confirmPassword")) { setError("Passwords must match."); return; }
    if (password.length < 12 || password.length > 256) { setError("Use 12–256 characters for the password."); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(true);
    setError(null);
    const ownsRequest = () => {
      const current = useFamilyStore.getState();
      return !controller.signal.aborted && current.session === session && current.sessionGeneration === generation;
    };
    try {
      const created = await adminCreateFamily({ name: String(values.get("name") ?? ""), email: String(values.get("email") ?? ""), password }, controller.signal);
      if (ownsRequest()) { form.reset(); onCreated(created.id); }
    } catch (caught) {
      if (ownsRequest()) setError(caught instanceof Error ? caught.message : "Unable to create family.");
    } finally {
      if (ownsRequest()) {
        requestRef.current = null;
        setPending(false);
      }
    }
  }

  const inputClass = "mt-1 block w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600";
  return <dialog ref={dialogRef} aria-labelledby="create-family-title" aria-busy={pending}
    onCancel={(event) => { event.preventDefault(); if (!requestRef.current) onCancel(); }}
    className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 text-gray-900 backdrop:bg-black/40 sm:p-6">
    <h2 id="create-family-title" className="text-xl font-semibold text-gray-900">{uiText("Create a family")}</h2>
    <p className="mt-2 text-sm text-gray-600">{uiText("Create a normal family login. Share the initial password privately; learner profiles can be added after the family signs in.")}</p>
    <form ref={formRef} onSubmit={submit} aria-label={uiText("Create family")} className="mt-4 max-w-lg space-y-4">
      <fieldset disabled={pending} className="space-y-4">
        <div><label htmlFor="family-name" className="text-sm font-medium">{uiText("Family name")}</label>
          <input id="family-name" name="name" required maxLength={80} autoFocus className={inputClass} /></div>
        <div><label htmlFor="family-email" className="text-sm font-medium">{uiText("Family email")}</label>
          <input id="family-email" name="email" type="email" required maxLength={320} autoComplete="off" className={inputClass} /></div>
        <div><label htmlFor="family-password" className="text-sm font-medium">{uiText("Initial password")}</label>
          <input id="family-password" name="password" type="password" required minLength={12} maxLength={256} autoComplete="new-password" className={inputClass} /></div>
        <div><label htmlFor="family-confirm-password" className="text-sm font-medium">{uiText("Retype password")}</label>
          <input id="family-confirm-password" name="confirmPassword" type="password" required minLength={12} maxLength={256} autoComplete="new-password" className={inputClass} /></div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {pending && <p role="status" className="text-sm text-gray-600">{uiText("Creating family...")}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className="min-h-11 rounded-md bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{uiText("Save family")}</button>
        <button type="button" disabled={pending} onClick={() => { formRef.current?.reset(); onCancel(); }} className="min-h-11 rounded-md border border-gray-300 px-4 py-2 disabled:opacity-50">{uiText("Cancel")}</button>
      </div>
    </form>
  </dialog>;
}
