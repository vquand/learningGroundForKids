# Spec: Admin-set family password

## Objective

An authenticated administrator can set an ongoing password for a normal family
from its Admin Family Detail page, without knowing the old password. The new
password remains valid until the family or an administrator changes it again.
This operation does not use a temporary password or a forced-change flow.

## Contract and success criteria

- The Family Detail page has a **Set password** button for a normal family.
  It opens a dialog naming the target and requiring a new password, matching
  confirmation, and a short support reason. The UI warns that all of the
  family's current sessions will end. It never displays the saved password.
- `PUT /api/v1/admin/families/:familyId/password` accepts exactly
  `{ "new_password": string, "reason": string }` and returns `204 No Content`.
  Password length is 12–256 characters; reason is trimmed and bounded.
- The endpoint requires an authenticated admin. It rejects normal-family
  callers, unknown IDs, the reserved root account, and all admin-account
  targets. The target ID is taken from the path, never from the request body.
- The server hashes the password with the existing Argon2id helper and, in one
  database transaction under a family-row lock, replaces the hash, revokes all
  target sessions, updates `updated_at`, and records a durable audit event with
  actor ID, target ID, reason, and timestamp. No password, hash, session token,
  or cookie is recorded in that event or returned by the API.
- Login/session issuance uses the same family-row lock, so a concurrent login
  using the old password cannot leave a surviving session after the change.
  Existing sessions fail immediately; a new login with the new password works.
- Authentication errors use the existing structured API error format. The
  password-setting route is rate-limited. The button disables while saving,
  shows safe errors, clears password fields on close/success, and announces
  success without echoing the password.

## Tech stack, structure, and style

React/Vite and TypeScript UI in `frontend/src/pages/admin`, its same-origin
client in `frontend/src/api/admin.ts`, Hono API and Zod boundary validation in
`server/src`, Drizzle/PostgreSQL repository and migration in `server/src/db`
and `server/drizzle`. Tests live in `frontend/tests` and `server/tests`.
Follow existing snake_case JSON fields, `AppError`/`error()` responses, and
short typed repository methods; for example:

```ts
return coreRequest<void>(`/api/v1/admin/families/${encodeURIComponent(familyId)}/password`, {
  method: "PUT",
  body: JSON.stringify({ new_password: password, reason }),
});
```

## Commands and testing strategy

- Focused API and repository tests: `npm test --prefix server`.
- Frontend API and component tests: `npm test --prefix frontend`.
- Typechecks: `npm run typecheck --prefix server` and
  `npm run typecheck:hosting --prefix frontend`.
- Builds: `npm run build --prefix server`,
  `npm run build --prefix frontend -- --mode vercel`, and
  `npm run build --prefix frontend`.
- Local browser UAT: open a normal family's detail page, inspect the dialog,
  submit against the isolated local API/database, and verify prior sessions are
  invalid and new credentials work. Never test this mutation against production.

Tests first cover anonymous/family/admin authorization, root/admin targets,
invalid/extra input, rate limits, hashed storage, session revocation, audit
redaction, and the concurrent-login boundary. Frontend tests cover request
shape, dialog validation, pending/error/success states, and non-disclosure.

## Boundaries

- Always: same-origin authenticated API calls, server-side validation, hash
  before storage, transactionally revoke sessions and audit, no plaintext
  password persistence or logging.
- Ask first: target policy beyond normal families, password-policy changes,
  new privileges, or production database migration/deployment.
- Never: change a password merely by visiting the page, expose existing
  hashes, accept client-provided actor identity/role, or run migrations against
  production during UAT.

## Implementation slices

1. API contract/tests, database method, and audited mutation; verify server
   tests/typecheck/build against the guarded local database.
2. Same-origin client and accessible Family Detail dialog; verify frontend
   tests/typecheck/build.
3. Local browser UAT, security/error checks, and consistency update to the
   broader admin-operations draft.

## Open questions

None for this scoped operation, provided the target/authorization and audit
assumptions above are accepted.
