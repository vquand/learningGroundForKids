# Repository Agent Guide

This bilingual educational world-map app uses a React/Vite frontend on Vercel,
a Node.js/TypeScript/Hono API on Render, and Neon PostgreSQL. Browser requests
stay same-origin through Vercel rewrites; the API owns secure cookie sessions.
Read the directory-specific guide before changing code:

- [`server/AGENTS.md`](server/AGENTS.md) — active Render API, Neon data access,
  authenticated catalog/cluster caching, and backend verification.
- [`frontend/AGENTS.md`](frontend/AGENTS.md) — frontend, build, content, and
  local development rules.
- [`frontend/worker/AGENTS.md`](frontend/worker/AGENTS.md) — transitional Sites
  Worker reference and the API/security contracts being ported to Render.

## Source of truth

The active architecture, security requirements, acceptance criteria, and UAT
protocol are in
[`docs/plans/2026-09-19-vercel-render-neon.md`](docs/plans/2026-09-19-vercel-render-neon.md).
The Sites-native plans and ADR-001 are historical and superseded by ADR-002.
The former Supabase and archived Python/Go backends have been removed; their
history is available in Git. Catalog seed JSON lives in `frontend/data/catalog-seeds/`.

## Repository-wide rules

- Present brainstorming and clarification questions as concise numbered lists.
  Use multiple-choice options where they fit, with short lettered choices so
  the user can reply with a question number and option letter.

- For all existing and future minigames, number every brainstorming and
  clarification question so the user can answer by number. Keep numbers unique
  within each question batch and preserve them when restating pending questions.
- Every minigame must have an `AGENTS.md` in its implementation directory.
  Create it if missing and include the numbered-question rule before starting
  brainstorming or implementation.
- Every existing and future minigame must have one or more achievements in a
  named achievement group. Each achievement must define a badge, a clear unlock
  condition, and a difficulty level describing how hard it is to obtain.
- Keep one migration button for the complete admin achievement list. Its
  authenticated, admin-only API must compare every reviewed server definition,
  decide which minigame groups need migration, and install/update only those
  groups. Repeated runs must be idempotent and preserve earned badges and player
  progress. Never accept browser-supplied group choices or achievement
  definitions, or award badges from client-reported progress.
- Include these achievement requirements in every minigame's implementation
  guide. Clearly distinguish a catalog definition from an earnable achievement
  until server-verified grading and progress are implemented.
- Keep all minigame badge artwork visually consistent with the universal
  prompt in `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`.
  Use illustrated, text-free collectible medallions in a shared storybook style;
  vary the central pictogram by achievement while retaining the common frame,
  linework, palette, and detail level. Keep names, difficulty, and unlock
  conditions as text outside the icon. Record this rule in each minigame
  implementation `AGENTS.md`.
- When generating game art with Antigravity (`agy`), follow
  [`docs/artwork/AGY_IMAGE_PIPELINE.md`](docs/artwork/AGY_IMAGE_PIPELINE.md): images land in
  `~/.gemini/antigravity-cli/brain/` as JPEG variants (the wrapper and its reply are unreliable),
  use a magenta chroma-key background and `scripts/art/chroma_key_sheet.py`, review every variant, and
  commit only approved assets with their prompts.
- Work on a feature branch off `main`; do not merge until the user says so.
- Keep each vertical slice runnable and preserve existing user-visible API
  contracts unless the migration plan explicitly changes them.
- Treat authentication, authorization, uploads, AI output, and third-party
  responses as security boundaries. Never trust client-provided identity,
  ownership, role, scores, or completion state.
- Do not add direct browser-to-database or browser-to-provider calls. Use the
  same-origin API and the shared-artwork exception documented in ADR-007.
- Do not commit, push, merge, publish, or mark the migration complete until
  the user says `confirmed`.

## Shared implementation conventions

- Keep TypeScript strict with `noUncheckedIndexedAccess`. Guard potentially
  missing array elements; use non-null assertions only with a proven invariant.
- Derive the done-tracking `hasMedia` gate from actual `youtube_url` or nonempty
  `audio_urls`, never the category-level `CategoryRegistry.hasMedia` flag.
- Done tracking has three gates: a 15-second time gate, a scroll gate (25% and
  75% checkpoints) and a media gate that applies only when the item really has
  media.
- `quiz_required` is set from the seed `quiz_questions` at seed/sync time. Never
  set it by hand or from a migration script outside the seed path.
- Journey replay defaults to `last7days`; completion timestamps are UTC.
- `filterStore.clearEra()` clears only `activeYear`; `clearFilters()` clears
  only `activeCategories`. Do not substitute one for the other.
- For shared question kinds, levels, identity, grading, public projections and
  saved-data compatibility, follow
  [`server/src/questions/AGENTS.md`](server/src/questions/AGENTS.md).
  Games own progression and presentation; use that guide's numbered intake
  questions and verification checklist for engine changes.
- Preserve the custom Cesium asset-copy plugin in `frontend/vite.config.ts`.
  Builds must contain `dist/client/cesium/{Workers,Assets,ThirdParty,Widgets}`
  so runtime asset URLs resolve correctly.

## Brainstorming

Always opt in to the browser-based visual companion during brainstorming for
mockups, wireframes and diagrams; do not ask first.

## Release safety

- Do not create or update Vercel, Render, Neon, S3, or other cloud resources
  from a feature branch.
