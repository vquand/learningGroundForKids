# Spec: Sites-Native Personal Learning Ground Backend

> Historical plan: archived Python/Go backends and Supabase files were removed on
> 2026-10-31. Paths and commands below describe the former checkout; use Git history
> for those files and `scripts/start-uat.sh` for the active local stack.

## Status

Accepted on 2026-08-29. Implementation starts with the core flow and proceeds
incrementally through all existing features.

## Objective

Make the deployed Personal Learning Ground app self-contained in one Sites
project: the React/Vite UI, authentication boundary, API routes, and durable
application data must be served through the same Site. The Go and legacy
Supabase/Python implementations remain migration references until feature
parity and data verification are complete.

## Assumptions

1. The existing React frontend and public routes should remain stable.
2. Family identity remains dispatch-owned Sign in with ChatGPT.
3. Durable relational data is required; Sites D1 is the default target.
4. User-uploaded avatars/media require object storage; Sites R2 is the default
   target.
5. Admin authentication and admin-only mutations remain server-side.
6. The migration is incremental and must leave each checkpoint deployable.

## Proposed architecture

```text
Browser
  -> one Sites project (React/Vite assets + Worker)
       -> Worker API routes and ChatGPT identity boundary
       -> D1 relational data
       -> R2 media and uploads
```

The Worker owns request validation, authorization, pagination, rate limits,
and provider calls. The browser never connects directly to D1, R2, Supabase,
or third-party providers.

## Migration strategy

Use a strangler migration by vertical feature slice:

1. Freeze the existing frontend API contracts and inventory every Supabase,
   legacy Python, and Go call.
2. Add D1/R2 bindings and migration tooling without removing the old path.
3. Migrate ChatGPT session/account ownership and one read-only content slice.
4. Migrate family profiles and progress, then quizzes, flashcards, social, and
   parent features.
5. Migrate admin/content/media operations and provider adapters.
6. Backfill and verify data, switch all consumers, then remove Supabase and Go
   runtime dependencies from production.

## Commands

- Frontend tests: `npm test --prefix frontend`
- Sites type-check: `npm run typecheck:hosting --prefix frontend`
- Sites build: `npm run build --prefix frontend`
- Local D1 seed: `npm run db:seed:local --prefix frontend` (after a build)
- Catalog generation: `npm run content:generate --prefix frontend`
- Public-image enrichment: `npm run content:images --prefix frontend`
- Archived Go reference tests (when needed): `go test ./...` from
  `archive/backends/go-foundation/`
- Worker/API tests: `npm test --prefix frontend`

The Sites/Worker typecheck and production build pass. The broader application
typecheck still reports pre-existing Cesium/type-version and unused-variable
diagnostics outside this migration slice.

## Project structure

```text
frontend/worker/       Sites Worker, API routes, auth boundary
frontend/src/api/      Stable frontend clients, migrated one slice at a time
frontend/tests/        Worker, contract, migration, and regression tests
frontend/db/           Drizzle D1 schema definitions
frontend/drizzle/      Generated D1 migrations
archive/backends/      Legacy Python and Go implementations for reference
```

## Code style

Keep handlers small and explicit; put validation and authorization in named
helpers:

```ts
export async function handleProfiles(request: Request, env: Env): Promise<Response> {
  const identity = requireChatGPTIdentity(request);
  const input = await parseProfileInput(request);
  await authorizeFamilyMutation(identity, input);
  return Response.json(await env.DB.prepare(PROFILE_QUERY).bind(identity.userId).all());
}
```

## Testing strategy

- Contract-test every migrated route against the existing frontend shape.
- Test anonymous, authenticated, malformed, expired, and cross-user requests.
- Test D1 migrations on a disposable database and R2 upload limits with fakes.
- Test provider timeouts, malformed responses, pagination bounds, and rate
  limits.
- Keep Go tests running until the corresponding Worker slice reaches parity.
- Require a production Sites build and a local Worker UAT checkpoint after each
  2–3 vertical slices.

## Boundaries

- Always: preserve same-origin browser calls, trust identity only from Sites,
  validate all input server-side, use parameterized D1 queries, bound uploads
  and lists, and keep secrets in Sites runtime configuration.
- Ask first: destructive Supabase data removal, irreversible backfills,
  public access changes, new third-party providers, or changing user-visible
  API contracts.
- Never: run a Go binary inside Sites, expose D1/R2 directly to the browser,
  accept client-provided ownership, commit secrets, or remove the legacy path
  before parity and rollback evidence exist.

## Success criteria

- The production app's required `/api/*` and `/media/*` routes execute within
  the same Sites project with no external backend origin.
- ChatGPT family sign-in, profiles, progress, content reads, and core learning
  flows work after deployment.
- D1/R2 migrations are repeatable, tested, and documented.
- No browser code imports Supabase or calls third-party provider APIs directly.
- Go and legacy runtimes are removable only after route-by-route parity and
  data verification are recorded.

## Decisions recorded

1. D1 is approved for relational data and R2 for media.
2. All current features remain in scope, migrated incrementally.
3. The first usable release is the core: ChatGPT sign-in, profiles, content,
   and progress. Secondary and admin features follow in later slices.

## Initial task breakdown

- [ ] Inventory and freeze frontend route contracts; produce a parity matrix.
- [x] Design the initial D1 schema and data-backfill/rollback direction.
- [x] Add D1/R2 bindings, generated migration, and local schema initialization.
- [x] Migrate ChatGPT-owned family identity and profile CRUD.
- [x] Migrate content reads and media delivery.
- [x] Migrate the initial progress read/write boundary (quiz and badge
  completion remains on the next slice).
- [x] Expand the local seed catalog with 200 bilingual cross-era items.
- [x] Add a Wikimedia Commons image manifest with source/license metadata and
  direct HTTPS media support in the Worker.
- [ ] Migrate badges, quizzes, and flashcards.
- [ ] Migrate social and parent features.
- [ ] Migrate admin/provider routes and remove direct Supabase calls.
- [ ] Run parity/UAT gates, remove obsolete runtimes, and publish from `main`.
