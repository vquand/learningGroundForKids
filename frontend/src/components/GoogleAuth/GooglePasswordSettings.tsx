import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { coreRequest } from '../../api/core';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { useFamilyStore } from '../../stores/familyStore';
import { useParentAccess } from '../ParentGate';
import { GoogleSignInButton } from './GoogleSignInButton';
import { PasswordInput } from '../PasswordInput';
export function GooglePasswordSettings() {
  useUiLanguage();
  const familyId=useFamilyStore(state=>state.familyId),access=useParentAccess();
  const query=useQuery({queryKey:familyQueryKey('google-password',familyId),queryFn:familyScopedQuery(familyId,()=>coreRequest<{password_available:boolean}>('/api/v1/parent/google')),retry:false});
  const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState('');
  if (query.data?.password_available!==false) return null;
  return <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5"><h2 className="font-semibold">{uiText('Set your parent password')}</h2>
    <p className="mt-2 text-sm text-gray-600">{uiText('Google signs your family in. This separate password protects Parent Space when children share your device.')}</p>
    <form className="mt-4 space-y-3" onSubmit={event=>{
      event.preventDefault();if(password!==confirmation){setError(uiText('Passwords do not match.'));return;}
      setPending(true);setError('');void coreRequest('/api/v1/parent/google/password',{method:'POST',body:JSON.stringify({password})}).then(async()=>{setPassword('');setConfirmation('');await access.refresh();await query.refetch();await useFamilyStore.getState().initSession();}).catch(()=>setError(uiText('Sign in with Google again before setting a password.'))).finally(()=>setPending(false));
    }}>
      <div><label htmlFor="google-parent-password" className="block text-sm font-semibold">{uiText('New password')}</label><PasswordInput id="google-parent-password" autoComplete="new-password" minLength={12} maxLength={256} required value={password} onChange={event=>setPassword(event.target.value)} className="block w-full rounded-lg border border-gray-300 p-3 caret-sky-700"/></div>
      <div><label htmlFor="google-parent-confirmation" className="block text-sm font-semibold">{uiText('Confirm new password')}</label><PasswordInput id="google-parent-confirmation" autoComplete="new-password" minLength={12} maxLength={256} required value={confirmation} onChange={event=>setConfirmation(event.target.value)} className="block w-full rounded-lg border border-gray-300 p-3 caret-sky-700"/></div>
      <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-60">{pending?uiText('Saving…'):uiText('Set password')}</button>
    </form>{error&&<><p role="alert" className="mt-3 text-sm text-rose-700">{error}</p><GoogleSignInButton purpose="parent"/></>}
  </section>;
}
