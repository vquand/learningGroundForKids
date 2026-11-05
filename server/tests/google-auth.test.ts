import { LEGAL_VERSION } from '../src/legal.js';
import { AppError } from '../src/errors.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { hashSessionToken, verifyPassword } from '../src/auth.js';
import { createGoogleProvider } from '../src/google-auth/provider.js';
import type { AppDatabase, FamilyRecord } from '../src/contracts/db.js';
import type { GoogleTransaction } from '../src/google-auth/contracts.js';
const config=()=>loadConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://test:test@localhost/plg_test',ALLOWED_ORIGINS:'http://localhost:5173',ALLOWED_FORWARDED_HOSTS:'localhost',ALLOW_REGISTRATION:'true',GOOGLE_CLIENT_ID:'test.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'test-only-secret',GOOGLE_AUTH_ORIGIN:'http://localhost:5173'});
function fixture() {
 const transactions=new Map<string,GoogleTransaction>(),sessions=new Map<string,FamilyRecord>(),age={seconds:0};let exchanges=0,resolutions=0,grants=0;
 const resolved: { allowRegistration: boolean; legalVersion: string | null | undefined }[]=[];
 const resolutionFailure: { code?: string } = {};
 const family:FamilyRecord={id:'existing-family',email:'parent@example.com',displayName:'Existing family',passwordHash:'existing-hash',role:'family'};
 const db={auth:{async createSession(input:{tokenHash:string}){sessions.set(input.tokenHash,family);},async findFamilyBySessionHash(hash:string){return sessions.get(hash)??null;},async parentAccess(hash:string){return sessions.has(hash)&&family.passwordHash==="!google-only"?{method:"google",until:new Date(Date.now()+86_400_000-age.seconds*1000)}:null;},async grantParentAccess(){grants++;return true;},async setFamilyPassword(input:{passwordHash:string;expectedPasswordHash?:string}){if(input.expectedPasswordHash!==family.passwordHash)return "not_found";family.passwordHash=input.passwordHash;return "updated";}},googleAuth:{async createTransaction(row:GoogleTransaction){transactions.set(row.tokenHash,row);},async consumeTransaction(hash:string,now:Date){const row=transactions.get(hash);transactions.delete(hash);return row&&row.expiresAt>now?row:null;},async resolveIdentity(_identity: unknown,allowRegistration: boolean,legalVersion?: string | null){resolutions++;resolved.push({allowRegistration,legalVersion});if(resolutionFailure.code)throw new AppError(400,resolutionFailure.code,'Consent needed');return family;}}} as unknown as AppDatabase;
 const app=createApp({config:config(),db,logger:{info(){},warn(){},error(){}},googleProvider:{async exchange(){exchanges++;return {sub:'subject',email:family.email,name:'Google display name'};}}});
 const request=(path:string,init?:RequestInit)=>app.request('http://localhost:5173'+path,init);
 const start=async(purpose:'login'|'parent'='login',session?:string)=>{const response=await request('/api/v1/auth/google/start',{method:'POST',headers:{origin:'http://localhost:5173','content-type':'application/json',...(session?{cookie:'plg_session='+session}:{})},body:JSON.stringify({purpose})});return {response,cookie:response.headers.get('set-cookie')?.split(';')[0]??'',url:response.ok?new URL((await response.json()).url):null};};
 return {request,start,transactions,sessions,family,age,resolved,resolutionFailure,calls:()=>({exchanges,resolutions}),grants:()=>grants};
}
test('Google uses fixed callback, PKCE and single-use HttpOnly state, then issues opaque session',async()=>{
 const f=fixture(),s=await f.start();assert.equal(s.response.status,200);assert.equal(s.url!.searchParams.get('redirect_uri'),'http://localhost:5173/api/v1/auth/google/callback');assert.equal(s.url!.searchParams.get('code_challenge_method'),'S256');assert.match(s.response.headers.get('set-cookie')!,/HttpOnly/);assert.equal(s.url!.searchParams.has('client_secret'),false);
 const path='/api/v1/auth/google/callback?state='+s.url!.searchParams.get('state')+'&code=opaque-code';
 const success=await f.request(path,{headers:{cookie:s.cookie}});assert.equal(success.status,303);assert.equal(success.headers.get('location'),'http://localhost:5173/');assert.match(success.headers.get('set-cookie')!,/plg_session=/);assert.equal(f.grants(),0,'Google login cannot unlock an existing family Parent Space');
 const replay=await f.request(path,{headers:{cookie:s.cookie}});assert.match(replay.headers.get('location')!,/google_error=failed/);assert.deepEqual(f.calls(),{exchanges:1,resolutions:1});
});
test('missing cookie, forged or expired state never reaches Google or account resolution',async()=>{
 for(const mode of ['cookie','forged','expired']){const f=fixture(),s=await f.start(),state=s.url!.searchParams.get('state')!;if(mode==='expired')f.transactions.get(hashSessionToken(state))!.expiresAt=new Date(0);
 const response=await f.request('/api/v1/auth/google/callback?code=code&state='+(mode==='forged'?'forged':state),{headers:mode==='cookie'?{}:{cookie:s.cookie}});assert.match(response.headers.get('location')!,/google_error=failed/);assert.deepEqual(f.calls(),{exchanges:0,resolutions:0});}
});
test('denial consumes transaction; client cannot supply redirect or family identity',async()=>{
 const f=fixture(),s=await f.start();const denied=await f.request('/api/v1/auth/google/callback?error=access_denied&state='+s.url!.searchParams.get('state'),{headers:{cookie:s.cookie}});assert.match(denied.headers.get('location')!,/google_error=cancelled/);assert.equal(f.transactions.size,0);
 const bad=await f.request('/api/v1/auth/google/start',{method:'POST',headers:{origin:'http://localhost:5173','content-type':'application/json'},body:JSON.stringify({purpose:'login',familyId:'victim',redirect:'https://evil.example'})});assert.equal(bad.status,422);
});
test('parent callback rejects a rotated or switched session',async()=>{
 const f=fixture();f.family.passwordHash="!google-only";f.sessions.set(hashSessionToken('parent-session'),f.family);const s=await f.start('parent','parent-session');assert.equal(s.response.status,200);
 const response=await f.request('/api/v1/auth/google/callback?code=code&state='+s.url!.searchParams.get('state'),{headers:{cookie:s.cookie+'; plg_session=rotated-session'}});assert.match(response.headers.get('location')!,/google_error=failed/);assert.deepEqual(f.calls(),{exchanges:0,resolutions:0});assert.equal((await f.start('parent')).response.status,401);
});
test('UserInfo must verify email; access tokens never come from browser input',async()=>{
 for(const verified of [true,false]){const requests:{url:string;init?:RequestInit}[]=[];const provider=createGoogleProvider(async(input,init)=>{requests.push({url:String(input),...(init?{init}:{})});return Response.json(requests.length===1?{access_token:'ephemeral',token_type:'Bearer',id_token:'ignored-token'}:{sub:'123',email:'PARENT@EXAMPLE.COM',email_verified:verified,name:'Parent'});});
 if(verified)assert.deepEqual(await provider.exchange('code','verifier',config().google!),{sub:'123',email:'parent@example.com',name:'My family'});else await assert.rejects(()=>provider.exchange('code','verifier',config().google!),/could not be verified/);
 assert.equal(requests[1]!.url,'https://openidconnect.googleapis.com/v1/userinfo');assert.equal((requests[1]!.init!.headers as Record<string,string>).authorization,'Bearer ephemeral');assert.ok(String(requests[0]!.init!.body).includes('code_verifier=verifier'));}
});
test('Google config is optional, complete and production HTTPS with explicit allowlist',()=>{
 const env={DATABASE_URL:'postgresql://test:test@localhost/plg_test',ALLOWED_ORIGINS:'http://localhost:5173',ALLOWED_FORWARDED_HOSTS:'localhost'};
 assert.equal(loadConfig(env).google,undefined);assert.throws(()=>loadConfig({...env,GOOGLE_CLIENT_ID:'one'}),/together/);
 assert.throws(()=>loadConfig({...env,NODE_ENV:'production',GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret',GOOGLE_AUTH_ORIGIN:'http://localhost:5173'}),/HTTPS/);
 assert.throws(()=>loadConfig({...env,GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret',GOOGLE_AUTH_ORIGIN:'https://evil.example'}),/allowed frontend/);
});

test('Google-only family session is restricted to parent setup until a password exists',async()=>{
 const f=fixture();f.family.passwordHash='!google-only';const s=await f.start();
 const response=await f.request('/api/v1/auth/google/callback?state='+s.url!.searchParams.get('state')+'&code=code',{headers:{cookie:s.cookie}});
 const token=response.headers.get('set-cookie')!.match(/(?:^|, )plg_session=([^;]+)/)![1]!;
 const headers={cookie:'plg_session='+token};assert.equal(f.grants(),1);
 assert.equal((await (await f.request('/api/v1/auth/session',{headers})).json()).parentPasswordRequired,true);
 assert.equal((await f.request('/api/v1/profiles',{headers})).status,403);
 assert.equal((await f.request('/api/v1/parent/google',{headers})).status,200);
 assert.equal((await f.request('/api/v1/parent/passkeys',{headers})).status,403);
});

test('parent password setup needs recent Google proof and cannot overwrite an existing password',async()=>{
 const f=fixture();f.family.passwordHash='!google-only';f.sessions.set(hashSessionToken('setup'),f.family);
 const init={method:'POST',headers:{origin:'http://localhost:5173','content-type':'application/json',cookie:'plg_session=setup'},body:JSON.stringify({password:'new-parent-password'})};
 f.age.seconds=901;assert.equal((await f.request('/api/v1/parent/google/password',init)).status,403);assert.equal(f.family.passwordHash,'!google-only');
 f.age.seconds=0;assert.equal((await f.request('/api/v1/parent/google/password',init)).status,200);assert.equal(await verifyPassword(f.family.passwordHash,'new-parent-password'),true);
 const saved=f.family.passwordHash;assert.equal((await f.request('/api/v1/parent/google/password',init)).status,403);assert.equal(f.family.passwordHash,saved);
 assert.equal((await f.start('parent','setup')).response.status,403);
});


test('Google signup validates consent before creating OAuth state and stores only the server version', async () => {
  const f=fixture();
  for (const legal of [{}, {legalVersion:'stale'}, {legalVersion:null}]) {
    const response=await f.request('/api/v1/auth/google/start',{method:'POST',headers:{origin:'http://localhost:5173','content-type':'application/json'},body:JSON.stringify({purpose:'signup',...legal})});
    assert.equal(response.status,400);
    assert.ok(['CONSENT_REQUIRED','LEGAL_VERSION_MISMATCH'].includes((await response.json()).error.code));
    assert.equal(f.transactions.size,0);
    assert.equal(response.headers.get('set-cookie'),null);
  }
  const response=await f.request('/api/v1/auth/google/start',{method:'POST',headers:{origin:'http://localhost:5173','content-type':'application/json'},body:JSON.stringify({purpose:'signup',legalVersion:LEGAL_VERSION})});
  assert.equal(response.status,200);
  const url=new URL((await response.json()).url);
  assert.equal(url.searchParams.has('legalVersion'),false);
  const transaction=f.transactions.get(hashSessionToken(url.searchParams.get('state')!));
  assert.equal(transaction?.purpose,'signup');
  assert.equal(transaction?.legalVersion,LEGAL_VERSION);
  const callback=await f.request('/api/v1/auth/google/callback?code=code&state='+url.searchParams.get('state'),{headers:{cookie:response.headers.get('set-cookie')!.split(';')[0]!}});
  assert.equal(callback.headers.get('location'),'http://localhost:5173/');
  assert.deepEqual(f.resolved,[{allowRegistration:true,legalVersion:LEGAL_VERSION}]);
});

test('plain Google login never authorizes registration; consent failures redirect safely without a session',async()=>{
  const f=fixture();
  f.resolutionFailure.code='CONSENT_REQUIRED';
  const s=await f.start();
  const callback=await f.request('/api/v1/auth/google/callback?code=code&state='+s.url!.searchParams.get('state')+'&legalVersion='+LEGAL_VERSION,{headers:{cookie:s.cookie}});
  assert.deepEqual(f.resolved,[{allowRegistration:false,legalVersion:null}]);
  assert.equal(callback.headers.get('location'),'http://localhost:5173/register?google_error=consent_required');
  assert.equal(f.sessions.size,0);
});

test('callback uses server state rather than query claims and handles a version changed during OAuth',async()=>{
  const f=fixture();
  f.resolutionFailure.code='LEGAL_VERSION_MISMATCH';
  const response=await f.request('/api/v1/auth/google/start',{method:'POST',headers:{origin:'http://localhost:5173','content-type':'application/json'},body:JSON.stringify({purpose:'signup',legalVersion:LEGAL_VERSION})});
  const url=new URL((await response.json()).url),state=url.searchParams.get('state')!;
  const transaction=f.transactions.get(hashSessionToken(state))!;
  transaction.legalVersion='older-version';
  const callback=await f.request('/api/v1/auth/google/callback?code=code&state='+state+'&legalVersion='+LEGAL_VERSION,{headers:{cookie:response.headers.get('set-cookie')!.split(';')[0]!}});
  assert.deepEqual(f.resolved,[{allowRegistration:true,legalVersion:'older-version'}]);
  assert.equal(callback.headers.get('location'),'http://localhost:5173/register?google_error=legal_version_mismatch');
  assert.equal(f.sessions.size,0);
});
