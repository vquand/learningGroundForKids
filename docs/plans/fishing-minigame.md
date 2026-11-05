# Fishing Friends — first-release design and implementation

Status: First-release bait/catch tables, rewards, wait, and graduation targets
approved. Unlimited fishing is the current scope; future access/stay mechanics
remain deferred. First-release gameplay and integration are implemented locally.
Branch: `feature/cozy-fishing`.

## Confirmed direction

- A child chooses Highland Cow, Capybara, or Dairy Cow as a fishing friend.
  The friend sits beside water with a rod, waiting for fish. Fishing/picnic
  props and ambient wildlife make the scene feel inhabited.
- All characters and locations are cute, cozy, chubby, pastel, and outlined,
  including later spooky settings. Use big eyes or simple `-.-` eyes.
- Each bait focuses on a specific math skill. Correctly solving its question
  produces that bait. Bait choice determines eligible fish and catch odds.
- Each caught fish awards Town Building stamina and fishing points. Location
  graduation/unlocks use fishing points, with sequential advancement.
- The first content release contains a normal pond with an ambient frog and
  a river near town. Other locations are future design, not launch scope.
- User answer 1: catching resolves automatically after waiting; no reaction,
  reel timing, or tension minigame.
- User answer 2: one correct answer earns one bait; wrong answers allow retries.
- User answer 3: the first two locations offer addition, subtraction,
  multiplication, and exact division. Fractions/decimals come later.
- User answer 4: there is no fixed two-to-three-species limit. A bait may
  attract one or several logical catches, including non-fish such as turtles.
  The same fish can inhabit more than one appropriate location.
- User answer 5: bait types unlock with the location where they become useful.
- User answer 6: an empty cast consumes one bait and awards no stamina or points.
- User answer 7: start with 60 pond / 180 river fishing points; tune after play.
- User answer 8: approve the seven first-release baits, both catch catalogs,
  catch odds, rewards, and eight-second wait as proposed.
- User answer 9: do not introduce fishing/stay limits now. Future limit
  mechanisms are deferred; they are not required for the location roadmap.
- User answer 10: keep fish for later aquariums or meal making. The selected
  option releases turtles; record their discoveries and catch rewards normally.
- Approved animation direction: use expressive cartoon sweat drops, annoyance
  squiggles when an unsuccessful cast pulls up garbage, and floating hearts
  when the friend catches something. Reactions remain cute and playful.

The first-release tables and targets below are approved. Future locations,
baits, fish, and equipment remain concepts. The working title, achievement
proposal, and future consumption/display systems are not implied approvals
for additional content. First-release behavior follows the approved tables.

## Player flow and animation

1. Choose a friend and an unlocked location. Keep the selected friend between
   visits; switching friends is free and has no effect on catch probabilities.
2. Start the session once, even with an empty bait box. Select the math skill
   to practice and earn one bait per correctly answered server-issued question.
   Retries are allowed; no answer timer; solved questions award only once.
3. The friend consumes a compatible bait and fishes for eight active seconds.
   Math questions and answers continue independently in the right sidebar.
4. Resolve automatically with a fish/garbage reveal, emote and verified rewards.
   Show the reveal for two seconds, then cast again automatically. Prefer the
   selected bait when stocked; otherwise use the easiest compatible stocked bait.
5. With no compatible bait, keep the session armed and show an annoyed squiggle.
   A correctly answered question immediately supplies bait and restarts fishing.
   Never require a new Start/Continue click for each bait or catch.
6. Explicit pause, hidden tabs, badges and collection dialogs stop the session.
   Continue resumes the same paid cast; no offline catchup or reroll.
7. Friend selection is available even with a saved cast. Changing friends pauses
   while preserving the paid bait, outcome and remaining time; location changes
   wait for the current cast to finish.

Approved fish handling: add each fish to a persistent, profile-owned catch
inventory and record its discovery in the illustrated journal. Track owned
quantity by species so fish can later be assigned to an aquarium or consumed
in meal making. Record each catch identity once, together with its rewards.
Release turtles with a friendly splash while retaining their journal records,
catch counts, stamina rewards, and fishing points; turtles are not meal items.

The first release stores fish for those future uses. It does not implement an
aquarium, fish recipes, selling, or another consumption reward system. Later
use must debit owned quantities authoritatively and preserve historical
discoveries; it must never replay the original catch rewards.

There is no daily cast cap, maximum outing duration, comfort/temperature meter,
forced return, or location access fee in current scope. The only per-cast
requirement is an earned compatible bait. The eight-second wait controls the
animation/result cadence, not how long the child may stay at a location.

