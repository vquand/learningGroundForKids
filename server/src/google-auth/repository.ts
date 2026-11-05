import { LEGAL_VERSION, requireLegalVersion } from '../legal.js';
import { randomUUID } from 'node:crypto';
import { and, eq, gt, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { families, googleAuthTransactions, googleIdentities } from '../db/schema.js';
import { ROOT_ACCOUNT_EMAIL } from '../root-account.js';
import { AppError } from '../errors.js';
import type { GoogleAuthRepository } from './contracts.js';
export const GOOGLE_ONLY_PASSWORD = '!google-only';
export function createGoogleAuthRepository(db: NodePgDatabase): GoogleAuthRepository {
  return {
    async createTransaction(input) {
      await db.delete(googleAuthTransactions).where(lte(googleAuthTransactions.expiresAt,new Date()));
      await db.insert(googleAuthTransactions).values(input);
    },
    async consumeTransaction(tokenHash, now) {
      const [row] = await db.delete(googleAuthTransactions).where(and(eq(googleAuthTransactions.tokenHash,tokenHash),gt(googleAuthTransactions.expiresAt,now))).returning();
      if (!row || (row.purpose!=='login' && row.purpose!=='parent' && row.purpose!=='signup')) return null;
      return {...row,purpose:row.purpose};
    },
    async resolveIdentity(identity, allowRegistration, legalVersion) {
      return db.transaction(async tx=>{
        const email=identity.email.toLowerCase().trim();
        if (email===ROOT_ACCOUNT_EMAIL) throw new AppError(403,'GOOGLE_ACCOUNT_UNAVAILABLE','Use the existing sign-in method for this account.');
        // Serialize different subjects using the same family email, then the stable subject.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`google-email:${email}`},0))`);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`google-sub:${identity.sub}`},0))`);
        const [link]=await tx.select().from(googleIdentities).where(eq(googleIdentities.subject,identity.sub));
        let [owner]=await tx.select().from(families).where(link ? eq(families.id,link.familyId) : eq(families.email,email)).for('update');
        if (owner && (!owner.isActive || owner.role!=='family' || owner.email===ROOT_ACCOUNT_EMAIL)) throw new AppError(403,'GOOGLE_ACCOUNT_UNAVAILABLE','This account cannot use Google family sign-in.');
        if (!owner) {
          if (link) throw new AppError(403,'GOOGLE_ACCOUNT_UNAVAILABLE','This account is unavailable.');
          // Only server OAuth state from signup can authorize a new account.
          // Existing owners above retain their original (possibly NULL) consent.
          if (!legalVersion) throw new AppError(400,'CONSENT_REQUIRED','Accept the legal text before creating an account.');
          requireLegalVersion(legalVersion);
          if (!allowRegistration) throw new AppError(403,'REGISTRATION_DISABLED','New family registration is currently closed.');
          // Password registration can race outside the Google advisory lock: preserve its owner.
          [owner]=await tx.insert(families).values({id:randomUUID(),email,displayName:identity.name,passwordHash:GOOGLE_ONLY_PASSWORD,role:'family',onboardingDismissed:false,legalAcceptedAt:new Date(),legalAcceptedVersion:LEGAL_VERSION}).onConflictDoNothing({target:families.email}).returning();
          if (!owner) [owner]=await tx.select().from(families).where(eq(families.email,email)).for('update');
          if (!owner || !owner.isActive || owner.role!=='family') throw new AppError(403,'GOOGLE_ACCOUNT_UNAVAILABLE','This account is unavailable.');
        }
        if (!link) {
          const [other]=await tx.select().from(googleIdentities).where(eq(googleIdentities.familyId,owner.id));
          if (other && other.subject!==identity.sub) throw new AppError(409,'GOOGLE_LINK_CONFLICT','This family already uses a different Google account.');
          await tx.insert(googleIdentities).values({subject:identity.sub,familyId:owner.id});
        }
        return {legalAcceptedAt:owner.legalAcceptedAt,legalAcceptedVersion:owner.legalAcceptedVersion,id:owner.id,email:owner.email,displayName:owner.displayName,passwordHash:owner.passwordHash,role:owner.role,isActive:owner.isActive};
      });
    },
  };
}
