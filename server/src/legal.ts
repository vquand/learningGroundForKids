import { AppError } from './errors.js';

// The server is the sole authority for the version accepted at account creation.
export const LEGAL_VERSION = '2026-11-04-draft';

export function requireLegalVersion(value: unknown): string {
  if (typeof value !== 'string' || !value) {
    throw new AppError(400, 'CONSENT_REQUIRED', 'Please read and accept the Privacy Policy and Terms of Use.');
  }
  if (value !== LEGAL_VERSION) {
    throw new AppError(400, 'LEGAL_VERSION_MISMATCH', 'Our legal text has changed. Please reload the page and read the updated text.');
  }
  return LEGAL_VERSION;
}
