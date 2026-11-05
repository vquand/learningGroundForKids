import type { FamilyRecord } from '../contracts/db.js';
export interface GoogleIdentity { sub: string; email: string; name: string }
export interface GoogleTransaction {
  tokenHash: string; verifier: string; purpose: 'login' | 'parent' | 'signup';
  legalVersion?: string | null;
  familyId: string | null; sessionHash: string | null; expiresAt: Date;
}
export interface GoogleAuthRepository {
  createTransaction(input: GoogleTransaction): Promise<void>;
  consumeTransaction(tokenHash: string, now: Date): Promise<GoogleTransaction | null>;
  resolveIdentity(identity: GoogleIdentity, allowRegistration: boolean, legalVersion?: string | null): Promise<FamilyRecord>;
}