Pause active waiting when hidden, leaving the page, opening badges/collections, or
opening pause. Preserve the same committed cast on return; do not reroll or
consume another bait. Repeated result reveals never repeat rewards. Reduced
motion keeps the scene readable with short fades and calm poses.

### Cartoon reactions and garbage reveals

Use the same expressive language for Highland Cow, Capybara, and Dairy Cow.

| Moment | Friend pose and emote | Result behavior |
| --- | --- | --- |
| Waiting/anticipation | Calm breathing and blinking; an occasional large forehead sweat drop can add comic anticipation | Cosmetic only; no discomfort meter, time limit, or penalty |
| Fish caught | Bright eyes, a delighted smile, a small rod/body bounce, and a heart floating above the head | Reveal the fish and approved rewards; retain it in inventory once |
| Turtle caught | A warm smile and floating heart, then a gentle goodbye/wave | Record the approved rewards/discovery, then release the turtle |
| Nothing caught | Pull up an old boot, a small rounded can, or a soggy leaf/twig; use a sheepish sweat drop, `-.-` eyes, and a wiggling/twirling frustration squiggle above the head | Consume the cast's bait and award zero stamina/points; do not add garbage to fish inventory |
| After a reveal | Let the brief emote fade and return to the relaxed fishing pose | Keep the next explicit action available without a mandatory extra dismissal |

Garbage is the visual presentation of the already approved no-fish outcome,
not a new outcome added on top of its probability. The existing 10%/20%
"nothing" probabilities and fish rewards remain unchanged. Garbage variants
can vary cosmetically; they introduce no collection, cleanup currency, extra
graduation progress, or separate reward system.

Keep disappointment brief, humorous, and directed at the unlucky catch. Wrong
math answers retain encouraging retry feedback rather than the annoyed pose.
Sweat and squiggles never imply damage, forced departure, or bait changes.

Draw emotes as separate transparent layers anchored to each friend's forehead
or above their head, accounting for horns and ears. Keep the rod, caught item,
and overhead emotes inside the scene bounds without covering controls. Pause
emote animation with gameplay; reduced motion uses a static emote or short
fade instead of bobbing, bouncing, or repeated squiggle movement. Result copy
also identifies the catch/garbage and rewards so meaning does not rely on art.

## Bait curriculum

Difficulty is relative to the skill, not a verified age rating. The first two
rows deliberately practice addition at different operand ranges. Each row
uses one operator/skill; harder tiers do not randomly introduce other operators.
All rewards are one bait per correctly solved question, with retries allowed.

| Bait | First unlock | Difficulty | Question rule | Example |
| --- | --- | --- | --- | --- |
| Baby Bait | Little Pond | Starter | Result-only addition, each operand 1–29, without carrying. | 18 + 1 = 19 |
| Corn Bait | Little Pond | Easy | Addition of two integers, each 30–100 inclusive. | 81 + 67 = 148 |
| Worm Bait | Little Pond | Medium | Subtraction within 0–100, larger operand first; emphasize borrowing. Zero answers allowed. | 74 − 38 = 36 |
| Leafy Bait | Little Pond | Easy | Subtraction within 0–29, larger operand first; no negative answers. A vegetable nibble for the storybook turtle. | 26 − 9 = 17 |
| Bouncy Bait | Village River | Medium | Multiplication of two factors, each 2–5. | 4 × 5 = 20 |
| Crunchy Bait | Village River | Hard | Multiplication of single-digit factors 2–9, with at least one factor 6–9 and product below 60. | 8 × 7 = 56 |
| Scholar Bait | Village River | Hard | Exact division: divisor and quotient each 2–12; dividend is their product, at most 144. | 96 ÷ 8 = 12 |
| Honey Bait | Town Lake, future | Hard | Addition of three integers, each 20–99. | 36 + 47 + 28 = 111 |
| Mountain Bait | Mountain Lake, future | Advanced | Two-digit integer 12–99 multiplied by one-digit integer 2–9. | 24 × 7 = 168 |
| Snowflake Bait | Snowy Mountain River, future | Hard | Subtraction of three-digit integers with borrowing; no negative results. | 402 − 178 = 224 |
| Snowball Bait | Ice-Hole Hideaway, future | Advanced | Exact division: dividend 100–999, divisor 2–9, quotient 10–99. | 432 ÷ 8 = 54 |
| Lantern Bait | Underground Pond, future | Hard | Missing addend in an addition equation: known addend 20–99, total 40–199, positive missing value. | □ + 47 = 120; □ = 73 |
| Ancient Bait | Dinosaur-Era Lake, future | Advanced | Multiplication of two integers, each 11–39. | 24 × 13 = 312 |
| Frost Bait | Ice-Age Sea, future | Advanced | Exact division: three-digit dividend, divisor 10–25, quotient 10–49. Generate only valid products under 1,000. | 672 ÷ 24 = 28 |
| Ember Bait | Lava Pond, future | Advanced | Addition with one or two decimal places, operands 0.10–99.99. Accept equivalent decimal forms. | 3.75 + 2.60 = 6.35 |
| Starlight Bait | Elven Moonlake, future | Advanced | Addition of two proper fractions with the same denominator, 2–12. Accept equivalent exact answers. | 2/7 + 3/7 = 5/7 |
| Pudding Bait | Little Demons' Sulfur Lake, future | Advanced | Subtraction with one or two decimal places, operands 0.10–99.99; no negative answers. | 8.50 − 3.75 = 4.75 |
| Mythic Bait | Ghostlight River, future | Advanced | Multiplication of two proper fractions, denominators 2–12. Accept equivalent exact answers. | 2/3 × 3/4 = 1/2 |

