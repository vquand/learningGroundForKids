# ADR-001: Keep the application backend inside the Sites project

## Status

Accepted

## Date

2026-08-29

## Context

The deployed frontend currently depends on an API origin that is not reachable
from Sites. The Go foundation and legacy Supabase/Python runtime would require
separate hosting, which conflicts with the requirement to operate this personal
app from one hosted location.

## Decision

Migrate the backend incrementally into the existing Sites project as a
TypeScript/JavaScript Worker API. Use Sites D1 for relational application data
and R2 for uploaded media. Keep the React/Vite frontend and dispatch-owned
ChatGPT identity. Retain the Go and legacy runtimes only as references until
route parity, data backfill, and rollback evidence are complete.

Deliver the core flow first—ChatGPT sign-in, profiles, content, and progress—
then migrate quizzes, flashcards, social, parent, admin, and provider features
one vertical slice at a time.

## Alternatives considered

### External Go hosting

Preserves Go with less rewrite, but requires a second hosting platform and a
public API origin. Rejected because the app should not be operated in multiple
places.

### A second Sites project for the Go API

Sites does not execute Go binaries. A second Site could only host another
Worker or proxy, leaving the Go runtime external. Rejected.

### GitHub Pages plus an external API

GitHub Pages can serve static assets but cannot run the Worker/API boundary or
Go service. Rejected for the primary deployment.

## Consequences

- The backend must be rewritten in TypeScript-compatible Worker code.
- D1 schema and R2 upload policies become production data contracts.
- Supabase data needs a deliberate backfill and OpenAI-user-id mapping.
- The migration is larger, but the final operational topology is one Site.
- Go remains useful as a route/behavior reference during parity work and is
  removed only after verified migration completion.
