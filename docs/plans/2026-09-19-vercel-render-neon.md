# Spec: Vercel + Render + Neon production architecture

## Status

Accepted for implementation on 2026-09-19. This plan supersedes the Sites-native
deployment target in `2026-08-29-sites-native-backend.md`. The earlier plan and
ADR remain as historical records.

## Objective

Run Personal Learning Ground as a conventional three-tier web application:

```text
Browser
  -> Vercel React/Vite static site
       -> same-origin rewrites for /api/* and /media/*
  -> Render Node.js API
       -> Neon PostgreSQL
       -> S3-compatible object storage for private uploads
```

Preserve existing user-visible routes and API response shapes while replacing
Sites Worker, D1, R2, and direct browser-to-Supabase dependencies.

## Assumptions

1. Vercel hosts the built React/Vite client. ADR-007 adds a narrowly scoped
   private authored-artwork function using Vercel OIDC; Render verifies each
   family session before it serves an image.
2. Render hosts a Node.js 22+ TypeScript API using web-standard Request/Response
   handlers where practical.
3. Neon is the only production relational database.
4. Runtime database traffic uses `DATABASE_URL` (pooled); schema migrations use
   `DATABASE_URL_UNPOOLED` (direct).
5. Authentication is backend-owned. Production identity comes from email and
   password credentials stored as a modern password hash plus opaque sessions
   stored in PostgreSQL. Sessions use Secure, HttpOnly, SameSite=Lax cookies.
6. Public self-registration is disabled unless `ALLOW_REGISTRATION=true`.
   A bootstrap command creates the first family/admin account without putting
   credentials in source control.
7. Vercel rewrites keep browser API requests same-origin. Render nevertheless
   validates allowed forwarded hosts/origins and never trusts client-provided
   identity, family IDs, roles, scores, or completion state.
8. Public HTTPS catalog media can remain remote. App-owned uploads use an
   S3-compatible private bucket; no production upload depends on Render's local
   filesystem.

## Tech stack

- Frontend: React 19, Vite 8, TypeScript, React Router 7
- Backend: Node.js 22+, TypeScript, Hono on `@hono/node-server`
- Validation: Zod at HTTP and environment boundaries
- Database: Neon PostgreSQL with Drizzle ORM and `node-postgres`
- Authentication: Argon2id password hashes, opaque hashed session tokens in
  PostgreSQL, secure cookie transport
- Object storage: S3-compatible API behind a storage adapter
- Hosting: Vercel static deployment + Render web service

## Public contracts

Existing `/api/v1/items`, `/api/v1/profiles`, progress, quiz, flashcard, social,
parent, and admin response shapes remain stable. Errors retain the envelope:

```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Safe human-readable message"
  }
}
```

Portable authentication endpoints are:

- `GET /api/v1/auth/session`
- `GET /api/v1/auth/registration` returns `{ "enabled": boolean }` for the
  public registration UI without exposing credentials or runtime secrets.
- `POST /api/v1/auth/login` with `{ "email": string, "password": string }`
- `POST /api/v1/auth/register` with `{ "email": string, "password": string,
  "name": string }`, gated by `ALLOW_REGISTRATION`
- `POST /api/v1/auth/logout`

The session endpoint preserves the current shape:

```json
{
  "authenticated": true,
  "user": { "id": "...", "email": "...", "name": "..." },
  "signOutUrl": "/api/v1/auth/logout"
}
```

Anonymous sessions return `{ "authenticated": false }`.

## Commands

```bash
npm ci --prefix frontend
npm test --prefix frontend
npm run typecheck:hosting --prefix frontend
npm run build --prefix frontend

npm ci --prefix server
npm test --prefix server
npm run typecheck --prefix server
npm run build --prefix server
```

Database migrations are generated from the PostgreSQL Drizzle schema and run
with the direct connection string. Application requests use the pooled string.

## Project structure

```text
frontend/              React/Vite client and Vercel configuration
server/                Render-hosted TypeScript API
server/src/db/         Neon/Drizzle schema, repositories, and connection setup
server/drizzle/        Generated PostgreSQL migrations
docs/decisions/        Architecture decision records
docs/plans/            Active implementation plan
frontend/data/catalog-seeds/  Authored catalog seed JSON
```

## Testing strategy

- Contract tests protect existing frontend-visible API shapes.
- Unit tests cover validation, password/session behavior, authorization, and
  query mapping.
- Integration tests run against disposable PostgreSQL, never production Neon.
- Build tests verify Vercel output and Render startup configuration.
- Security tests cover anonymous access, cross-family access, malformed input,
  upload limits, and forged identity headers.

## Boundaries

- Always: validate at HTTP boundaries, parameterize SQL, check family ownership
  server-side, use secure cookies, return `no-store` for private responses, and
  keep secrets in platform environment variables.
- Ask first: production data migration, enabling public registration, changing
  API response contracts, provisioning cloud resources, or deploying.
- Never: trust browser identity headers, expose `DATABASE_URL`, store auth tokens
  in localStorage, commit credentials, run production migrations from pooled
  connections, or persist uploads on Render's ephemeral filesystem.

## Increment plan

1. Add portable Vercel build and same-origin rewrite configuration.
2. Add Render server foundation, environment validation, health routes, and
   secure auth/session boundary.
3. Add Neon PostgreSQL schema, migrations, repositories, and seed/import path.
4. Port core item/profile/progress routes while preserving contracts.
5. Move remaining quiz, flashcard, social, parent, and admin consumers behind
   the Render API and remove direct Supabase browser access.
6. Add S3-compatible upload/read paths and migrate app-owned media metadata.
7. Run contract, security, database integration, build, and browser UAT gates.

## Success criteria

- Vercel serves the SPA and rewrites `/api/*` and `/media/*` to Render, except
  the ADR-007 authored-artwork function. No browser-to-provider calls are added.
- Render starts with `0.0.0.0:$PORT`, exposes liveness/readiness, and fails
  readiness when Neon is unavailable.
- All authenticated mutations derive identity from a validated server session.
- Neon migrations are repeatable and use PostgreSQL-native schema definitions.
- No production frontend code imports Supabase or talks directly to Neon.
- Uploads use durable object storage, not Render local storage.
- Frontend and server tests, type checks, and production builds pass.
- No commit, push, cloud provisioning, deployment, or production migration occurs
  until the user says `confirmed`.