Approved launch roster: seven baits. Little Pond unlocks Baby, Beginner, Chewy,
and Leafy. Graduating from the pond unlocks Village River and Bouncy, Crunchy,
and Scholar. Unlocking permits earning the bait through math; it does not
grant free bait. Unlocked baits remain available on return visits. Baits persist
between sessions and are earned through math, not stamina purchases. The child
chooses among the unlocked skills. Each future location proposes one new bait
as shown above; unlocked earlier baits can still work wherever compatible.
These later math skills are a proposed menu, not a requirement for the first
release or a claim that every later location must use a harder math topic.
Future bait tiers are not implemented now.

Suggested bait forms: tiny dough drop (Baby), plump corn nibble (Beginner), soft
chewy worm (Chewy), leaf/vegetable nibble (Leafy), springy grub (Bouncy), rounded
cricket (Crunchy), and a special golden wriggly worm (Scholar). These are
storybook collectibles, not instructions for real-world animal handling.

## Launch location 1 — Little Pond

Starts unlocked. Warm grass, a normal small pond, lily pads/reeds, one ambient
frog, a picnic blanket, and the selected friend sitting on the bank. No weather,
access challenge, comfort limit, or timed catch input in the first release.

| ID | Fish | Visual identity | Stamina per catch | Fishing points per catch |
| --- | --- | --- | ---: | ---: |
| P1 | Button Minnow | Tiny, round, silver-blue body and oversized eyes | 1 | 1 |
| P2 | Sunny Goldfish | Plump apricot body and a soft fan tail | 2 | 2 |
| P3 | Pebble Carp | Chubby sage fish with rounded whiskers | 3 | 2 |
| P4 | Round Bluegill | Wide sky-blue body and soft striped cheeks | 4 | 3 |
| P5 | Ribbon Koi | Cream-and-coral patches and a flowing rounded tail | 6 | 4 |
| T1 | Little Pond Turtle | A gentle round-shelled visitor with tiny feet; non-fish bonus catch | 2 | 2 |

Approved catch table, conditional on the chosen location. Every percentage is
an absolute per-cast probability; rows sum to 100%. No hidden rarity roll.

| Bait | Eligible fish and probability | Nothing |
| --- | --- | ---: |
| Baby | P1 60%; P2 20% | 20% |
| Beginner | P1 20%; P2 50%; P3 20% | 10% |
| Chewy | P3 45%; P4 35%; P5 10% | 10% |
| Leafy | T1 80% only | 20% |
| Bouncy | P2 15%; P4 60%; P5 15% | 10% |
| Crunchy | P3 15%; P4 30%; P5 45% | 10% |
| Scholar | P3 10%; P4 30%; P5 50% | 10% |

This preserves the requested Baby example: small fish 60%, small-medium fish
20%, and nothing 20%. Species size and rarity determine 1–4 fishing points: small common fish start at 1; large/rare fish reach 4. Stamina remains separate. Existing earned rewards are preserved.

## Launch location 2 — Village River

Shown on the location map but locked until Little Pond graduation. A gentle
river near town, a small bridge in the background, smooth stones, bank reeds,
and a picnic basket. The friend still sits safely on the bank. New fish and
rewards provide the first step up; current and weather are visual in this release.

