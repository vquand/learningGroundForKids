# Google Authentication UI

Follow frontend/AGENTS.md and src/i18n/AGENTS.md. Number clarification questions.

- Offer Google on the logged-out family landing/signup screens and Parent Space
  initial password setup. Google button availability comes from the same-origin API.
  Preserve password/passkey fallbacks when the provider is unavailable.
- Start with POST to the API and navigate only to Google's fixed authorization
  endpoint. Never collect or store provider tokens, subject IDs or secrets in
  browser state/storage. Server callback creates the ordinary family session.
- The provider button uses Google's standard multicolor G mark and approved
  Continue with Google copy, not generated animal-style branding.
- Google-only parents must set a parent password before child play after recent Google
  verification. Existing password accounts must not expose a password-reset
  shortcut. Existing Parent Space still requires a password/passkey. Setup
  callbacks use server session binding, not client family IDs.
- Translate UI copy with shared locale hooks. Provider chooser/account language
  belongs to Google, separate from game learning languages.
- Browser UAT: tests/browser/google-auth.test.ts (mocked handoff); real Google
  account login and callback remain an explicit user UAT step.
