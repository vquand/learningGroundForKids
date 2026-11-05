# Root account initialization and recovery

Root is a reserved administrator: ID `root`, email `root@system.local`, name
`Root`. It is separate from existing bootstrap admins. No existing family is
promoted, and public registration cannot claim the reserved email.

## Operator setup

1. In Render's **secret runtime environment settings**, set
   `ROOT_FALLBACK_PASSWORD` to a unique random password of 20–256 characters.
   Keep it in a password manager. Never use a frontend/Vercel variable, commit
   it, paste it into chat, or reuse the normal root password. The blueprint
   declares this key with `sync: false`; it contains no default credential.
   Restart/redeploy the API after changing the runtime secret.
2. After the existing schema migrations, run the idempotent data-migration
   command below from a trusted operator machine with
   `DATABASE_URL_UNPOOLED` supplied privately in the environment. Test against
   an isolated/staging database first. Hosted/production initialization remains
   a separate operator-approved operation; never add it to a build/start hook.
3. Use an unused absolute file path in a private directory **outside the
   checkout**. The directory must already exist. The file is created with mode
   `0600`; existing files and symlinks are not overwritten.

```bash
ROOT_PASSWORD_FILE=/absolute/private-directory/plg-root-initial-password.txt \
  npm run db:init-root --prefix server
```

For the guarded local database configured in `server/.env_dev`, use
`db:init-root:local` instead. The command requires the direct, unpooled database
connection, closes it on completion, and never prints credentials to logs.

On first creation, the file contains a cryptographically random 256-bit
password (43 base64url characters). The database stores only its Argon2id hash.
Copy the password into your password manager privately and securely remove the
file afterward. Rerunning for an existing active root does not generate a file,
change its password, or modify any existing admin/family. Conflicts or an
inactive root fail closed; this command does not reactivate accounts.

If concurrent initializers or a database error occur after a file was saved,
that file may hold an **unused candidate**, not the winning account password.
Verify login before retaining it. Recover using the independently configured
fallback password if a root row exists. If the insert failed and no root exists,
fallback login cannot create it: rerun `db:init-root` with a **new, unused**
`ROOT_PASSWORD_FILE` path after fixing the database failure. The earlier file
must not be overwritten or assumed to be valid. After a successful retry and
verified login, securely discard unused candidate files. A file-write failure
never creates an account.

## Signing in and changing the password

Open `/admin`, enter `root` in **Email or root**, and use either the generated
normal password or the fallback password. The reserved email also works in
either login form. Other admins and families cannot use the root fallback.
Without `ROOT_FALLBACK_PASSWORD`, normal root login still works, but fallback
login and browser password updates are disabled.

While signed in as root, **Update root password** appears in a screen corner.
The dialog requires:

1. New password (12–256 characters).
2. Retyped new password (exact match).
3. Root fallback password (exact match; whitespace is not trimmed).

The new password must differ from the fallback. A successful update changes
only the normal password, revokes **every** root session, and requires signing
in again. The fallback remains usable and is rotated only through Render's
secret settings. If it is compromised, also change the normal password using
the newly configured fallback to revoke existing sessions.

## API and security contract

- Login keeps `{ "email": string, "password": string }`; `email` additionally
  accepts the `root` alias, case-insensitively. Normal email logins are unchanged.
- Session/login responses add `user.isRoot: true` only for the server-verified
  reserved root. Other session response fields remain unchanged. UI visibility
  is not authorization; the backend independently rechecks root identity.
- `PATCH /api/v1/admin/root/password` accepts exactly
  `{ "newPassword": string, "confirmPassword": string, "fallbackPassword": string }`.
  It requires the root HttpOnly session cookie and returns `204` with an expired
  cookie after an atomic password update/session revocation.
- Errors use the existing envelope: `401` signed out, `403` non-root or incorrect
  fallback, `422` invalid/mismatched/equal-to-fallback passwords, `409` stale
  password/session, `429` authentication quota exceeded with `Retry-After`.
- Origin/host allowlists, bounded JSON bodies, private `no-store` responses,
  per-client quotas, and an authenticated account-wide root update quota apply.
  Root login has no unauthenticated global lockout, so failed attempts from
  other clients cannot disable both legitimate root credentials.
  Account-wide quotas are in-process, matching the current single-instance
  service; a scaled/multi-instance service needs shared quota storage.
- Session issuance and password changes lock the same family row. An old hash
  or revoked session cannot race a password change to mint a surviving session.
- Fallback plaintext exists only in backend runtime configuration and transient
  request/form memory; it is never returned, logged, stored in the database, or
  persisted in browser storage.

## Rollback

Revert the application change and unset the Render recovery secret. No schema
changes were introduced; the generated root remains an ordinary `admin` row
usable by its email/normal password. Do not delete it or rotate its password as
part of an automatic rollback.

## Verification evidence (2026-09-27)

- Server: 161 tests passed, none skipped, against disposable local PostgreSQL.
  This includes the actual initialization CLI, exclusive private credential
  output, rerun idempotence, reserved-identity conflicts, concurrent creation,
  concurrent rotation/login, both login credentials, authorization/validation,
  session revocation, and successful new-password/fallback login after rotation.
- Frontend: 109 unit/API tests, 12 new root browser tests, and 18 existing
  completion browser regressions passed. Tests cover exact password transport,
  root-only visibility, real application route navigation, dialog keyboard and
  focus behavior, 320–1440px layout, errors/retries, duplicate submission, and
  stale responses/unmount/session replacement.
- Both frontend typechecks, server typecheck/build, Vercel build, and transitional
  compatibility build passed. Existing deprecation/large-chunk warnings remain.
- Both runtime dependency audits reported zero vulnerabilities. Independent
  backend/frontend review found no remaining required changes.
- The local full-stack browser verified fallback login, admin access, the corner
  button, the three-field modal, cancel/focus restoration, and a clean console.
  No interactive production password changes or cloud account writes occurred.
- Temporary API/Vite processes and the disposable PostgreSQL container were
  removed afterward. Hosted databases and deployment configuration were untouched.
