# Google Family Authentication

Follow the repository and frontend API security contracts. Number clarification
questions. Never commit credentials or run migrations against production.

- Google identity is obtained on Render from authorization-code exchange and
  Google UserInfo over HTTPS. Never accept browser-provided emails, tokens,
  subject IDs, role, family IDs, or completion claims as identity.
- Use a short-lived, single-use DB transaction and HttpOnly browser cookie for
  OAuth state, with PKCE. Expiry, cookie binding and session binding must be
  validated before exchanging a code. No refresh/access tokens are retained.
- User-approved policy: verified normalized Google email links to an existing
  ordinary active family, retaining passwords, profiles and progress. Persist
  Google's stable subject as the subsequent identity key. Never merge two
  different families or reassign an existing Google subject. Root/admin and
  disabled identities cannot use this family login flow.
- New families obey ALLOW_REGISTRATION. Google-only families have no working
  password until a parent optionally sets one after recent Google verification.
  Before child play, Google-only families must set a parent password. Google
  capabilities are restricted to this initial setup; existing families unlock
  Parent Space with a password/passkey, never cached Google SSO.
- Redirect only to fixed local routes on GOOGLE_AUTH_ORIGIN. Validate config
  against allowed origins/hosts; no URL or host supplied by a browser may pick
  the callback. State/code/secret must never be logged.
- Keep providers optional. Existing password/passkey login must continue to
  work with Google disabled. Tests mock external exchange; live Google UAT
  requires manually configured keys and the reviewed SQL migration.
