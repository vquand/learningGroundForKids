# Road Racing: no guess-spamming, slowdowns (debuffs) and two achievements

Branch: `feature/road-racing-slowdowns` (based on `review/minigame-question-types`, PR #91, because it uses the shared question engine). Decided with the user on 2026-10-28.

Status: Steps 1 (code) and 2 (badge art and atlas wiring) complete. Review and
full race/browser/DB UAT remain pending; no commit or deployment in the art step.

## Why

A kid can press the same position repeatedly (for example always "A") and eventually get answers right by luck, which defeats the learning purpose. Wrong answers must cost something and a question must be finished before the next one appears.

## Rules (all server-owned)

### Finishing a question
- A question is **finished** by a correct answer, or forcibly after **2 wrong answers on that same question**. The next question never appears before the current one is finished.
- After the first wrong answer the **same question stays**, with the **same choice order**. **All choices stay pressable**, including the one already tried, so repeating the same wrong choice twice finishes the question. The previously chosen wrong choice is shown **red**. The wrong-attempt count and which choices were tried are stored on the server (a page reload cannot reset them).
- **Correct on the first try**: counts as correct, gives a **buff** (subject to the caps below).
- **Correct after one wrong try**: counts as correct for stats/achievements that count correct answers, but gives **no buff and no debuff**.
- **Forced finish (2 wrong)**: the question counts as incorrect (never as correct), the correct answer is shown in the existing separate "previous answer" feedback area (reuse it), and the player receives a **debuff**.

### Buffs and debuffs
- A buff is a +speed effect lasting 2 seconds (existing behaviour). A **debuff** is a slowdown lasting **2 seconds**, shown with a **snail icon** instead of the lightning bolt.
- Effects are independent timers (like today's stacks). Active effects: buffs `b`, debuffs `d`.
- **Net effect** `n = b − d`. Base speed is 8, each net buff adds 3, each net debuff halves it:
  - `n >= 0`: speed = `8 + 3n` (n=0 is normal speed 8; 1 buff + 1 debuff = normal).
  - `n < 0`: speed = `8 × 0.5^(−n)` (−1 → 4, −2 → 2, −3 → 1).
- Opponent speeds are unchanged.
- **Caps**: `b + d <= 3` at all times; max buffs = `3 − d` (one debuff → max 2 buffs, two → max 1, three → 0); max debuffs = 3.
  - A new buff is added only if `b < 3 − d` (at the cap it is ignored, as today: no refreshing or queuing).
  - A new debuff is **ignored if there are already 3 debuffs** (no refresh). Otherwise it is added and, if `b + d > 3`, the buff(s) with the **soonest expiry are removed** until the total is 3.
- Races that end (finish or forfeit) clear all effects as today.

### Stats and achievements
- Existing `peakStacks` / "Full Charge" still means 3 buffs at once (only reachable with no debuffs). Keep behaviour.
- Add race-level tracking: whether the player received at least one debuff (`slowed`) and the peak number of simultaneous debuffs (`peakSlows`).
- Two new achievements in the Road Racing group (16 → 18), badge art in the same universal medallion style (see `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`):
  1. **Slow and Steady** (easy): finish a race after being slowed by a debuff at least once.
  2. **Snail Survivor** (hard): finish in the top three in a race in which you carried 2 or more debuffs at the same time.
  Only finished races count (not forfeits). Include both in Parent and Admin kid reports with consistent names, art, conditions, difficulty and progress (see `frontend/src/features/AGENTS.md`, "Parent and admin achievement reporting"), and in the admin catalog migration so installed groups update.

### Display
- Buff row in `RacingScene` shows lightning for buffs and a snail for debuffs (total never exceeds 3 icons); accessible labels localized (en/vi).
- Quiz: red mark on a previously tried wrong choice, still pressable; keyboard 1/2/3 still works; the same question remains on screen.
- Feedback area: forced finish shows the correct answer (existing area, "Now you know!" style) and a short debuff notice.
- Fit 1366×768, 1024×768, 1180×820 with no scrolling.

## Saved data
Existing saved races (no debuffs, no attempt tracking) must load unchanged: missing fields default to none; nothing is converted lossy. Add fields only; old clients/tests keep working through normalization.

## Delivery
1. Code (Codex Luna high): server rules, state, public projection, frontend, achievements, tests, docs, with a placeholder snail (🐌) and placeholder badge cells.
2. Art (Codex imagegen): complete. Exactly two new storybook medallions appended
   at indexes 16/17 in the 1024×1280, 4×5 Road Racing sheet; indexes 0–15 retain
   pixel-identical 256px cells and the last two cells are transparent. Exact
   prompts, reference roles and measured bounds are recorded beside the art.
   Keep the matching ⚡ buff and 🐌 debuff emoji; no custom effect icon is wanted.
3. Review (Sonnet 5.5 medium) after each step; Haiku runs the tests; Playwright pass playing a race with spam answers.

## Art-step validation — 2026-10-28

- Git HEAD's decoded atlas equals the expanded sheet's top 1024×1024 RGBA
  bytes, also checked separately for each original cell. New alpha bounds and
  transparent empty cells match `art-layout.json`.
- Server typecheck/build and the 38 focused Road Racing/catalog assertions pass.
  Frontend typecheck, hosting typecheck, normal/Vercel builds and the new
  64px/96px badge render regression pass. Private artwork catalog regenerated
  locally; no upload performed.
- Full frontend suite: 126/127 test files pass; the performance-report test
  cannot spawn Node (`EPERM`). Full server suite: 130/131 files pass; the Node
  adapter test cannot listen on localhost (`EPERM`). These sandbox limitations
  were reproduced in isolation; no unrelated test changes were made.
- Headless agent-browser cannot launch because its socket directory is read-only.
  No browser screenshots or complete race UAT were obtained. Disposable database
  integration remains unverified (`TEST_DATABASE_URL` is not configured).