| ID | Fish | Visual identity | Stamina per catch | Fishing points per catch |
| --- | --- | --- | ---: | ---: |
| R1 | Silver Dace | Small plump silver fish with mint fins | 3 | 2 |
| R2 | Striped Perch | Round golden fish with gentle cocoa stripes | 4 | 3 |
| R3 | Speckled Trout | Rosy chubby fish with large, sparse freckles | 6 | 3 |
| R4 | Whisker Catfish | Soft lavender body and floppy curved whiskers | 8 | 4 |
| R5 | Round River Pike | Plump olive body, rounded nose, and big calm eyes; no frightening teeth | 10 | 4 |
| P1 | Button Minnow | Same fish as the pond; found in calm river shallows | 1 | 1 |
| T1 | Little Pond Turtle | Same friendly visitor; found only beside the quiet bank | 2 | 2 |

| Bait | Eligible fish and probability | Nothing |
| --- | --- | ---: |
| Baby | P1 50%; R1 30% | 20% |
| Beginner | R1 60%; R2 20% | 20% |
| Chewy | R1 20%; R2 50%; R3 20% | 10% |
| Leafy | T1 80% only | 20% |
| Bouncy | R2 20%; R3 55%; R4 15% | 10% |
| Crunchy | R3 25%; R4 40%; R5 25% | 10% |
| Scholar | R3 15%; R4 30%; R5 45% | 10% |

Shared catches keep the same species identity and reward in both locations;
track where each was discovered for the local journal. New river baits can also
be used at the pond with that location's table. No fixed species-count quota
applies to bait: Leafy targets one catch, others target two or three here.

Never allow an incompatible bait to be spent on a guaranteed-empty cast. Show
the compatible fish and exact odds before the child casts. Switching friends
does not change these probabilities.

## Fishing points and graduation

Approved initial values, subject to later playtest tuning:

- Little Pond: graduate at **60 local fishing points**, permanently unlocking
  Village River. No requirement to obtain every fish first.
- Village River: graduate at **180 local fishing points**. Until more content
  is released, celebrate graduation and show the next location as coming later.
  Do not allow entry to unimplemented locations.
- Each location has its own cumulative point counter. Also show lifetime total
  fishing points. Earlier-location catches cannot fill a later location's bar.
- Graduation is permanent. Returning to an earlier location remains free; point
  totals, journal discoveries, bait inventory, and badges survive a new visit.
- Catches award the listed stamina and points once. Confirmed: empty casts
  consume one bait and award zero of both.
- No additional stamina for merely earning bait, waiting, reopening a result,
  reaching a point threshold, or switching a location/companion.

Expected values help review the pacing; they are averages, not guarantees:

| Bait | Pond expected FP/cast | Pond expected stamina/cast | River expected FP/cast | River expected stamina/cast |
| --- | ---: | ---: | ---: | ---: |
| Baby | 1.00 | 1.00 | 1.10 | 1.40 |
| Beginner | 1.60 | 1.80 | 1.80 | 2.60 |
| Chewy | 2.35 | 3.35 | 2.50 | 3.80 |
| Leafy | 1.60 | 1.60 | 1.60 | 1.60 |
| Bouncy | 2.70 | 3.60 | 2.85 | 5.30 |
| Crunchy | 3.00 | 4.35 | 3.35 | 7.20 |
| Scholar | 3.10 | 4.50 | 3.45 | 7.80 |

The updated point scale lengthens graduation with the unchanged 60/180 targets.
Targets remain cumulative across visits and can be tuned after playtesting.
There is no collection guarantee or requirement to finish in one sitting.

## Future location and fish proposals

Only the first two locations are launch scope. The following list is a creative
roadmap for approval, not an implemented or fully balanced catalog. Fish names
are storybook designs rather than claims of historical species accuracy.
Future rewards, exact compatible baits, odds, and graduation thresholds require
their own complete approval tables before implementation.

| Order | Location | Proposed fish | Atmosphere and future progression concept |
| --- | --- | --- | --- |
| 3 | Town Lake | Dock Bream; Picnic Tench; Blue-Ribbon Bass | A deeper-water dock and picnic setup |
| 4 | Mountain Lake | Cloud Trout; Pebble Char; Little Summit Salmon | A mountain trail reveal and wind shelter |
| 5 | Snowy Mountain River | Snowcap Trout; Mittens Grayling; Frostfin | Warm picnic supplies, fluffy coats, and falling snow |
| 6 | Ice-Hole Hideaway | Snowball Cod; Crystal Smelt; Pompom Whitefish | A cozy ice tent, mittens, and a thermos |
| 7 | Underground Pond | Lantern Loach; Button Cavefish; Glowbelly | A lantern-lit route and friendly cave wildlife |
| 8 | Dinosaur-Era Lake | Fernfin; Bubbleback; Pebbleplate | A storybook time portal and gentle giant-dinosaur visits |
| 9 | Ice-Age Sea | Woolly Cod; Frost Herring; Tuskfin | A sheltered shore camp between snow flurries |
| 10 | Lava Pond | Marshmallow Magmafish; Ember Guppy; Obsidian Puffer | A fantastical heatproof rod and cool picnic shade |
| 11 | Elven Moonlake | Moonfin; Petal Koi; Stardrop Fish | A gentle route through magical reeds and firefly lanterns |
| 12 | Little Demons' Sulfur Lake | Lemon Puffer; Pudding Impfish; Bubblehorn | Cute tiny demons and a cooling canopy; no realistic fumes/harm |
| 13 | Ghostlight River | Sheetghost Guppy; Lantern Eel; Sleepy Phantomfish | Friendly round ghosts guide the boat beside soft lanterns |

