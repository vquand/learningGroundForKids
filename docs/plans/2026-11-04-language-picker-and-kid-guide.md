# Post-signup language picker and first-visit kid guide

Branch `feat/language-picker-onboarding`. Parents reported the system is hard to use, so a new family chooses the interface
language once, and each kid profile gets a short guided tour the first time it is opened.

## Decisions (user, 2026-11-04)
1. Language choice is device-only (`localStorage`, existing `plg-ui-language`). No server language field. Logging in on a new device
   may show the screen again only if it was never completed on that device; it is shown **after signup**, once.
2. The picker appears immediately after a successful signup (password registration and Google new-family creation), before anything else.
3. Two cute chubby waving flags without a frame: Vietnam and Britain (universal style, text-free art; text outside the art).
   Selecting the Vietnamese flag applies `vi` and shows "Lựa chọn ngôn ngữ: Tiếng Việt"; selecting the British flag applies `en` and
   shows "Selecting language: English". A Continue/Tiếp tục button then proceeds.
4. Kid guide: tracked on the **server per profile** (`tour_completed_at`), shown the first time a profile's playground opens,
   including existing profiles. Spotlight coach marks pointing at real cards with Next/Back/Skip; skipping or finishing marks it done.
5. Steps (confirmed 8a, 9a): (1) a minigame card: these are games to play; (2) the Badges card: finishing minigames earns badges
   and materials; (3) the Town card: materials are used to build the town. A "?" button on the playground replays it (local only).
6. All copy is bilingual (`uiText`) and follows the chosen language. Every state fits laptop and iPad landscape without scrolling
   (1366x768, 1024x768, 1180x820).

## Contracts
- `GET /api/v1/profiles/:profileId/tour` -> `{ "completed": boolean }`
- `POST /api/v1/profiles/:profileId/tour/complete` -> `{ "completed": true }` (idempotent, empty strict body)
- Both require the signed-in family to own the profile (403/404 otherwise); the client never sends identity or a timestamp.
- Migration adds nullable `profiles.tour_completed_at timestamptz`; null = not completed. Never set from client-reported progress.

## Phases
1. Server: migration, repository, routes, tests.
2. Flags art (agy, universal style) and placeholder-free production assets with recorded prompts under `art/`.
3. Language picker screen + post-signup trigger + tests.
4. Kid guide (spotlight) + playground targets + replay button + tests.
5. Browser verification at the three landscape sizes; AGENTS.md notes.
