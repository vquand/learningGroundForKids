# Superseded Spec: Native Sites Hosting Adapter

> Historical plan: archived Python/Go backends and Supabase files were removed on
> 2026-10-31. Paths and commands below describe the former checkout; use Git history
> for those files and `scripts/start-uat.sh` for the active local stack.

> Superseded on 2026-08-29 by
> [Sites-Native Personal Learning Ground Backend](2026-08-29-sites-native-backend.md).
> This document remains as the historical record for the initial frontend-only
> Sites adapter.

## Objective

Host Personal Learning Ground on Sites while preserving the existing React/Vite
frontend. The initial adapter forwarded same-origin API and media requests to a
separately hosted Go service; the current migration now replaces that boundary
with a native Worker API backed by D1 and R2.

This migration does not rewrite product features, move application data, or
replace the Go service. It removes only the frontend-specific Docker/Nginx
hosting layer and dependencies that are demonstrably unused.

### ChatGPT identity

Family sign-in uses dispatch-owned Sign in with ChatGPT (SIWC). Hosted requests
receive the OpenAI identity headers from Sites; the Worker converts them into a
small same-origin session response and forwards only sanitized identity headers
to the Go API. The browser never submits or stores an identity token.

The OpenAI user id becomes the stable family owner id for new backend records.
Mapping existing Supabase family records to OpenAI users is a separate data
migration and must be complete before the legacy data path is removed.

## Tech Stack

- React 19, TypeScript, Vite, Tailwind CSS, React Router
- Go API under the archived `archive/backends/go-foundation/`
- OpenAI Sites metadata plugin and Cloudflare Vite Worker output
- Existing PostgreSQL and object-storage direction from the Go migration plan
- No D1 or R2 binding in this historical hosting slice

## Commands

- Frontend development: `npm run dev --prefix frontend`
- Frontend test: `npm test --prefix frontend`
- Hosting type check: `npm run typecheck:hosting --prefix frontend`
- Sites build: `npm run build --prefix frontend`
- Go test: `go test ./...` from `archive/backends/go-foundation/`

## Project Structure

```text
frontend/
  src/                 React application (preserved)
  worker/              Sites identity boundary and API/media forwarding
  tests/               Worker and hosting contract tests
  .openai/hosting.json Sites deployment metadata
archive/backends/go-foundation/  Go API foundation (preserved)
archive/backends/legacy-python/  Legacy runtime (preserved)
```

## Code Style

Use small named TypeScript helpers with explicit inputs and safe failure modes:

```ts
export function resolveApiOrigin(value: string | undefined): URL | null {
  if (!value?.trim()) return null;
  return new URL(value);
}
```

The historical Worker did not contain application business logic. The active
replacement intentionally owns the native API boundary; see the superseding
backend migration plan.

## Testing Strategy

- Unit-test API path recognition and upstream URL construction with Node's
  built-in test runner.
- Unit-test anonymous, authenticated, malformed-name, and spoofed-identity
  behavior at the Worker boundary.
- Type-check the React application, Vite configuration, and Worker.
- Run the production Sites build and require `dist/server/index.js`, static
  client assets, and `dist/.openai/hosting.json`.
- Keep browser testing out of this migration because the product UI is not being
  changed and the Sites workflow does not require visual QA for publishing.

## Boundaries

- Always: preserve same-origin cookies, methods, query strings, and request
  bodies when forwarding; trust identity only from Sites-provided headers;
  sanitize identity before forwarding; keep deployment values out of source;
  fail closed on missing or invalid upstream configuration.
- Ask first: change the database or remove the legacy backend before Go feature
  parity.
- Never: commit secrets, expose the upstream service as an open proxy, embed an
  API origin in the frontend bundle, claim the Go binary runs inside Sites, or
  publish a feature branch to Sites. Never implement the dispatcher-owned
  `/signin-with-chatgpt`, `/signout-with-chatgpt`, or `/callback` routes.

## Success Criteria

- `npm run build --prefix frontend` produces a Sites-compatible Worker bundle
  and SPA assets.
- Browser requests to `/api/*` and `/media/*` are routed through the Worker to
  the configured `API_ORIGIN` without changing the public URL.
- Anonymous visitors see one ChatGPT sign-in action; authenticated visitors get
  a sanitized user id, email, and optional display name from the Worker.
- The old family email/password registration and browser-stored auth token are
  removed; admin authentication remains unchanged.
- The React app and current Go backend source remain intact.
- Old frontend Docker/Nginx files and the unused static-copy package are gone.
- No D1/R2 binding is introduced without an application-data migration.
- The validated source is available for local UAT on the feature branch.
- Sites publication happens only after explicit approval and from `main`.

## Open Questions

- The production `API_ORIGIN` is not present in the repository. It must be
  supplied through Sites runtime configuration before the deployed app can use
  the Go API.
- The actual ChatGPT redirect cannot complete on localhost because Sites owns
  the production SIWC handshake. The Sites development runtime supplies a
  fixed local test identity on the same routes so UAT can exercise the
  post-login app; a real OpenAI account is verified only after an approved
  main-branch deployment.
- The legacy backend remains necessary until its remaining routes have been
  ported to Go; removing it is explicitly outside this slice.