Town Lake is placed after the requested first two locations. Its position can
change in review without changing the explicitly requested first release.

Recommendation for later progression: graduate the preceding location, unlock
new focused math/bait choices, introduce suitable fish with approved odds and
rewards, and set the next graduation target. Continue allowing unrestricted
visits. Weather, cold, heat, and lanterns provide atmosphere for now; they do
not drain resources or force departure. No additional access/stay systems are
approved. If such mechanics are revisited later, design them separately.
Historical/fantasy equipment is set dressing until acquisition/gameplay rules
are explicitly approved.

## Launch achievements

Named group: **Fishing Friends**. All badges use the universal illustrated,
text-free storybook medallion style. Names/conditions/difficulty stay outside art.

| Achievement | Unlock condition | Difficulty and reason | Badge pictogram |
| --- | --- | --- | --- |
| First Nibble | Catch any fish once | Easy: first successful cast | A tiny minnow beside a float |
| Pond Champion | Reach the approved pond graduation threshold | Medium: sustained pond fishing and math | A pond lily with a small graduation cap |
| River Champion | Reach the approved river graduation threshold | Hard: sustained river fishing and harder bait choices | A river curve beneath a bridge |
| Pond Fishbook | Discover all six pond catches, including the turtle | Hard: varied bait and random catches | An open book with a pond fish fan |
| River Fishbook | Discover all seven river catches, including the shared minnow and turtle | Hard: varied river bait and random catches | An open book with a striped river fish |
| A Full Bait Box | Earn at least one of each of the seven launch baits through math | Medium: demonstrate all seven bait skills | Seven small pastel bait compartments |
| Good Company | Complete a successful catch with each of the three animal friends | Easy: try every companion | Three rounded friend silhouettes and a rod |

Implement the complete group in kid badges and both Parent/Admin child reports.
Provide the authenticated, admin-only idempotent catalog migration. Definitions
alone are catalog-only; show not-yet-earnable status until authoritative math,
catch, and progress grading are implemented. Never grant earned badges from
browser-reported scores or completions.

## System integration and acceptance constraints

- Use the active React/Vite frontend, authenticated Render API, and PostgreSQL
  persistence. Same-origin requests; existing family/profile ownership checks.
- The server owns issued questions/answers, bait balances, cast identity,
  probability sampling, catch results, rewards, points, and unlocks. Grade the
  issued question; never trust client-provided answers-to-check, fish IDs,
  probabilities, random seeds, score totals, elapsed time, or reward amounts.
- Persist one committed cast/result and deduplicate completion. Stamina credit
  and fishing progress, journal records, and retained fish quantities must
  commit atomically with the verified catch. Cross-tab requests, retries,
  reloads, and lost replies cannot consume/award twice. Turtle catches award
  progress/rewards but do not increment retained fish inventory.
- Preserve all existing Town rewards and earned badges. The child chooses the
  bait; there are no hidden friend bonuses, odds changes, purchases, or trading.
- Use shared Back to Playground, language selection, and the generated Badges
  icon immediately beside the language control. Keep interface translations
  separate from math-content language.
- Setup, location/friend/bait selection, math, waiting, pause, reveal, journal,
  graduation, failure/retry, and replay must fit without scrolling at 1366×768,
  1024×768, and 1180×820. Use pagination for collections; retain 48px controls.
- Generate/approve artwork before integrating it. Do not make later locations
  reachable through placeholder scenes. Reduced motion and muted audio work.
- Test strict ownership, question replay protection, exact probability tables,
  deterministic boundary rolls, idempotent bait/catch rewards, concurrent casts,
  pause/reconnect behavior, sequential unlocks, reports, and required viewport
  flows. Keep generated evidence local under `/tmp` or ignored output paths.

## Approval record and deferred work

