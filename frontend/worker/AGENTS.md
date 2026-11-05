# Transitional Sites Worker Agent Guide

This guide applies only when maintaining the transitional reference backend
under `frontend/worker/`. The active production target is the Render server in
`server/`, backed by Neon PostgreSQL. It supplements the repository and
frontend guides without superseding the active Vercel/Render/Neon plan.

## Architecture and route ownership

- In the transitional runtime, the Worker is the family identity and
  authorization boundary. The browser never receives D1 or R2 bindings.
- Native Worker routes currently cover health, ChatGPT session, profile CRUD,
  profile progress, published item list/detail, and authenticated R2 media
  reads. See `index.ts`, `core-api.ts`, and `media.ts` for the exact matcher.
- Other `/api/*` routes are transitional proxy routes controlled by
  `API_ORIGIN`. Keep native and proxy route sets explicit when migrating a
  feature.
- Read dispatcher-provided OpenAI identity headers only. Never authorize from
  browser-supplied family IDs, roles, bearer tokens, or `x-plg-*` headers.
  Internal `x-plg-*` headers may be created only by the Worker when forwarding
  to the transitional backend.

## Source of truth

- Active architecture and acceptance criteria:
  `docs/plans/2026-09-19-vercel-render-neon.md`
- Historical Worker architecture:
  `docs/plans/2026-08-29-sites-native-backend.md`
- Worker routing and response mapping: `frontend/worker/`
- D1 bootstrap and bindings: `frontend/worker/db.ts` and
  `frontend/.openai/hosting.json`
- Canonical schema and migrations: `frontend/db/schema.ts` and
  `frontend/drizzle/`
- Seed serialization and deterministic IDs: `frontend/scripts/seed-d1.mjs`
- Frontend response types: `frontend/src/types/`

When a storage field changes, update the schema, migration, seed mapper,
Worker response, frontend type, and tests together.

## Identity, storage, and API rules

- Ensure family ownership is checked server-side for every profile and
  progress operation.
- Return only `is_published=1` catalog items from family-facing content
  routes.
- Keep list queries bounded and preserve category allowlists and pagination
  limits.
- Bind SQL parameters. Never interpolate request or generated-content values
  into SQL.
- Treat malformed stored JSON as invalid data and return a safe fallback.
- Use verified HTTPS URLs with licensing metadata for remote catalog media.
  App-owned media uses the authenticated R2 route.
- Preserve `no-store`, JSON content type, and `X-Content-Type-Options` on
  private API responses.

## Catalog ingestion

- Treat crawled, generated, translated, and third-party content as untrusted.
- Normalize `sightseeing`, `sight seeing`, and `sight-seeing` to `landmark`.
- Validate candidate items with the catalog tests before any D1 write.
- Keep expanded catalog provenance and rejected records beside the fixture;
  require human review before production promotion.
- The checked-in local seed inputs are 314 archived, 200 generated, and 4,100
  expanded source-backed records. They are UAT fixtures, not a production
  backfill.
- Stable item IDs derive from `category | latitude | longitude | English
  title`. Do not accept crawler-supplied IDs.
- Do not overwrite family, profile, progress, quiz-attempt, social, or other
  operational data during catalog imports.

## Verification

Run the smallest relevant tests, then the full Worker gates:

```bash
npm test --prefix frontend
npm run typecheck:hosting --prefix frontend
npm run build --prefix frontend
```

For local D1 UAT, build first and seed only local state:

```bash
npm run build --prefix frontend
npm run db:seed:local --prefix frontend
```

Never deploy or publish from `feature/backend-migration-sites`.
