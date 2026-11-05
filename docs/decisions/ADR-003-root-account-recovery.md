# ADR-003: Reserved root identity with operator-managed recovery

## Status

Accepted for implementation from the user's 2026-09-27 request. Extends ADR-002;
does not change the Vercel/Render/Neon architecture.

## Context

An empty deployment needs an initial administrator. The owner requested a root
account with a randomly generated normal password, an independent Render
fallback password accepted at login, and a fallback-authorized password dialog.

## Decision

Reserve the server-owned ID `root` and email `root@system.local` with the existing
`admin` role. Require all three identifiers plus an active account for recovery
privileges. Registration cannot claim the email. An explicit idempotent
data-migration command inserts root only if absent; it never promotes, resets,
or reactivates existing rows. Save the generated password exclusively to a
private operator file outside the checkout before inserting its Argon2id hash.

Keep the recovery password in Render's secret runtime configuration, disabled
when unset. Compare fixed-size digests in constant time, and apply normal login
hash verification and bounded authentication quotas. The browser password API
requires a root session, matching new passwords, and the exact recovery secret.
Update the normal hash and revoke all sessions atomically, serialized with
session issuance on the family row. The UI receives only an `isRoot` capability
flag, not the secret or password hash.

## Alternatives considered

- Apply fallback to all admins: rejected because one secret would impersonate
  unrelated admin accounts and needlessly widen recovery access.
- Promote an existing email or reset its password on deploy: rejected because
  reruns could elevate families or overwrite an owner's credentials.
- Hardcode a fallback or print generated passwords to build logs: rejected
  because repositories, deployment logs, and browser bundles are not secret stores.
- Automatic initialization in API startup: rejected because feature-branch
  deployments must not mutate hosted accounts or run data migrations implicitly.

## Consequences

The fallback is a standing root credential, not a second factor. Compromise
grants root access; operators must protect and rotate it independently. Browser
password changes never rotate the recovery secret. Initialization and secret
configuration require deliberate operator steps. No schema migration is needed,
and rollback leaves a conventional email/password admin. Current in-process
quotas assume one API instance; scaling requires shared quotas.

See [operator and API instructions](../api/root-account.md).