Answers 1–10 are recorded above. The first-release tables incorporate them.
The user requested a recommendation on answer 9 while explicitly excluding
limits from current scope. The recommendation is unrestricted visits, with
progression through math/baits, fish catalogs, and graduation targets. No
limited-cast outings, comfort meters, or timed access mechanics are included.

The user subsequently approved continuous sessions: start once, then repeat
eight-second casts automatically while compatible bait remains. Math runs in
parallel and newly earned bait wakes an empty session. There is no reaction-speed check. The approved
turtle catch is a gentle fictional visitor without an injury scene.

Future aquarium placement, meal recipes, fish consumption, later location
catalogs, and their tuning require separate design before implementation.

## Implementation and local validation

- Implemented `/fishing`, both locations, all seven bait skills and exact odds,
  the three companions, eight-second automatic catches, pause/recovery, fish
  quantities, turtle release, journal and local graduation thresholds.
- Render issues and grades questions, commits hidden catch outcomes, and applies
  inventory, discoveries, achievements and Town stamina atomically. Revisioned
  commands and a catch provenance ledger prevent replayed rewards.
- The seven earnable achievements appear in the shared kid Badges dialog and
  kid badge page, both Parent/Admin reports, and the admin catalog migration.
  Shared Badges sits beside language selection; Back returns to Playground.
- Generated and integrated cozy pond/river, companion animation sheets,
  catch/prop sprites and universal medallions. Exact prompts and dimensions:
  `frontend/public/minigames/fishing/ART_PROMPTS.md`.
- Added migration `0026_fishing_friends` and development rollback support.
  Migrations were exercised only against an isolated disposable PostgreSQL
  database during initial implementation. The existing local UAT database was
  subsequently migrated during the runtime fix below; production was not changed.
- Server regression suite: 409 passed, zero skips, including transactional
  concurrency/replay/rollback/restart and both child-report projections.
- Frontend regression suite: 454 passed; frontend and hosting typechecks plus
  active Vercel and compatibility builds passed. All nine fishing browser tests
  passed after final artwork integration. They cover
  all three required viewport sizes, English/Vietnamese, 48px controls, no
  scrolling, math retries, catches, garbage/turtles, badges, collections,
  pause/recovery and sequential unlocks. Generated evidence stays local.

No commit, push, deployment, production migration or artwork upload performed.

### Local UAT connection fix

The first real UAT request failed with PostgreSQL `relation "fishing_progress"
does not exist`. The running API loaded bind-mounted fishing code, but the
completed init container did not rerun its schema migrations. Health checks
therefore allowed a warm stack to be reused with an older schema.

`scripts/start-uat.sh` now runs the existing guarded local migrator in a running
Compose API before reporting readiness. It applies only pending migrations,
without reseeding, resetting accounts or replacing database volumes. A failed
migration stops the launcher. Cold startup retains its existing init path.

Applied migration 0026 through the launcher to the existing local UAT database
and verified the previously failing profile fishing read succeeds. All twelve
launcher regression tests and all 454 frontend tests pass. Authenticated gameplay
flows retain the prior nine browser tests; no production database was touched.

### Friend selection polish

Setup and trip-choice cards now use separate ready-for-the-trip portraits with
packed picnic bags and resting paws. Highland Cow has long shaggy bangs covering
both eyes in ready and all fishing poses. A click on a card or the large preview
plays one brief chubby wiggle and a floating heart; greeting the already selected
friend is cosmetic. Reduced motion shows a still heart for the same short delay.

Location choices are a vertical list derived from the shared catalog, with two
spots per page as the catalog grows. Selecting an unlocked location changes the
left preview background. Shared navigation, locks and saved progress are retained.

The four new transparent assets and exact built-in generation prompts are in
`frontend/public/minigames/fishing/READY_ART_PROMPTS.md`. Frontend regression tests
(454), ten fishing browser tests, application/hosting typechecks and both builds
pass. Browser checks cover all required viewports, greeting/reduced-motion behavior,
vertical location bounds and pond/river background switching.

### Continuous fishing and scene correction

The user replaced per-cast clicks with a continuous session and chose automatic
compatible-bait fallback. Math remains visible and usable while fishing proceeds;
empty stock shows the annoyed friend and a verified new bait restarts the cast.
Rewards now follow the species 1–4 point scale above; past rewards stay intact.

The question panel is inline in the sidebar. Highland fur is simplified with
long bangs covering both eyes. Float anchors share each sprite's coordinate frame
and movement. Pond lotus leaves and the frog sit farther away, leaving open water
at the float. The 152px picnic basket draws in front of the companion.

Validation for the continuous-session revision:

