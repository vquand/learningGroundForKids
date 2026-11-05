---
title: Architecture Decision Records (ADRs)
tags: [architecture, adr, decisions, rationales]
created: 2026-11-01
---

# Architecture Decision Records (ADRs)

The architectural evolution of Personal Learning Ground is preserved in explicit Architecture Decision Records. This document summarizes all active and historical ADRs.

---

## 📋 ADR Summary Table

| ADR | Title | Status | Date | Core Decision Summary |
| :--- | :--- | :--- | :--- | :--- |
| **ADR-001** | Sites-Native Backend | *Superseded by ADR-002* | 2026-08-28 | Explored hosting backend logic inside Cloudflare/Sites workers. Superseded due to connection pooling and Node ecosystem limits. |
| **ADR-002** | Vercel + Render + Neon Architecture | **Accepted** | 2026-09-19 | Adopted React on Vercel, Node/Hono API on Render, and Neon PostgreSQL for robust scalability, same-origin proxying, and strict session cookies. |
| **ADR-003** | Root Account Recovery | **Accepted** | 2026-09-28 | Implemented a dedicated local credential fallback mechanism for emergency administrative recovery without risking database exposure. |
| **ADR-004** | Waddle Wall Implementation | **Accepted** | 2026-10-06 | Established the first real-time arcade math game with server-verified hurdles, streaks, and animal obstacle mechanics. |
| **ADR-005** | Parent Passkeys (WebAuthn) | **Accepted** | 2026-10-08 | Added FIDO2/WebAuthn biometrics for passwordless family login and instantaneous parent space verification. |
| **ADR-006** | Google Family Auth | **Accepted** | 2026-10-12 | Introduced Google OAuth with mandatory local parent password onboarding before child gameplay is permitted. |
| **ADR-007** | Private Authored Artwork & Asset Loading | **Accepted** | 2026-10-14 | Allowed public delivery of static illustrated game artwork while enforcing authenticated signed access for private user avatars. |
| **ADR-008** | Town Timed Events & Calendar Engines | **Accepted** | 2026-10-20 | Formalized seasonal island events (Halloween, Women's Day) with deterministic calendar schedules and server-verified badge grants. |

---

## 🔍 Detailed Summaries of Key ADRs

### ADR-002: Vercel + Render + Neon Architecture (Active Foundation)
- **Context**: The previous iteration evaluated running full server logic inside serverless edge workers. However, persistent connection pooling to Postgres, memory-intensive 3D geospatial processing, and background jobs required a dedicated runtime.
- **Decision**:
  - Deploy frontend SPA on Vercel with rewrite proxy `/api/*` -> Render API.
  - Run Node.js 20+ with Hono framework on Render Web Services.
  - Utilize Neon Serverless Postgres with Drizzle ORM.
  - Maintain HttpOnly cookie sessions across same-origin traffic.
- **Consequences**: Zero CORS configuration required in the browser, clean environment variable isolation, deterministic performance for heavy catalog operations.

### ADR-005: Parent Passkeys (WebAuthn)
- **Context**: Parents found typing complex master passwords on touchscreens and iPads cumbersome when unlocking parent settings or approving friend requests.
- **Decision**: Integrate WebAuthn/FIDO2 standard. Support FaceID, TouchID, and Windows Hello credentials stored in `passkeys` table.
- **Consequences**: Instantaneous 1-tap verification for Parent Space; cryptographic signatures replace credentials traversing the network.

### ADR-006: Google Family Auth
- **Context**: Families requested "Sign in with Google" for faster onboarding.
- **Decision**: Implement Google OAuth with PKCE. Families registering via Google receive a special placeholder password (`GOOGLE_ONLY_PASSWORD`) and are redirected to an onboarding screen to establish a parent PIN/password before profiles can access minigames.
- **Consequences**: Guarantees children cannot bypass parental boundaries even if the Google account remains logged in.

### ADR-007: Private Authored Artwork vs. Public Game Assets
- **Context**: The app features both custom hand-drawn game assets (collectibles, animals, badges) and sensitive user-uploaded avatars.
- **Decision**:
  - Illustrated minigame badges, tilesets, and icons are deployed as static assets served over CDN for maximum cacheability and zero latency.
  - Child profile avatars and custom uploads are stored in private object storage, streaming through authenticated endpoints or signed URLs with ownership checks.
- **Consequences**: Blazing fast rendering for 3D globe and game canvases without compromising child identity protection.

---

## 🧭 Navigation & Cross References
- System Overview: [[01-architecture/overview|System Architecture Overview]]
- Security Model: [[01-architecture/security-and-auth|Security and Authentication]]
- Viewport & Design Rules: [[02-requirements/viewport-and-ux|Minigame Viewport and UX]]
- Database Reference: [[05-database/tables-reference|Database Tables Reference]]
