---
title: Shared Conventions & Coding Standards
tags: [typescript, conventions, standards, i18n, formatting]
created: 2026-11-01
---

# Shared Conventions & Coding Standards

All source code across **frontend** and **server** directories must adhere to strict typing, security, and internationalization standards to maintain high codebase reliability.

---

## 📐 Strict TypeScript (`noUncheckedIndexedAccess`)

Both `frontend/tsconfig.json` and `server/tsconfig.json` have `noUncheckedIndexedAccess: true` enabled.

### Rules & Invariants:
1. **Guarding Potential `undefined` Elements**:
   - Accessing array indices or dictionary keys always returns `T | undefined`.
   - You must explicitly guard array bounds or use nullish coalescing:
     ```typescript
     // ❌ Forbidden (compile error under noUncheckedIndexedAccess)
     const firstItem = items[0].id;

     // ✅ Required
     const firstItem = items[0]?.id;
     if (!firstItem) throw new Error("No items available");
     ```
2. **Non-Null Assertions (`!`)**:
   - Non-null assertions (`!`) are forbidden unless accompanied by a proven invariant comment or strict preceding assertion.

---

## 🌐 Internationalization (`i18n`) Conventions

The user interface supports dual-language operation (`en` for English, `vi` for Vietnamese):

1. **Frontend `uiText(key)` Helper**:
   - Every user-facing UI label, button text, error toast, and aria-label must use `uiText("English text")`.
   - Translations reside in `frontend/src/i18n/vi.json`.
2. **Vietnamese Character Regex Invariant**:
   - Minigames and inputs accepting Vietnamese text must use the standardized character set constant `VIETNAMESE_CHARACTERS` in `server/src/ufo/letters.ts` to support tone accents correctly.

---

## 🗄️ Database Querying & Naming Conventions

1. **CamelCase in Code, SnakeCase in PostgreSQL**:
   - Drizzle schema fields use camelCase in TypeScript (`catalogRevision`) mapping to snake_case in SQL (`catalog_revision`).
2. **Timestamp with Timezone**:
   - All temporal fields use `timestamp(..., { withTimezone: true, mode: 'date' })` defaulting to `defaultNow()`.
3. **UTC Everywhere**:
   - Server dates and completion records are saved and queried in UTC. Replays default to `last7days`.

---

## 🚫 Artifact & Test Evidence Policy

To keep the repository clean and avoid repository bloat:
- Test output, Playwright recordings, traces, screenshots, and logs must stay local under `/tmp` or ignored folders.
- Git hooks (`scripts/check-generated-artifacts.sh`) reject commits containing `test-results/`, `playwright-report/`, `coverage/`, or raw images.

---

## 🧭 Navigation & Cross References
- Repository Layout: [[03-codebase-structure/repository-layout|Repository Layout]]
- Server Architecture: [[03-codebase-structure/server-architecture|Server Architecture]]
- Testing and Verification: [[08-development-and-ops/testing-and-verification|Testing and Verification]]
