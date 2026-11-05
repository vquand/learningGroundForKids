# Verified Kitchen sessions

Follow the root guide and frontend/src/features/cooking/AGENTS.md and
frontend/src/features/cooking/burger/AGENTS.md. Number every brainstorming and
clarification question uniquely within each batch.

The pure Cooking and Burger reducers/configuration are shared with the frontend.
Authenticate ownership, validate actions, lock the session and require its revision.
Only the server grades completion/burning and writes journal events in the same
transaction. Never accept client outcomes, scores, completion or elapsed time.

Retain the named Cooking and Burger Kitchen achievement groups, each definition's
badge, explicit unlock condition and difficulty, and the admin-only idempotent
catalog migration. They remain catalog-only: journal verification does not award
badges or resources. Preserve earned badges/player progress. Badge artwork follows
frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md: illustrated,
text-free collectible medallions with common frame, linework, palette and detail.

All existing gameplay controls must remain visible without scrolling at laptop/
iPad landscape sizes 1366×768, 1024×768 and 1180×820 in every state. Preserve
phone layouts and explicit browser-only /uat practice routes. Run frontend/server
gates and real-browser recipe checks when changing these sessions.

`GET /profiles/:id/kitchen-completions` requires family ownership. Count distinct
successful recipe sessions from verified journal history and saved terminal
sessions. Cabbage results okay/perfect qualify; failed outcomes and repeated
simmer attempts on the same batch do not add completions. Store stable recipe
IDs in new journal events; preserve known legacy title-based history. Counts are
display-only and do not award catalog achievements. Never infer success from
Town stamina rewards, which may also be issued for served failed cabbage rolls.
