# Frontend Agent Guide

This guide applies to the React/Vite application under `frontend/`. The active
deployment target is a Vercel static frontend backed by the Render API and Neon
PostgreSQL. The Sites Worker under [`worker/`](worker/) is transitional and
reference-only unless a task explicitly targets the legacy local runtime.

## Frontend architecture

- Keep browser traffic same-origin. Vercel serves the SPA and rewrites
  `/api/*` and `/media/*` to the Render origin configured in Vercel, except
  `/api/artwork` handled by the private-artwork function (ADR-007). Do not put
  the Render origin in a `VITE_*` variable or browser bundle.
- Render owns identity, authorization, database, object-storage, and provider
  access, except shared authored artwork served by the Vercel OIDC function
  under ADR-007. Render still verifies its family sessions on every read;
  family uploads retain the Render/S3 implementation. Authentication uses `GET /api/v1/auth/session`,
  `POST /api/v1/auth/login`, and `POST /api/v1/auth/logout` with a secure,
  HttpOnly cookie. Browser requests use same-origin credentials; never store or
  accept a client-provided bearer identity.
- Neon PostgreSQL is the active database target. The Sites Worker, D1, R2,
  `.openai/hosting.json`, and Sites build mode remain transitional compatibility
  infrastructure, not the production architecture.
- Profile, progress, quiz, flashcard, social, parent, and admin clients use
  same-origin API routes. Do not add direct database or provider usage.
- Preserve API response shapes while migrating. Do not trust client-side
  scores, completion state, ownership, role, audience, or family identity.
- Keep `frontend/.openai/hosting.json` limited to transitional Sites-managed
  metadata and D1/R2 bindings. Do not add Render or production secrets there.

## Source of truth

- Migration architecture, security, and UAT:
  `docs/plans/2026-09-19-vercel-render-neon.md`
- App entry and routes: `frontend/src/App.tsx`
- Portable API clients: `frontend/src/api/auth.ts`, `core.ts`, and `items.ts`
- Frontend types: `frontend/src/types/`
- Checked-in catalog fixtures: `frontend/data/`; authored seed JSON:
  `frontend/data/catalog-seeds/`
- Catalog and image tooling: `frontend/scripts/`

## Content and data rules

- Treat generated and crawled content as untrusted input.
- Do not generate country/region association or category-identification quiz
  placeholders from catalog metadata. Apply the shared server content policy
  when reviewing/importing questions; preserve original `seed_index` slots so
  surviving question and flashcard IDs remain stable. Lessons may have no quiz.
- Regenerate checked-in content only for an intentional content change.
  Review the generated catalog, expanded catalog, provenance, rejected-record
  report, image overrides, and catalog tests together.
- Do not use local D1 seeding as a Neon migration or overwrite operational user
  data with catalog imports.
- Keep media URLs HTTPS and retain source, license, and attribution metadata.
- Low-information catalog records remain in the fixtures with `is_published:
  false`; the enrichment queue is `data/catalog-publication-review.json`.
  Run `npm run content:review-publication` to audit and add `-- --write` to
  disable flagged records. See `docs/plans/2026-10-14-catalog-publication-review.md`.
  Research and review both languages before explicitly re-enabling a record;
  refresh must not silently republish disabled filler.
- Confirmed authored catalog records carry `content_review` and explicit
  `flashcards`. Automatic research refresh must preserve this entire lesson and
  practice set. The approved 30-item batch and its SQL handoff are documented in
  `docs/plans/2026-10-23-approved-exploring-content.md`.

## Local development

For a user request to start local UAT, run `scripts/start-uat.sh` from the
repository root. This starts or reuses the complete local stack on frontend
port 5173 and API port 10000, and checks readiness and the same-origin login
route in one invocation. Use the same scoped command for sandbox escalation;
do not launch and check each service through separate approval requests.
The Docker API explicitly watches all `src/**/*.ts` files. Startup also requires
the development-only gardening readiness header, refreshing only an outdated
API service while retaining the database and frontend. Database health alone
does not prove newly added garden endpoints are loaded.