- Do not run migrations or seed commands against production data.
- Keep production origins, database URLs, auth secrets, and storage credentials
  in platform runtime configuration, never in source control.
- Browser traffic remains same-origin through Vercel rewrites; the Render API
  still validates origin/host and authenticates every protected request.

## Starting local UAT

- When the user asks to start local development or local UAT, run exactly
  `scripts/start-uat.sh` from the repository root. It reuses a healthy native
  or Docker stack; otherwise it starts the active Docker stack, then checks the
  frontend, API/database readiness, same-origin proxy, and a login POST.
- The frontend must be on `http://localhost:5173` and the API on port 10000.
  Do not start the archived Python backend or the legacy port-3001 runtime.
- If sandbox access is denied, request escalation for `scripts/start-uat.sh`
  with the same scoped command prefix so the user can save that approval.
  Keep readiness checks and failure logs inside the launcher instead of issuing
  separate escalations for Docker, curl, and Node startup commands.
- Do not reset accounts or volumes, kill unrelated listeners, provision cloud
  resources, or rerun full test/build/browser suites just to start UAT. Report
  the launcher result and the URL; investigate only if its checks fail.
- The launcher may stop recognizable native Node/Vite listeners owned by this
  checkout when replacing a partial native stack with Docker. Both native and
  Docker database volumes remain intact; these are separate local databases.
- A cold start adopts existing native-local accounts/passkeys/progress only
  when the Compose database has no user records. The import helper uses fixed
  local PostgreSQL sockets and an atomic restore, never resets credentials or
  overwrites populated Compose data. Do not report login readiness merely from
  a healthy but account-empty API; preserve existing local accounts for UAT.

## Baseline checks

- Generated test evidence stays local, under `/tmp` or an ignored output
  directory. Do not commit screenshots, browser recordings, traces, raw
  benchmark results, test logs, coverage output, or generated verification/UAT
  reports. This applies to every feature and minigame.
- Enforced by Git hooks: run `scripts/install-git-hooks.sh` once per clone.
  `pre-commit` and `pre-push` run `scripts/check-generated-artifacts.sh`, which
  refuses `output/`, `test-results/`, `playwright-report/`, `coverage/`,
  `docs/evidence|performance|test-evidence/`, screenshots, recordings, traces and
  logs, including files that arrive through a merge. Never bypass it with
  `--no-verify`; untrack with `git rm -r --cached <path>` instead.
- Keep test source, required fixtures, production assets, authored plans and
  architecture decisions versioned. Record concise validation results in PR
  descriptions or the relevant plan. When cleaning up tracked evidence, remove
  it from Git tracking while preserving local copies.

Run the checks described by the applicable directory guide. The standard gates
are:

```bash
npm test --prefix frontend
npm run typecheck:hosting --prefix frontend
npm run build --prefix frontend
```

For Render API or Neon changes, also run:

```bash
npm test --prefix server
npm run typecheck --prefix server
npm run build --prefix server
```

## Minigame viewport requirement

- Optimize every existing and future minigame for laptop screens and iPad
  landscape screens. All buttons and controls needed in the current step must
  be visible and usable within the viewport, with no vertical or horizontal
  scrolling required.
- Apply this to setup, gameplay, heat/ingredient selection, pause, results,
  failure, and replay prompts. Keep the play area and its current controls
  visible together; prompts must not cover controls or require scrolling to
  find their action buttons.
- Size and arrange the layout using the available viewport width and height,
  including browser chrome and safe areas. Preserve artwork proportions,
  readable text, and usable touch targets when fitting the screen.
- Verify complete flows in a real browser at representative laptop and iPad
  landscape sizes, including 1366×768, 1024×768, and 1180×820. Check every
  button's bounds and confirm that no scrolling is needed in each state.
- Include this requirement in the implementation-directory `AGENTS.md` of
  every future minigame.

## Playground activity ordering

- Keep the first three Playground activity cards in this exact order: **Your
  avatar**, **Badges**, then the active child's **Town name** card. New
  minigames and activities must not displace these three fixed slots. Calendar is the
  fourth card and Daily Quiz the fifth.

## Parent and admin achievement reporting

- Whenever a minigame is added and its achievements are produced, include the
  minigame and its complete achievement group in the kid profile reports in
  **both Parent Space and Admin Space**. This is part of adding the minigame,
  not a later optional task. Keep names, badge artwork, unlock conditions,
  difficulty, earned status and progress consistent across both spaces.
- Use the shared server-owned child-report projection and the universal activity
  identity/design language. Test both reports when adding a group; registering
  it only in the admin achievement catalog is insufficient.
- Keep catalog-only definitions visibly labeled as not yet earnable. Show
  unsupported progress as unavailable, never invented completion counts or
  earned badges. Earned status must come from server-verified progress.

## Resource collection feedback

- Every server-awarded Town resource receipt must show the material artwork and
  large `+N` amount in the play area's center, then fly to a visible Town storage
  or inventory control. Use `TownRewardBar` with the scene selector and a stable
  server revision/receipt ID; InfiniDrill retains its deposit-to-inventory flights.
- Animate successful newly committed actions only. Initial reads, reloads,
  heartbeats without a new reward, duplicate responses, wrong answers, forfeits,
  practice mode and zero-resource results must not replay or invent rewards.
- Animation is cosmetic: never calculate payouts or write inventory from it.
  Keep controls usable, localize announcements, honor reduced motion and clear
  timers/layers on unmount. Check the full path at all required landscape sizes.
