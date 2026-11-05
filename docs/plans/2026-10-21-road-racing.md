# Road Racing

Status: UAT confirmed on 2026-10-22; commit and push authorized on
`feature/animal-racing-minigame`. User-approved requirements are recorded in
`frontend/src/features/animal-racing/AGENTS.md`. Cloud changes and production
migration execution are outside this handoff.

## Experience

Seven selectable friends: capybara, crocodile, duck, goose, dairy cow, Highland
cow, chicken. A race uses the selected friend plus five distinct opponents.
The player lane is randomly assigned among six horizontal swimlanes and colored
blue; opponents' lanes are orange. A kinetic side-view camera follows near
center-left, briefly lagging during acceleration. Opponents may leave the view;
a compact centered row of chubby face portraits keeps all six placements
visible. First place is on the far right, last on the far left; the six equally spaced
slots represent rank, not course progress. Stable faces slide between slots
on overtakes. Finished racers retain the order of their server finish times.

One 1,200-unit course alternates land, water and rock obstacles. Each animal has terrain
strengths, normalized across the course to comparable overall odds. Opponent
pace variations are selected independently of answers. Setup offers three
server-owned pace levels: **Egg (Easy)**, **Hatched (Medium)**, and **Chicken
(Hard)**. Egg is selected by default. Chicken preserves the original opponent
pace exactly; Egg and Hatched let children compete with progressively less
frequent boosts. Terrain transitions, swimming and rock jumps are automatic;
birds only fly briefly over rocks. The internal `fence` terrain identifier stays
compatible with saved/server-owned timing. Steady correct answers target a roughly
two-minute race. Idle play finishes last; no speed, elapsed time or placement
supplied by the browser is accepted.

Terrain is one continuous raster surface across all lanes, with one shared
texture origin and smooth matching section boundaries. Lane lines and the blue
player highlight are translucent overlays. Separate side-view rocks sit above
the terrain; scenery continues before the start and beyond the finish.

## Questions and boosts

English and Vietnamese learning content are separate from the global UI locale.
Exactly three choice buttons, no typed answers, concise prompts under ten words.
The launch pool includes number comparisons, small-number addition/subtraction,
missing operands, animal pictures and Venn region counts. Arithmetic renders in
stacked rows like InfiniDrill. Comparisons render two numbers with an empty
square between them, and `<`, `=`, `>` choices. Previously seen question identities
are tracked within a race, with bounded selection and no repeats.

Correct answers add an independent two-second stack when fewer than three are
active. Existing expiries never extend; answers at the cap do not queue stacks.
Two stacks glow; three add lightning and separate two-/four-leg spin overlays.
Movement accelerates toward the current boosted speed and eases back as stacks
expire. Wrong answers grant no stack and do not remove active stacks. The old
question and correct answer move into a bubble above the incoming card.
There is no question deadline; keys 1–3 are optional choice shortcuts.

## Completion, leaving, and rewards

The server advances the fixed-step race using its clock. Placements come from
finish timestamps. A 750ms client heartbeat has a five-second server lease;
missing it forfeits rather than simulating an unattended race to completion.
Visibility change, page exit and explicit leaving forfeit. Reloading an active
race never resumes it. A late leave for an older race cannot affect a new race.
On return a gentle popup says the race cannot count and offers another race.

Only completed races contribute achievements. Sixth place grants no resources
but counts toward achievements, including Scenic Route. Forfeits discard pending
milestones, grant no resources, and reset the win streak. Any completed non-win
also resets that streak. Previously earned badges remain permanent.

| Place | Stamina | Wood | Wool |
| --- | ---: | ---: | ---: |
| 1 | 60 | 40 | 40 |
| 2 | 47 | 31 | 31 |
| 3 | 43 | 29 | 29 |
| 4 | 41 | 28 | 28 |
| 5 | 39 | 26 | 26 |
| 6 | 0 | 0 | 0 |

Second = first / 1.30; third = first / 1.40; fourth/fifth = unrounded third
multiplied by .95/.95². Round each resource up only after calculation.

## Architecture and achievements

- Frontend module: `frontend/src/features/animal-racing/`; route `/road-racing`.
- Server module: `server/src/road-racing/`, authenticated owned-profile routes.
- Private progress: `road_racing_progress`, canonical migration 0027 plus
  Drizzle snapshot/journal and a development rollback. No production execution.
  The [operator SQL handoff](../migrations/neon-0027-road-racing.sql) requires
  migration 0026 and records the exact 0027 hash and timestamp in Drizzle's ledger.
- Revisions and row locks serialize answers, heartbeat and completion. Race UUID
  identities deduplicate Town credits inside the same transaction as progress.
- Strict request schemas accept settings or choice indices, never answers,
  completion claims, definitions or reward amounts. Public views hide grading
  answers and future randomness. A minimum 180ms card delay prevents double taps.
- Sixteen server-verified achievements are defined in `achievements.ts` and the
  game guide. The existing admin migration UI installs the reviewed group
  idempotently. Shared reporting selects only lifetime stats and earned IDs,
  never private questions or race state. Kid, Parent and Admin display the same
  definitions, progress, conditions, difficulties and artwork.
- Generated animal/face/spin and badge assets and full prompts live under
  `frontend/public/minigames/road-racing/`. Artwork catalog regenerated locally.

## Verification

Meaningful reducer tests cover independent expiry, caps, bad/stale choices,
forfeits, all payouts, completed last place, permanent streak awards, bilingual
question uniqueness and a steady/idle simulation for all seven animals.
Disposable PostgreSQL tests cover persisted race completion, payout rollback,
retry deduplication, cross-profile authorization, catalog idempotency and shared
kid/Parent/Admin report projections. Run the required frontend/server tests,
typechecks and builds. Use headless agent-browser to check setup, live race,
all quiz types, boost tiers, results, leaving/replay and badge browsing at
1366×768, 1024×768 and 1180×820, with all controls within bounds and no scrolling.
Generated screenshots and logs stay under `/tmp` or ignored local directories.

Validation completed locally: 441 server tests passed with the disposable
PostgreSQL database (none skipped), 466 frontend tests passed, both server and
frontend typechecks passed, and server/Vercel/compatibility builds passed.
The agent-browser regression solved all four quiz kinds, reached three active
stacks, won a real race, and verified tab-leave forfeiture. Setup, live race,
winning results, badge collection and return popup fit all three required
viewports without scrolling or offscreen controls. A separate live sixth-place
finish verified zero resources and the First Finish/Scenic Route awards.
Terrain regression checks cover matching adjacent edges, a shared texture
origin, and smooth boundaries across all six lanes. Ranking checks cover
overtakes, exact ties, and stable arrival order at the finish.

## 2026-10-22 multiplication refinement

Arithmetic cards alternate the existing addition/subtraction forms with direct
single-digit multiplication (factors 1–9, product <50). Both factors remain
visible and the child chooses the product from three choices in the column
layout. The single-digit limit applies only to multiplication, as clarified by
the user. The full 400-card sequence remains nonrepeating in both languages.

### Reviewed animal question expansion

Integrated twenty user-approved standalone illustrations into English and
Vietnamese animal identification, for 27 picture species in total. The seven
playable friends and their achievements are unchanged. Questions cycle through
unseen picture species before fallback; approved artwork retains its original
bytes and proportions. No database migration is required.
