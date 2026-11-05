# Google family sign-in setup and UAT

The feature branch is `feature/google-family-auth`. Google login is an
alternative to password/passkey login. A server-verified Google email matching
an existing ordinary active family links to that same family without replacing
its name, password, children, lessons, badges or game progress. Later logins use
Google's stable subject. Root/admin and disabled accounts cannot use this flow.

## Google console

Use a **Web application** OAuth client. Use separate clients for local and
production environments. Leave the AI-powered agent checkbox unchecked.

| Environment | Authorized JavaScript origin | Authorized redirect URI |
| --- | --- | --- |
| Local | `http://localhost:5173` | `http://localhost:5173/api/v1/auth/google/callback` |
| Production | `https://your-app.vercel.app` | `https://your-app.vercel.app/api/v1/auth/google/callback` |

Configure Google Auth Platform branding (Playing Ground name, support email,
contact email), audience, and basic profile/email data access. The app requests
only `openid email profile`. If the client is in Testing, add the parent Google
accounts used for UAT as test users. Use External audience for general family
accounts, and publish the consent app when ready for production. Follow the
console's current domain/branding requirements. Google settings can take time
to propagate. Redirect URIs must match exactly; JavaScript origins have no path.

Google documentation:
- [Web server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)
- [OpenID Connect/UserInfo](https://developers.google.com/identity/openid-connect/openid-connect)

## Runtime environment

The supplied local credential download was read into ignored `server/.env_dev`.
The credential JSON is also ignored by git. No credentials appear in this guide
or the checked-in environment example. Inspect the local environment file
privately; never commit it or paste its secret into a frontend variable.

Set these on **Render's API service** for production, using the production
client's credentials:

```dotenv
GOOGLE_CLIENT_ID=your-production-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-production-client-secret
GOOGLE_AUTH_ORIGIN=https://your-app.vercel.app
```

Retain the existing origin/host allowlists and Vercel API rewrite. The Google
origin must appear in `ALLOWED_ORIGINS`, and its hostname must appear in
`ALLOWED_FORWARDED_HOSTS`. Callback traffic goes through the frontend's `/api`
rewrite, not directly to Render. No Google secret or token goes into `VITE_*`
or Vercel frontend build configuration.

`ALLOW_REGISTRATION=true` permits new families through either password or Google
registration. When false, existing families can still use Google. Local
registration is enabled for this UAT; production remains unchanged. With all
three Google settings unset, the Google button is hidden and existing sign-in
methods continue working. Partial or unsafe configuration fails startup.

## Migration

Apply checked-in `server/drizzle/0021_google_family_auth.sql` using the normal
migration process, or paste `docs/migrations/neon-0021-google-family-auth.sql`
into Neon SQL console once the feature is ready for production. The console
script records the exact checked-in migration hash/time and safely skips a
repeat run. Existing migrations through 0020 are prerequisites.

It adds `google_identities` and `google_auth_transactions`. No existing family
rows need conversion. The migration has already been applied to the guarded
local `plg_dev` database. Test migrations run only in isolated `plg_test`.
No production migration or cloud configuration was executed by the agent.

## Local UAT

Open **http://localhost:5173/** in a logged-out browser or private window.
Use `localhost`, not `127.0.0.1`, so the OAuth transaction cookie and callback
share the registered hostname. The local dev API uses port 10000.

1. Click **Continue with Google** and complete the real Google account chooser.
   An existing matching family should return with its original children and
   progress. Password login must still work after signing out.
2. A new parent Google account should create one family. Sign out/in again and
   check that the same family is used, not a duplicate.
3. Enter Parent Space with the parent password or passkey, lock it, and verify
   that Google family sign-in does not bypass this separate parent verification.
4. A new Google-only family must set its parent password during initial setup,
   within 15 minutes of Google verification, before child play. Then test
   password sign-in and passkey enrollment. Existing password families do not
   get a password-reset shortcut. Google remains their normal login option.
5. Cancel Google's chooser and verify the friendly error and usable password
   login. Check English/Vietnamese labels and laptop/iPad layouts.

Automated provider tests mock Google's responses; they do not log into a real
Google account. Database tests cover preserved account/password, stable subjects,
registration closure, blocked accounts, concurrent signup and single-use state.
Browser tests cover the public button, signup page, localization, disabled
provider fallback and redirected handoff at representative tablet/laptop sizes.

Tokens are used transiently on Render for code exchange and UserInfo; they are
not stored or returned to the browser. Only the ordinary opaque session cookie
and short-lived HttpOnly state cookie are issued. Initial setup callbacks bind
to the initiating family/session; locking or switching invalidates that flow.
Google login grants no Parent Space access for password-enabled families: Google
may reuse a cached account on a shared tablet. Google-only setup capabilities
allow only access checks and initial password creation; all child-play and
ordinary parent-management APIs are blocked until setup is complete.
