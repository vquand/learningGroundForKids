import {logout} from '../../api/auth';
import {useFamilyStore} from '../../stores/familyStore';
import {ParentGate} from '../ParentGate';
import {GooglePasswordSettings} from './GooglePasswordSettings';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {uiText} from '../../i18n/uiText';
export function GoogleParentSetup() {
  useUiLanguage();
  return <ParentGate><main className="flex min-h-screen items-center justify-center bg-sky-50 p-6"><section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-sm">
    <h1 className="text-2xl font-bold text-gray-800">{uiText('Before children start playing')}</h1>
    <p className="mt-3 text-gray-600">{uiText('Your family account is ready. Set a parent password to keep family settings private on shared devices.')}</p>
    <GooglePasswordSettings/>
    <button type="button" className="mt-4 min-h-11 text-sm font-semibold text-sky-700 underline" onClick={()=>{void logout().then(()=>useFamilyStore.getState().clearSession());}}>{uiText('Sign out')}</button>
  </section></main></ParentGate>;
}
