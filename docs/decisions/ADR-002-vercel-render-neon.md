# ADR-002: Deploy on Vercel, Render, and Neon

## Status

Accepted on 2026-09-19. Supersedes ADR-001 as the production target.

## Context

The active implementation coupled the React application to a Sites Worker,
dispatcher-provided ChatGPT identity headers, Cloudflare D1, and R2. The new
deployment requirement is a conventional frontend, backend, and database split:
Vercel for the web client, Render for the API, and Neon for PostgreSQL.

## Decision

Deploy the compiled React/Vite SPA to Vercel. Preserve same-origin browser
contracts by rewriting `/api/*` and `/media/*` to a Render-hosted Node.js API.
Use Neon PostgreSQL through Drizzle and `node-postgres`, with pooled runtime and
direct migration URLs. Replace dispatcher identity with backend-owned secure
cookie sessions. Put private uploads behind an S3-compatible storage adapter.

## Alternatives considered

### Keep the Sites Worker as an identity gateway

This preserves ChatGPT dispatcher identity, but the production topology would
still require a fourth platform and would not be Vercel/Render/Neon-only.

### Deploy the archived FastAPI service directly

Render can run it, but it still depends on Supabase auth/data APIs, in-memory
admin tokens, and local filesystem uploads. Rehabilitating it would retain more
legacy coupling than porting the already-tested Worker contracts to a portable
TypeScript server.

### Deploy the archived Go foundation

It already uses PostgreSQL-compatible tooling, but it only implements foundation
health/auth primitives and lacks the application's route coverage.

## Consequences

- Sites, D1, R2, Wrangler, and dispatcher identity stop being production
  dependencies after parity and migration verification.
- Authentication changes from ChatGPT-managed identity to application-managed
  credentials and sessions.
- The browser remains same-origin from its perspective, minimizing frontend
  contract changes and avoiding broad CORS configuration.
- PostgreSQL migrations and data backfill require explicit rehearsal and rollback
  evidence before production cutover.
- Object storage remains a separate durable service; Neon PostgreSQL is not used
  for arbitrary media blobs.


## Narrow amendment

ADR-007, approved for local implementation on 2026-10-15, permits an OIDC-backed
Vercel Function for shared authored artwork. Render continues to verify family
sessions; database access, family uploads, and other providers stay on Render.