- Server: 413 tests passed with disposable PostgreSQL, including concurrent
  answers, automatic repeated catches, atomic reward rollback and provenance.
  Server typecheck and build passed.
- Frontend: 454 baseline tests, application/hosting typechecks, active Vercel
  build and compatibility build passed.
- Browser: all 16 scenarios have passing coverage across the full run and
  focused reruns. The full run found a Sync ordering race after a committed
  answer's reply was lost. Mutations now remain blocked until refresh installs
  the committed revision; recovery was reverified with a delayed refresh,
  plus pause/reload and pending-start/continue tests. Other scenarios cover
  three required viewports, parallel math through repeated catches, starvation
  and immediate wakeup, saved friend selection, slow heartbeat input, rewards,
  float anchors, both languages, badges, collections and graduation.

Test evidence remains local. The disposable test database and isolated browser
preview were stopped; the user's UAT stack and accounts remain intact. No commit,
push, deployment, production migration or artwork upload was performed.

### Bait-earning dashboard and question forms

While earning bait, the sidebar keeps all unlocked compatible bait counts and
the current location's retained fish quantities visible, including ×0 for
uncollected species. The shared server-owned inventory supplies these totals;
released turtles remain journal visitors. Fish have icons and names.

Questions use right-aligned column arithmetic, a rule above the result, and an
editable missing number in either operand or the result. The keypad sits beside
the equation with 48px targets and a Submit button. All variants retain the bait's
approved operator and operand bounds, with one unique nonnegative integer
solution. The server stores the answer and complete operands privately and
projects only a masked expression and visible layout. Older pending questions
keep their original grading and render in columns without a migration.

Annoyance now appears in a cream, thick-outlined thought bubble with trailing
dots. Only its lavender inner squiggle rotates; the bubble stays steady and
clears the location label. Existing pause/reduced-motion rules apply.

Validation: all 18 fishing browser scenarios pass, including English/Vietnamese
at 1366×768, 1024×768 and 1180×820, inventory quantities/zero states, column
placement, missing operands, three-digit results and Submit grading. All 454
frontend baseline tests and 414 server tests (with disposable PostgreSQL) pass;
the additional legacy-question regression passes in the focused 11-test reducer
suite. Application/hosting/server typechecks and frontend/server builds pass.
No commit, push, cloud write or production migration was performed.

### Vertical sidebar and cohesive pause/quit controls

The user replaced the side-by-side math/keypad layout with this vertical order:
bait box, fish basket, visible spacing, question, numpad. Bait type and Clear/Close
share a compact math heading so the whole layout fits without scrolling.

Pause game now occupies the topbar next to Back to Playground, using the same
pause icon and shared navigation treatment as InfiniDrill. Pause opens a native
Resume/Leave dialog; Back opens a matching quit confirmation. Continuing preserves
the current cast, question and entered answer. Badges remain beside language.

Validation for the vertical sidebar revision: all 19 fishing browser scenarios
pass, including the vertical question/numpad order, spacing, all required laptop
and iPad viewports in both languages, topbar placement, pause/quit dialog bounds,
keyboard isolation and preservation of an unfinished question through Resume.
All 454 frontend tests, application/hosting typechecks, active Vercel build and
compatibility build pass. Evidence stays local; changes remain uncommitted.

### Independent frog lotus perch

Generated `frontend/public/minigames/fishing/frog-lotus-leaf.png` with the built-in
image tool; exact prompts are recorded in `FROG_LOTUS_PROMPT.md` beside the asset.
`PondFrog` groups the leaf and original frog into a decorative pond element with
separate layers. Its optional child can replace only the frog for future
expressions; the leaf and pond background stay independent. The frog's breathing
animation uses a foot-level origin while the leaf remains steady. The perch
stays toward the far bank, clear of all companions' fishing floats.

Verified the transparent asset and layered placement in the headless browser,
454 frontend tests, application/hosting typechecks, Vercel/compatibility builds,
and four browser scenarios covering full flows and all companion float anchors
at all three required viewports. No production upload, commit or push performed.

### Bucket and quieter catch/progress labels

The user replaced the visible wicker basket with an open water-filled fish
bucket. `fish-bucket.png` was generated with the built-in image tool; the exact
prompt is recorded in `BUCKET_ART_PROMPT.md`. The bucket remains a separate
152px prop layer in front of the companion. Inventory and loading/result copy
now use Fish bucket in English and Vietnamese.

Catch possibilities retain icons/names and point rewards, with percentage
labels hidden. The empty outcome label is No fishy; authoritative catch odds
and garbage rewards are unchanged. Local progression now uses a 36px native
progress bar with current/target centred inside and no visible caption. Its
label and values remain available to assistive technology.

