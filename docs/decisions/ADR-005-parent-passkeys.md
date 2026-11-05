# ADR-005: Optional passkeys and server-enforced parent access

## Status

Accepted for local implementation on 2026-10-07. Release/UAT approval remains
pending. This supplements ADR-002 and ADR-003; it does not enable cloud changes.

## Context

Parents share a family session with children. The former browser math quiz and
sessionStorage unlock deterred accidental clicks but could not authorize parent
API operations. The user selected passwords as the default, optional passkey
enrollment, passkey-first sign-in after enrollment, and a password fallback link.

## Decision

- Keep opaque HttpOnly family session cookies and Argon2id passwords.
- Require a server-owned, session-bound parent capability lasting one day
  for parent routes. Password verification or a user-verified enrolled passkey
  grants the capability. Family, root, and administrative accounts may use these parent routes for
  their own family after the same parent confirmation. Parent access remains
  bound to the authenticated family and session; it does not alter the account
  role or administrative authorization rules.
- Use SimpleWebAuthn 14 for WebAuthn ceremonies. Require user verification and
  discoverable credentials; verify RP ID, origin, challenge, and credential
  ownership server-side. Private keys remain with the authenticator.
- Store public credentials and hashed, five-minute single-use challenge tokens
  in PostgreSQL. Bind enrollment and parent challenges to the active session.
- Serialize reset, revoke, enrollment, and final login/elevation checks on the
  family row. Recheck credential counters and live session authority inside the
  final transaction, preventing an in-flight ceremony from restoring revoked
  access after a reset.
- Require password-confirmed parent access to enroll or remove passkeys. Enforce
  the ten-key cap under the same family lock. An administrator password reset
  revokes family sessions, passkeys, and family-bound pending challenges.
- Passkey sign-in accepts active family and administrator accounts, including
  root. Enrollment and sign-in use the account's existing server-stored role;
  a passkey does not grant a role or bypass administrative authorization. The
  final transaction rechecks active status and credential ownership under the
  account lock before creating the session.
- Account sign-in never grants Parent Space access. Kids can select their
  profiles and play after account sign-in; editing parent-owned learning items
  requires a separate passkey or family-password verification. The 24-hour
  expiry starts with that verification and status reads do not extend it.
- The Parent Space dashboard includes **Lock parent space**. Its authenticated
  endpoint rotates the current session in a transaction, preserving the account
  and original account-session expiry while removing parent access. Pending
  enrollment and parent challenges bound to the old session are deleted; an
  already-consumed ceremony cannot elevate that revoked session. Other tabs
  recheck server status when notified or brought into focus.
- Password confirmation for adding/removing passkeys remains valid for only
  15 minutes. Its timestamp is derived from the fixed 24-hour password unlock
  expiry, so extending the Parent Space unlock does not extend this sensitive
  operation window. No schema change is required.
- A nonsecret browser preference selects passkey-first presentation after local
  enrollment/login. Conditional passkey autofill supports synced credentials on
  other devices. These hints grant no authority. Always offer password fallback.
- Layer shared client and account/family attempt limits; never trust a browser
  role, owner ID, or claimed authentication result.

## Configuration and local verification

Nonproduction defaults use RP ID `localhost` and origin
`http://localhost:5173`. Access the local frontend through that origin, even
though its listener binds `127.0.0.1`.

Production passkeys are disabled until `WEB_AUTHN_RP_ID` and `WEB_AUTHN_ORIGIN`
are explicitly configured in platform runtime settings. Use the stable frontend
domain: a passkey is scoped to its RP and cannot be moved to an unrelated domain.
Apply migration `0015_passkeys` before running this code against a database.
Only the guarded local databases were authorized for migration in this task.

## Alternatives

The browser math gate cannot enforce permissions and was replaced. Authenticator
codes were discussed but not selected; they would require secret enrollment,
replay protection, recovery, and account identification. Password-only parent
confirmation remains supported as the fallback. A third-party identity service
would change the account/session model and was unnecessary for this request.

## Consequences

Parent operations now require real server authorization and periodically ask
for confirmation again. Reset recovery removes old passkeys, so administrators
see that consequence before saving. Virtual browser authenticators can exercise
the protocol in automated tests; physical device UX remains part of device UAT.

Implementation follows the official [SimpleWebAuthn server](https://simplewebauthn.dev/docs/packages/server)
and [browser](https://simplewebauthn.dev/docs/packages/browser) APIs.
