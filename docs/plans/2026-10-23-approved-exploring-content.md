# Publish the approved 30 Exploring lessons

The user confirmed the reviewed bilingual lessons and question sets on
23 October 2026, and requested a SQL migration plus a commit/push on the current
feature branch. This also includes the learnt-item counters already reviewed
on the Exploring map and Playground card.

The three canonical catalog fixtures now publish exactly the approved 30
stable item keys. Each item has English/Vietnamese lesson text, two authored
flashcards and two three-choice quizzes per language. Recycled auxiliary prose
is cleared; the unsupported Old Faithful and El Niño start dates are removed.
The enrichment queue retains the other 1,602 low-information items.

Human-approved records carry `content_review` plus explicit `flashcards`.
Automatic source refresh skips these records, including its content-building
fallback. The seed hashes authored cards, uses stable authored keys rather than
old positional quiz IDs, shares a question-group ID across translations, and
unpublishes/deactivates obsolete definitions. It preserves their rows, manual
cards, stored quiz results, study sessions, family visibility and earned progress.

## SQL handoff

Use [neon-2026-10-23-exploring-content.sql](../migrations/neon-2026-10-23-exploring-content.sql)
after the existing schema migrations through `0025_explore_snapshots` and the
normal system catalog are present. Apply the entire file, with no catalog
seed/refresh running concurrently. After any error, issue `ROLLBACK` before
retrying in the same SQL session.

This is a content-only operator migration, independent of the other session's
schema migrations 0028/0029. It creates no tables and does not change the Drizzle
journal. It locks and verifies all 30 existing system targets before writing;
a missing/custom-owned target aborts the complete transaction. It enables the
reviewed batch, preserves media, and uses the same definitions/IDs as normal
seeding. A repeated successful run performs no content or revision writes.
Family-disabled items remain disabled for those families.

Regenerate the handoff without connecting to any database:

```bash
cd server
node --import tsx scripts/build-reviewed-exploring-sql.mjs
```

The checked-in SQL is intentionally versioned as a deployment artifact. A
regression test verifies it matches the approved fixtures. Do not execute this
migration against production from the feature branch. No cloud resource or
production database was changed during this work.

## Verification

The disposable PostgreSQL test covers atomic rejection of a non-system target,
all 30 installed lessons, 120 active localized quiz rows, 120 authored localized
flashcard rows, retired historical rows, preserved study/completion records,
manual-card and family-disable preservation, a repeat with no writes, and a
subsequent normal seed that does not reintroduce generated filler. Frontend
content tests check the approval snapshot, bilingual answer keys and the queue.

Validated on a clean snapshot of the staged commit, excluding the concurrent
Town WIP: frontend 473/473 tests; backend 465/465 tests against a fresh guarded
local PostgreSQL test database, with no skips; frontend app/hosting and backend
TypeScript checks; backend build and both Vercel/compatibility frontend builds.
The learnt counters were also checked in the isolated browser fixture in both
languages at 1366×768, 1024×768 and 1180×820, including child switching and a
server-refetched completion. Generated evidence remains under `/tmp`.