For the active Render-compatible local stack, use separate terminals:

```bash
npm run dev:local --prefix server
npm run dev --prefix frontend
```

The active local frontend is `http://localhost:5173`; the API uses port 10000.
Match the frontend port to `ALLOWED_ORIGINS` in the guarded local API runtime
configuration. A preview on port 3001 can render the login screen but its login
POST is rejected when only port 5173 is allowed; verify an actual login POST
when checking a local preview, not just page loading or the public health route.

Install dependencies and start the transitional Sites-compatible local runtime
with:

```bash
npm ci --prefix frontend
./scripts/start-local.sh
```

The app runs on `http://localhost:3001`. For that legacy local proxy only,
`VITE_API_ORIGIN` may point to a local backend; do not commit that value.

Run the frontend gates after changes:

```bash
npm test --prefix frontend
npm run typecheck:hosting --prefix frontend
npm run build --prefix frontend -- --mode vercel
npm run build --prefix frontend
```

The Vercel build is the active deployment artifact (`dist/client`). The normal
build remains a compatibility gate for the transitional Sites runtime.

For explicitly requested legacy local D1 UAT, build before seeding:

```bash
npm run build --prefix frontend
npm run db:seed:local --prefix frontend
```

Do not create, update, or deploy Vercel, Render, Neon, Sites, D1, R2, or storage
resources from a feature branch.

Journey replay diagnostics are development-only: the overlay and marker probes
are enabled only when `import.meta.env.DEV &&
VITE_JOURNEY_DIAGNOSTICS === "true"`. Keep the flag unset outside local
diagnostics.

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

## Child-facing navigation and controls

- Use `src/components/KidBackButton.tsx` for child-facing return actions.
  Playground returns always say Back to Playground with the same authored SVG
  arrow, Nunito type, cream background and brown foreground/border. Kitchen and
  profile returns change only destination/label. Put the header return in its
  first slot; game headers use `kid-nav` for the shared 64px row, 48px controls
  and reserved language slot. Use `kid-nav-action` for secondary header actions.
- At widths of 600px or less, shared Back to… controls show only the arrow.
  Preserve the full localized accessible name and the 48px touch target.
- Keep primary game actions visually consistent via `kidControls.css`.
  Child-facing questions, answers and instructions need large readable type;
  verify changes at the required laptop/iPad landscape viewports before claiming
  they fit. Preserve game artwork/themes and existing learning-language rules.
- Playground activity age badges use `pages/activityAgeGuidance.ts`. They are
  suggested starting ages based on reading/counting demands, never access gates
  or verified developmental assessments. Avatar and badge-management cards do
  not receive minigame age badges. Localize accessible age descriptions.

## Global interface language

- All routes share a top-right English/Vietnamese country-ball selector.
  Read `src/i18n/AGENTS.md` when adding interface copy. Use reactive
  `useUiLanguage` with authored `uiText`/`uiMessage` strings; translate UI
  catalogs at render time. Keep learning-language settings, user content,
  saved town names, URLs, API commands and identifiers independent.
- Reserve the shared 48px language-control slot in page navigation so it
  cannot cover game controls, map controls or administrative actions.

## Signup language picker and Playground guide

- A successful password signup marks the device-only language picker pending;
  Google signup uses its signup intent plus the server onboarding hint. The
  authenticated app shell shows the full-screen picker before normal content.
  Choices use `setUiLanguage` and localStorage only; never send interface
  language to the API. Keep the flag artwork behind `LanguageFlag`; the
  WebP art is `public/illustrations/language-flags/flag-{vi,en}-v1.webp` and its
  originals and prompt are in `art/ui/language-flags-v1/`.
- The kid Playground guide is server-tracked per profile through the tour GET
  and complete POST endpoints. The guide highlights the real minigame,
  badges, and Town cards, closes safely on skip/failure, and its `?` replay is
  local-only. Keep all guide copy in `uiText`, preserve the stable
  `data-tour="minigame|badges|town"` targets, support Escape, reduced motion,
  keyboard focus, and the required landscape viewports without trapped or
  covered controls.
