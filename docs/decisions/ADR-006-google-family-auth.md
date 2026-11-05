# ADR-006: Server-owned Google family authentication

Status: Accepted for implementation; production rollout awaits UAT.

Google authorization-code login supplements the password/passkey architecture
in ADR-002 and ADR-005. It does not replace existing credentials or create a
second family when the verified normalized email matches an existing family.
This email-linking policy was explicitly requested by the user.

Render exchanges codes with PKCE and fetches identity from Google's HTTPS
UserInfo endpoint. Browser-provided identity and decoded unverified JWT claims
are never used. A 10-minute, single-use DB transaction and HttpOnly cookie bind
state to the browser; parent re-verification additionally binds family/session.
Only fixed configured frontend URLs are used for callbacks and final redirects.
No access or refresh tokens are retained. Stable Google subjects are stored in
one-to-one family links. Both new-family signup and auto-linking happen in a
transaction with concurrency guards; new signup obeys ALLOW_REGISTRATION.

Google may reuse a cached account on a shared device, so family login does not
unlock Parent Space for password-enabled families. Existing parent password or
passkey verification remains mandatory. New Google-only families receive a
restricted setup capability and must create a parent password before child play.
The capability allows only initial password setup and access checks, with fresh
Google verification and a compare-and-set preventing existing password overwrite.
All ordinary parent-management and child-play API routes are blocked during
setup. Once set, the parent password/passkey protects Parent Space while Google
remains available for family sign-in. Root/admin authentication is excluded from
Google family login. Disabled families remain disabled.

Google is optional runtime configuration. Clients read only availability;
secrets and provider tokens remain on Render. Separate Google console clients
are required for local and production setups. Migration 0021 adds only linked
identities and pending authentication transactions. All existing family and
progress data contracts are preserved.
