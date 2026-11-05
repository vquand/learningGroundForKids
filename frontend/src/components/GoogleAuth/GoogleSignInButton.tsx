import { registrationErrorMessage } from '../../api/auth';
import { ApiError } from '../../api/core';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { googleAvailability, startGoogleAuth } from '../../api/googleAuth';
type GoogleSignInButtonProps = {
  purpose?: 'login' | 'parent' | 'signup';
  disabled?: boolean;
  onStart?: () => void;
  onBeforeStart?: (continueSignIn: (legalVersion?: string) => void, button: HTMLButtonElement) => boolean | void;
};
export function GoogleSignInButton({purpose='login',disabled=false,onStart,onBeforeStart}:GoogleSignInButtonProps) {
  useUiLanguage();
  const config=useQuery({queryKey:['google-auth-config'],queryFn:googleAvailability,staleTime:60_000,retry:false});
  const [pending,setPending]=useState(false),[error,setError]=useState('');
  function start(legalVersion?: string) {
    onStart?.();setError('');setPending(true);
    void startGoogleAuth(purpose, legalVersion).catch((caught: unknown) => {
      if (caught instanceof ApiError && ['LEGAL_VERSION_MISMATCH', 'CONSENT_REQUIRED'].includes(caught.code)) {
        setError(uiText(registrationErrorMessage(caught)));
      } else if (caught instanceof ApiError && caught.code === 'GOOGLE_ORIGIN_MISMATCH') {
        setError(caught.message);
      } else {
        setError(uiText('Google sign-in could not start. Please try again.'));
      }
      setPending(false);
    });
  }
  if (!config.data?.enabled) return null;
  return <div className="mt-5"><button type="button" disabled={disabled||pending} onClick={(event)=>{
    if (onBeforeStart?.(start, event.currentTarget)) return;
    start();
  }} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2">
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4.1 6v5h6.6c3.9-3.6 6.1-8.7 6.1-14.7Z"/><path fill="#34A853" d="M24 44c5.5 0 10.2-1.8 13.5-4.9l-6.6-5c-1.8 1.2-4.2 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2C9.1 39.5 16 44 24 44Z"/><path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.2H5.8a20 20 0 0 0 0 17.6l6.8-5.2Z"/><path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8A19.8 19.8 0 0 0 24 4C16 4 9.1 8.5 5.8 15.2l6.8 5.2C14.2 15.6 18.7 12 24 12Z"/></svg>
    {pending?uiText('Opening Google…'):uiText('Continue with Google')}
  </button>{error&&<p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}</div>;
}
export function GoogleAuthError() {
  useUiLanguage();
  const code=new URLSearchParams(window.location.search).get('google_error');
  if (!code) return null;
  const messages:Record<string,string>={consent_required:'Please read and accept the Privacy Policy and Terms of Use.', legal_version_mismatch:'Our legal text has changed. Please reload the page and read the updated text.', cancelled:'Google sign-in was cancelled.', 'wrong-account':'Choose the Google account for this family.', 'registration-closed':'New family registration is currently closed.', failed:'Google sign-in could not be verified. Please try again.'};
  return <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{uiText(messages[code]??messages.failed!)}</p>;
}
