import { z } from 'zod';
import { AppError } from '../errors.js';
import type { AppConfig } from '../config.js';
import type { GoogleIdentity } from './contracts.js';
export interface GoogleProvider { exchange(code: string, verifier: string, config: NonNullable<AppConfig['google']>): Promise<GoogleIdentity> }
const identitySchema = z.object({sub:z.string().min(1).max(255),email:z.string().email().max(254),email_verified:z.literal(true)});
/** Token exchange and UserInfo are server-only. The ID token is not decoded or trusted. */
export function createGoogleProvider(fetcher: typeof fetch = fetch): GoogleProvider {
  return { async exchange(code, verifier, config) {
    try {
      const tokenResponse = await fetcher('https://oauth2.googleapis.com/token', {
        method:'POST',redirect:'error',signal:AbortSignal.timeout(10_000),
        headers:{'content-type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({code,client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:config.origin+'/api/v1/auth/google/callback',grant_type:'authorization_code',code_verifier:verifier}),
      });
      if (!tokenResponse.ok) throw new Error('exchange failed');
      const tokens = z.object({access_token:z.string().min(1).max(8192),token_type:z.string().refine(type=>type.toLowerCase()==='bearer')}).parse(await tokenResponse.json());
      const userResponse = await fetcher('https://openidconnect.googleapis.com/v1/userinfo', {
        redirect:'error',signal:AbortSignal.timeout(10_000),headers:{authorization:`Bearer ${tokens.access_token}`},
      });
      if (!userResponse.ok) throw new Error('userinfo failed');
      const user = identitySchema.parse(await userResponse.json());
      // Only the email and Google's opaque account id are requested and kept; no name or photo.
      return {sub:user.sub,email:user.email.trim().toLowerCase(),name:'My family'};
    } catch { throw new AppError(401,'GOOGLE_FAILED','Google sign-in could not be verified. Please try again.'); }
  }};
}
