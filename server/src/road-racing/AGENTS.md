# Road Racing API Guide

Follow `server/AGENTS.md` and the approved minigame requirements in
`frontend/src/features/animal-racing/AGENTS.md`.

- Shared question kinds, levels, identity, grading, public projection, choice
  rules, and legacy conversion are defined in `server/src/questions/AGENTS.md`.
  Road Racing owns only its rotation/configuration and roster-specific picture
  presentation; do not recreate a second question engine here.

- Number clarification questions, preserving their numbers when restated.
- Keep random rosters/lanes, questions, answers, time, boost expiry, movement,
  placements, rewards, streaks and achievements server-owned.
- Authenticate and authorize every route. Lock profile race progress before
  Town rows. Credit unique race IDs atomically with completion. Retries cannot
  duplicate awards. Never accept caller positions, elapsed time or scores.
- Buffs and debuffs are independent two-second effects. A question stays after
  its first wrong answer; the second wrong answer forcibly finishes it, records
  a slowdown, and reveals the correct answer. A first-try correct answer adds a
  buff, while a retry-correct answer adds neither effect. The player speed uses
  the net active effects, with a three-effect total cap, three-debuff maximum,
  and soonest-expiring buff removal when a new debuff would exceed the cap.
  Forfeits reset win streaks and discard pending race milestones; completed
  last-place races earn no resources but do count toward all reviewed
  achievements, including Scenic Route.
- Named Road Racing achievement group: eighteen text-free storybook medallions
  matching the universal badge prompt. Each has an explicit condition and
  difficulty. Install reviewed definitions with the authenticated admin-only,
  idempotent catalog migration button, with the backend selecting outdated
  groups. Definitions are reviewed server definitions; only completed
  server-verified races can award them. Include complete verified projections
  in kid/Parent/Admin.
- Laptop and iPad landscape flows must fit without scrolling at 1366×768,
  1024×768 and 1180×820. Use the shared UI and headless agent-browser checks.
- Run server tests, typecheck and build; guard disposable database tests.
  No production data or cloud resource changes. No release before confirmed.

## Question configuration

Question kinds, levels, identity, grading, projection, choices and saved-data
conversion are defined in `server/src/questions/AGENTS.md`. Road Racing owns
the reviewed arithmetic rotation: result-only `mul-2to5`/`mul-1d` cards can
reach 81, with three localized server-returned choices and the existing
nonrepeating race sequence.

## Animal picture questions

- Use the 27-species bilingual picture catalog: the original seven racers plus
  twenty approved question-only animals. Never add question-only animals to
  rosters, terrain strengths, portraits, or animal achievement requirements.
- Approved standalone art lives in `public/minigames/road-racing/question-animals/`
  with exact generation/edit prompts. Render complete square images with uniform
  scaling, including in feedback bubbles; preserve species-specific feet.
- Exhaust unseen picture species before falling back to another question kind.
  Keep three unique localized choices and server-owned grading; saved original
  seven-species questions remain compatible.
