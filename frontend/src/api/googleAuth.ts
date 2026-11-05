import { coreRequest } from './core.ts';
export const googleAvailability = () => coreRequest<{enabled:boolean}>('/api/v1/auth/google/config');
export async function startGoogleAuth(purpose:'login'|'parent'|'signup'='login', legalVersion?:string) {
  const {url}=await coreRequest<{url:string}>('/api/v1/auth/google/start',{method:'POST',body:JSON.stringify({purpose,...(purpose==='signup'?{legalVersion}:{})})});
  const target=new URL(url);
  if (target.origin!=='https://accounts.google.com' || target.pathname!=='/o/oauth2/v2/auth') throw new Error('Invalid Google sign-in destination.');
  window.location.assign(target.href);
}
