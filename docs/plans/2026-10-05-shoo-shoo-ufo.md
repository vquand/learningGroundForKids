# Shoo Shoo UFO

Status: Implemented on `feature/explorer-ufo-word-game`, verified locally, and prepared for a user-requested review branch push. No cloud resources or production deployments were changed.

## Agreed experience

English-only vocabulary practice for Explorers aged 5–8, reached from the playground activity menu. Practice has no XP or learning-completion credit. Each session fixes difficulty, animal, and background; changing them starts a new session. A returning Explorer chooses Resume or Start fresh.

- Easy: egg icon, 200 everyday English words, two letter hints per word.
- Medium: hatching chick icon, 60 curious/basic scientific words, one hint per word.
- Hard: grown chicken icon, 30 uncommon child-appropriate words, one hint per word.
- Difficulty labels sit below icons. Each word has a visible short clue.
- On-screen A–Z and physical keyboards reveal every occurrence of a guessed letter. Previously used letters cannot cost another mistake.
- Hints choose a random distinct unrevealed letter and reveal all occurrences. Hints reset each word and never accumulate. A hint completing a word counts as a success.
- Wrong guesses advance the UFO one of ten steps. At step nine a beam reaches the animal. At step ten the animal calmly floats into the UFO, peeks with a gently surprised expression from its window, the beam retracts, and the UFO departs.
- Completing a word adds one shoo charge, capped at three, without resetting the UFO. Each deliberate shoo press spends one charge to restore one step of allowance. The UFO cannot retreat past its original position. A server-enforced 500 ms cooldown and ignored held-key repeats prevent accidental spending.
- A solved word shows its spelling and meaning for about five seconds, then automatically advances at the same difficulty. Session words-solved count persists until restarting.
- More than 15 seconds without interaction triggers a harmless nap with zzZ. Interaction wakes the animal. Time never advances the UFO.
- Capture reveals the word and meaning and offers Play again. Restart preserves settings but resets word, danger, charges, and session count.
- Seen words persist per Explorer and difficulty across sessions. Exhausted pools reshuffle, excluding the previous word when at least two words exist. A one-word admin pool necessarily repeats.

## Art and sound

Tapping or clicking an animal in the field wakes it, switches to its happy pose, gives it a gentle jiggle, and emits a chubby heart above its head. The reaction has a one-second client cooldown and never changes game progress. Keyboard button activation is supported; held-key repeats are ignored. Capture uses separate surprised facial expressions for all four animals.

All friends and places are initially unlocked. Dairy cow, Highland cow, and sheep chew grass; capybara munches an apple. Each has idle, eating, sleeping, happy reaction, and surprised capture artwork. The in-scene animal is scaled down 20% from the initial version (19.2% of scene width), centered over the ground patch. Farmhouse, forest, and lake scenes use generated raster pastel backgrounds. UFO and ground share the rounded pastel style. CSS animates poses, flight, beam, capture, and departure, respecting reduced-motion preferences.

Six generated PNG atlases are checked in under `frontend/public/minigames/ufo/`: animals, corrected capybara eating pose, surprised capture poses, backgrounds, props, badges. Atlas ordering is declared by `UfoArt.tsx` and server achievement definitions. Sound effects are gentle locally synthesized sine tones through Web Audio, with a remembered mute toggle; no background music.

## Lifetime achievements

Each profile permanently accumulates words solved, medium/hard successes, shoo uses, and per-animal successes/captures. The badge collection displays all 15 logos and progress, and the game links to that section.

| Achievement | Requirement |
| --- | --- |
| First Word! | 1 word solved |
| Word Gardener | 25 words solved |
| Word Wizard | 100 words solved |
| Curious Mind | 10 medium words solved |
| Hard Word Hero | 3 hard words solved |
| Shoo Shoo! | 10 shoo charges used |
| MOO MOO NO NO | Dairy cow captured 5 times |
| Fluffy Flight | Highland cow captured 5 times |
| Sheep in Space | Sheep captured 5 times |
| Capy Cosmic Trip | Capybara captured 5 times |
| Milk & Letters | 10 words solved with dairy cow |
| Highland Scholar | 10 words solved with Highland cow |
| Woolly Wordsmith | 10 words solved with sheep |
| Capy Clever | 10 words solved with capybara |
| Farm Friends | 5 words solved with each of four animals |