Validation: 454 frontend tests, application/hosting typechecks, both builds and
six affected browser scenarios pass. Browser checks cover all three required
viewports, both languages, fish/turtle/garbage rewards, inventories and controls.
The generated artwork catalog is current; no upload, commit or push performed.

### English and Vietnamese copy review

Reviewed the Fishing Friends interface, catalog names, achievement group and
report labels with Antigravity (`agy --print`) in headless mode. A second pass
checked the refined wording against automatic fishing, parallel math practice,
released turtles and the future aquarium/cooking features. Raw review output
stays under `/tmp`.

The reviewed copy uses Scholar Bait / Mồi thông thái, Pond/River Champion,
plain Reconnect instructions, encouraging retry feedback, consistent Ao Nhỏ /
Sông Làng names and noun-first point labels that also work for one point.
Submit remains the English action; its Vietnamese label is Trả lời. Retain the
user's No fishy and Fish bucket wording. Report labels describe bait types
earned and friends with successful catches. IDs, unlock conditions, rewards
and progress calculations are unchanged.

Translation coverage now includes conditional messages, dialog titles, success
notices and all seven achievement definitions. This also found and translated
the previously missing first-discovery and existing-journal messages.

Validation: 454 frontend tests pass; server tests pass (387 passed, 21 database
integration tests skipped without a disposable database). Application, hosting
and server typechecks, server build, active Vercel and compatibility frontend
builds pass. All 19 fishing browser scenarios pass after updating one setup
selector for the reviewed point label, including English/Vietnamese layouts at
1366×768, 1024×768 and 1180×820. No commit, push or publication performed.

### Neon SQL Editor handoff

Use `docs/migrations/neon-0026-fishing-friends.sql` after migration 0025 and
before deploying the Fishing Friends API. The complete script creates the two
fishing tables and records the exact canonical Drizzle hash/timestamp in one
transaction. It validates the prerequisite and rejects mismatched migration
history. Repeated runs with the matching ledger entry preserve player data.
Do not run it alongside another migration runner.

Validated against a disposable PostgreSQL 17 database: missing prerequisites,
incorrect prerequisite/current hashes, atomic creation, repeat-run preservation
of fish quantities and catch history, and a subsequent normal Drizzle migration
all pass. The canonical-migration drift tests, server typecheck and build pass.
The script was not applied to production.


### 2026-10-22: starter questions and descriptive bait names

Baby Bait now issues only direct addition-result questions using operands 1–29.
The ones digits sum to at most nine, so none requires carrying across a ten.
Both operands stay visible. Missing operands and regrouping remain on higher
bait tiers. Existing issued questions retain their original answer and bait
identity; later generation follows the new starter policy. No historical catch,
resource, balance or achievement is recalculated.

Beginner Bait is now **Corn Bait** (Mồi bắp); Chewy Bait is now **Worm Bait**
(Mồi giun). Their persisted IDs remain `beginner` and `chewy`, preserving existing
bait stock, question identities, odds and unlocks. No SQL migration is needed.


### 2026-10-22: bounded single-digit multiplication

All newly generated fishing multiplication uses two single-digit factors and a
product strictly below 60. Bouncy Bait retains factors 2–5. Crunchy Bait samples
only valid ordered pairs from 2–9 with at least one factor 6–9; 7×8=56 is allowed,
while 7×9=63 is excluded. All approved missing-number forms remain available on
these higher tiers. Exact division and other bait operators remain unchanged.

## Bait practice and sleep refinement (2026-10-23)

Submit grades the current response. Correct submissions keep the numpad open,
clear the entered answer and return the next server-generated question of the
same bait type in the same transaction as the single bait award. Wrong answers
keep their question and retry feedback. Close still dismisses practice.

Persist six recently issued math facts privately. Operand order for addition
and multiplication and missing-number positions do not create distinct facts.
Exclude these six facts from the next question, across reloads and dismissals,
while retaining approved ranges, borrowing rules, answer privacy and replay
protection. Already-issued legacy questions retain their original grading.

While the companion sleeps, hide the last fish/turtle/garbage reveal bubble and
its reward/discovery labels. This changes presentation only; waking preserves
normal catch presentation, inventories, progress and reward receipts.

Verification: 478 server tests including guarded database tests passed; all 21
existing fishing browser tests passed, including the new sleep-state regression.
An isolated agent-browser check verified eight consecutive same-bait answers
with six-fact exclusion and all three required landscape layouts. Both frontend
typechecks and all frontend/server builds passed; existing bundle warnings remain.
