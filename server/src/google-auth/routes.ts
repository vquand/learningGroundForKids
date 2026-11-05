import { requireLegalVersion } from '../legal.js';
import { createHash, randomBytes } from 'node:crypto';
import { getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { App, AppDependencies } from '../contracts/app.js';
import { AppError } from '../errors.js';
import { createFamilySession, findSessionFamily, getSessionToken, hashSessionToken, hashPassword } from '../auth.js';
import { parseJson } from '../input.js';
import { PARENT_ACCESS_SECONDS } from '../parent-access.js';
import { createGoogleProvider } from './provider.js';
import { GOOGLE_ONLY_PASSWORD } from './repository.js';
const lifetime=600;
export function registerGoogleRoutes(app: App, deps: AppDependencies) {
  const provider=deps.googleProvider ?? createGoogleProvider();
  const configured=()=>{
    if (!deps.config.google || !deps.db.googleAuth) throw new AppError(503,'GOOGLE_NOT_CONFIGURED','Google sign-in is not available yet.');
    return {config:deps.config.google,repository:deps.db.googleAuth};
  };
  const cookieName=`${deps.config.sessionCookieName}_google`;
  const cookieOptions={httpOnly:true,secure:deps.config.nodeEnv==='production',sameSite:'Lax' as const,path:'/api/v1/auth/google'};
  app.get('/api/v1/auth/google/config',c=>c.json({enabled:Boolean(deps.config.google&&deps.db.googleAuth)}));
  app.post('/api/v1/auth/google/start',async c=>{
    const {config,repository}=configured();
    if (c.req.header('origin')!==config.origin) throw new AppError(403,'GOOGLE_ORIGIN_MISMATCH',`Open ${config.origin} to use Google sign-in.`);
    const input=await parseJson(c.req.raw,z.object({purpose:z.enum(['login','parent','signup']).default('login'),legalVersion:z.unknown().optional()}).strict(),deps.config.maxBodyBytes);
    const {purpose}=input;
    const legalVersion=purpose==='signup'?requireLegalVersion(input.legalVersion):null;
    if (purpose==='signup' && !deps.config.allowRegistration) throw new AppError(403,'REGISTRATION_DISABLED','New family registration is currently closed.');
    const family=purpose==='parent'?await findSessionFamily(c,deps.db,deps.config):null;
    if (purpose==='parent' && !family) throw new AppError(401,'AUTHENTICATION_REQUIRED','Sign in again.');
    if (purpose==='parent' && family?.passwordHash!==GOOGLE_ONLY_PASSWORD) throw new AppError(403,'PARENT_CREDENTIAL_REQUIRED','Use your family password or passkey to unlock Parent Space.');
    const session=getSessionToken(c,deps.config);
    const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
    await repository.createTransaction({tokenHash:hashSessionToken(state),verifier,purpose,legalVersion,familyId:family?.id??null,sessionHash:purpose==='parent'&&session?hashSessionToken(session):null,expiresAt:new Date(Date.now()+lifetime*1000)});
    setCookie(c,cookieName,state,{...cookieOptions,maxAge:lifetime});
    const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.origin+'/api/v1/auth/google/callback',response_type:'code',scope:'openid email',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'}).toString();
    return c.json({url:url.toString()});
  });
  app.get('/api/v1/auth/google/callback',async c=>{
    const {config,repository}=configured();
    const params=new URL(c.req.url).searchParams;
    const state=params.get('state'),cookie=getCookie(c,cookieName);
    setCookie(c,cookieName,'',{...cookieOptions,maxAge:0});
    let destination='/',errorCode='failed';
    try {
      if (!state || state.length>128 || state!==cookie) throw new Error('state mismatch');
      const transaction=await repository.consumeTransaction(hashSessionToken(state),new Date());
      if (!transaction) throw new Error('expired state');
      destination=transaction.purpose==='parent'?'/parent':'/';
      if (params.has('error')) {errorCode='cancelled';throw new Error('provider denied');}
      const code=params.get('code');if (!code || code.length>4096) throw new Error('missing code');
      // A parent callback cannot unlock a newly logged-in family or a rotated/locked session.
      if (transaction.purpose==='parent') {
        const token=getSessionToken(c,deps.config);
        const family=await findSessionFamily(c,deps.db,deps.config);
        if (!token || hashSessionToken(token)!==transaction.sessionHash || family?.id!==transaction.familyId) throw new Error('session changed');
      }
      const identity=await provider.exchange(code,transaction.verifier,config);
      if (transaction.purpose==='parent') {
        const current=await findSessionFamily(c,deps.db,deps.config);
        if (identity.email!==current?.email.toLowerCase()) {errorCode='wrong-account';throw new Error('wrong parent');}
      }
      const family=await repository.resolveIdentity(identity,transaction.purpose==='signup'&&deps.config.allowRegistration,transaction.purpose==='signup'?transaction.legalVersion:null);
      if (transaction.purpose==='parent' && family.id!==transaction.familyId) {errorCode='wrong-account';throw new Error('wrong parent');}
      if (family.isActive===false || family.role!=='family') throw new Error('account unavailable');
      const token=await createFamilySession(c,deps.db,deps.config,family.id,family.passwordHash);
      // Google SSO may be cached on a shared device. Only initial password setup
      // gets a restricted Google capability; existing families still verify a parent credential.
      if (family.passwordHash===GOOGLE_ONLY_PASSWORD && !await deps.db.auth.grantParentAccess(hashSessionToken(token),family.id,new Date(Date.now()+PARENT_ACCESS_SECONDS*1000),'google')) throw new Error('session unavailable');
      return c.redirect(config.origin+destination,303);
    } catch (caught) {
      if (caught instanceof AppError && (caught.code==='CONSENT_REQUIRED' || caught.code==='LEGAL_VERSION_MISMATCH')) {
        destination='/register';
        errorCode=caught.code==='CONSENT_REQUIRED'?'consent_required':'legal_version_mismatch';
      }
      if (caught instanceof AppError && caught.code==='REGISTRATION_DISABLED') errorCode='registration-closed';
      return c.redirect(config.origin+destination+'?google_error='+errorCode,303);
    }
  });
  app.get('/api/v1/parent/google',c=>c.json({password_available:c.get('family').passwordHash!==GOOGLE_ONLY_PASSWORD}));
  app.post('/api/v1/parent/google/password',async c=>{
    const family=c.get('family'),token=getSessionToken(c,deps.config);
    const access=token&&await deps.db.auth.parentAccess(hashSessionToken(token),family.id,new Date());
    if (family.passwordHash!==GOOGLE_ONLY_PASSWORD || !access || access.method!=='google' || access.until.getTime()<=Date.now()+(PARENT_ACCESS_SECONDS-900)*1000) throw new AppError(403,'GOOGLE_REAUTH_REQUIRED','Sign in with Google again before setting a password.');
    const {password}=await parseJson(c.req.raw,z.object({password:z.string().min(12).max(256)}).strict(),deps.config.maxBodyBytes);
    const passwordHash=await hashPassword(password);
    const result=await deps.db.auth.setFamilyPassword({targetId:family.id,actorId:family.id,passwordHash,reason:'Parent added a password after Google sign-in',expectedPasswordHash:GOOGLE_ONLY_PASSWORD});
    if (result!=='updated') throw new AppError(409,'ACCOUNT_CHANGED','Sign in again.');
    const next=await createFamilySession(c,deps.db,deps.config,family.id,passwordHash);
    await deps.db.auth.grantParentAccess(hashSessionToken(next),family.id,new Date(Date.now()+PARENT_ACCESS_SECONDS*1000),'password');
    return c.json({password_available:true});
  });
}