Future friends, achievement-gated unlocks, other languages, and learning rewards are outside this version.

## Admin dictionary and API

`/admin/ufo` offers searchable, paginated CRUD for word, clue, meaning, and difficulty. Words are uppercase A–Z, 2–18 characters; duplicate spellings are rejected across difficulties. Required clue/meaning fields have bounded lengths. Load master dictionary adds only missing spellings and preserves custom entries and edits. A renamed entry is preserved while the original spelling can be added again. Words in active sessions remain immutable snapshots after edits/deletions.

- GET `/api/v1/profiles/:profileId/ufo`: saved session and achievements.
- POST `.../ufo/start`: `{ revision, settings: { difficulty, animal, background } }`.
- POST `.../ufo/action`: `{ revision, action: { type: "guess", letter } }`, or type `hint`, `shoo`, `next`.
- GET/POST `/api/v1/admin/ufo/words`; PUT/DELETE `.../words/:wordId`.
- POST `/api/v1/admin/ufo/words/master`: additive checked-in dictionary loader.

The existing cookie authentication, host/origin controls, and admin gate apply. Profile ownership is checked before every gameplay operation. Strict request schemas reject client-supplied scores, charges, hints, identities, and completion state. Playing responses hide the answer and meaning. PostgreSQL transactions lock profile state and reject stale revisions, preventing concurrent tabs or request retries from awarding achievements twice. Cooldown and celebration timing are authoritative on the server.

## Database and operation

Migration `server/drizzle/0012_shoo_shoo_ufo.sql` adds `ufo_words` and `ufo_progress` with profile cascade deletion. Drizzle snapshot/journal and rollback fixtures are included. Only the guarded local dev database was migrated. Production deployment/migration remains a separate release operation.

The operator applies the migration in the target environment, then uses the admin Load master dictionary button to populate words. Empty difficulties show a helpful error rather than silently using another difficulty. Runtime credentials remain in environment/platform configuration.

On 2026-10-22, the English master dictionary gained 100 easy entries: 30 animals,
20 fruits, 25 foods, 8 drinks, and 17 vehicles. English now has 200 easy, 60 medium,
and 30 hard entries. The Vietnamese dictionary is unchanged. Use Load master
dictionary once to add the new words to an existing installation; repeated loads
preserve administrator edits and player progress. The review copy is
`docs/game-design/ufo-word-dictionary.json`, matching `server/src/ufo/dictionary.ts`.

Local preview: API via `npm run dev:local --prefix server`; frontend via `npm run dev:uat --prefix frontend -- --host 127.0.0.1 --port 5173`. Port 5173 matches current local allowed origins.

## Verification and UAT

Automated rule tests cover repeated letters, duplicate guesses, hidden answers, hint-assisted completions, hint reset, five-second advance, charge cap, danger persistence, cooldown, capture at ten, immutable snapshots, and lifetime counters. API tests cover anonymous/foreign-profile rejection, admin permission, invalid letters, and forged scores. Local database integration covers actual migration, additive loader/edit preservation, duplicate prevention, persisted sessions, snapshot survival on deletion, and racing-tab revision enforcement.

`frontend/tests/ufo.browser.mjs` exercises the real local API and UI with temporary isolated family/profile records, cleaned up afterwards. It requires the guarded dev environment and an existing Playwright module (`PLAYWRIGHT_MODULE` may point to its index.mjs) and optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Run from the repository root:

```bash
node --env-file=server/.env_dev --import ./server/scripts/local-db-guard.mjs \
  --import ./server/node_modules/tsx/dist/loader.mjs frontend/tests/ufo.browser.mjs
```

Browser evidence: `/tmp/plg-ufo-browser/` has setup, gameplay, celebration, nap, warning beam, capture, badge, admin, and responsive screenshots. The test verifies CRUD/master load, setup, hints, both keyboards, solve/advance, shoo, resume, nap, capture/restart, 15 badges, no page errors, and no horizontal overflow at 320/390/768/1024 pixels.

User UAT: try all four friends and backgrounds; complete words with guesses and hints; spend charges; wait for naps; reach warning/capture; return and resume; start fresh; inspect achievements; add/edit/delete a dictionary word and reload master data. Confirm art, sound, clue quality, age-appropriate difficulty, and capture timing. Do not merge/publish until the user explicitly approves release.
