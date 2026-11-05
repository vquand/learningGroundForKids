# UI/UX improvements — 2026-10-17

Branch: `feature/uiux-improvements`. User-authorized scope: Explore, cabbage
rolls, new-family onboarding, shared navigation, and the Playground on phones.
No release, commit, push or production changes until the user says `confirmed`.

## Behavior

- Selected Explore categories expand in place to icon + localized label. Multiple
  selections remain possible; removing one collapses only that filter. No tooltip
  or hover is required. Timeline sits below the return navigation. Phone action
  buttons form a compact two-column dock; short screens keep zoom controls away
  from filters. All actions retain at least 44px touch targets.
- Phone Playground cards place artwork beside their title/description. iPad card
  sizing is unchanged. The phone profile-picker heading reserves the language slot.
  Profile-picker actions New Explorer and Connect with a Friend share the final
  row after all profiles. The friend action has a visible label instead of the
  standalone + beside Latest Adventures. New Explorer stays visible but disabled
  at the existing five-profile limit; Connect with a Friend remains available.
- Cabbage chopping targets the illustrated wooden knife handle. A dashed outline,
  pointing-hand cue and instruction explain where to tap. The blade/timing stripes
  remain inert. Native keyboard activation uses the same action. Existing timing,
  ordered stripes, pauses, retries, grading and server progress are preserved.
  Retry appears in the instruction panel. Phone portrait stacks scene and controls;
  short phone landscape keeps a compact two-column layout.
- Newly created ordinary families see a nonblocking checklist on the profile
  picker and Parent Space dashboard: create kid profiles, add child friends,
  visit Parent Space. On the profile picker, Add Child and Add friends open the
  existing profile and friend-request dialogs directly. Parent Space keeps its
  existing passkey setup under Settings. Skip and Finish setup persist
  for the family across sessions/devices. Existing families and admins do not
  receive the new-family banner. Password, Google and admin-created families opt
  in at creation. Google families finish the existing parent-password setup first.

## Data and security

Migration `server/drizzle/0023_family_onboarding.sql` adds two boolean fields.
Historical families default to dismissed. New ordinary-family creation explicitly
opts in; parent visits and dismissal update independent columns so concurrent
requests preserve both. The rollback is in `server/drizzle/rollbacks/`.

The session returns an optional boolean tutorial hint. Authenticated same-origin
`GET /api/v1/family/onboarding` derives child and outgoing friend-request completion from
the session family's database records. Only pending/accepted outgoing requests count;
opening a dialog does not complete the step. The existing passkey status fields
remain available in the response. `POST /api/v1/family/onboarding/dismiss` accepts only an
empty object. `POST /api/v1/parent/onboarding/visit` also requires the existing
server-verified parent capability. Neither accepts family IDs, client completion,
roles or achievement data. UI callbacks/caches are family/session scoped. Tutorial
state never grants access or awards achievements.

Apply the additive migration through the normal reviewed release process before
running the updated API. No production migrations or cloud writes were performed.
Local UAT uses `scripts/start-uat.sh`, which owns local startup/migration readiness.

## Verification

- Frontend unit suite, app/hosting typechecks, Vercel build and compatibility build.
- Server baseline suite, typecheck and build; all 321 tests also passed with a fresh,
  isolated local PostgreSQL database, including migration, Google registration,
  family isolation, concurrent updates, persisted dismissal and session projection.
- Real Chromium: 18 UI/UX checks across 1366×768, 1024×768, 1180×820, 390×844,
  320×667 and 844×390. Covers filter expansion/collapse, multi-select, reactive
  English/Vietnamese labels, control bounds/occlusion, onboarding completion and
  Skip after refresh, slow-network dismissal, failure/retry, profile-heading clearance
  and compact Playground cards. The checklist opens the existing Create Explorer
  and Add friend dialogs directly; sending a request refreshes its completion.
  Profile actions remain adjacent after zero, one, four or five children at
  320px, 390px and 1024px, including localized labels and both dialog actions.
- Checklist follow-up: 414 frontend checks passed; server baseline passed 310 with
  12 optional database checks skipped. App/hosting/server typechecks and both
  frontend build modes plus the server build passed. Local UAT launcher reused
  the healthy stack and preserved accounts/progress.
- Full cabbage recipe, all preparation/cooking phases, pause, retries, four
  outcomes and replay verified at the same six sizes, with no scrolling and
  visible artwork/actions. Existing pointer/animation/reduced-motion checks remain.
- Browser UI tests mock APIs; database and API behavior are checked separately by
  server tests. Native iPad Safari and device passkey dialogs remain hands-on UAT.

## Local UAT startup fallback

`scripts/start-uat.sh` detects kernels without Docker bridge/veth support and
uses `compose.dev.host.yml` automatically. PostgreSQL binds only to 127.0.0.1:55433;
the API and frontend retain 10000 and 5173 on loopback. The same named `pgdata`
volume and native-account adoption checks are retained. The Docker database guard
accepts this explicit local mode only at its fixed loopback address/port and
continues to reject hosted databases and connection overrides. Subsequent starts
recognize the running host-network database. Launcher, import and guard regression
checks cover the fallback without running the full app test suites to start UAT.

## Signed-out welcome page follow-up

Preserve the original welcome page: illustration, PL mark, “Welcome back,
explorer!”, password/Google/passkey actions, and the bottom “New family? Create
a family account” link. Do not replace this with tabs or a redesigned entry page.
All signed-out FamilyGate paths use this same page. The creation link remains
visible after logout and on passkey-preferred devices; `/register` retains the
existing account-creation form and honors the server's registration policy.
Local Compose defaults registration on for UAT, with an explicit local override
available. Production policy is unchanged. The launcher refreshes only the API
when its Compose runtime configuration changes.

Kitchen navigation follow-up: Back to Playground, the centered Cooking & Drinks
title and shared language switch occupy one sticky 64px row. Narrow phones use
an accessible arrow-only return action, preserving the full accessible label.
Removed the old responsive second row that covered the kitchen introduction.

### Avatar dialog and narrow Infinidrill setup

- Avatar customization keeps its title and Cancel/Save actions visible in fixed
  dialog rows; only the options scroll. Save errors stay with the actions.
- Infinidrill setup stacks its machine above the introduction at widths up to
  900px, with proportional artwork and reachable Start/help controls. Wide
  laptop and iPad landscape layouts retain two columns.
- Chromium checks cover avatar scrolling at 320×667, 390×844, 768×600,
  768×1024, 1024×768, 1180×820 and 1366×768, plus Infinidrill setup/start
  at phone, portrait tablet and the three required landscape sizes.
