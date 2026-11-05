# Infinidrill achievements

Infinidrill · Earth Expedition contains ten achievements with distinct art in
the shared `frontend/public/minigames/infinidrill/achievement-badges.png`
storybook medallion atlas, explicit conditions, and obtainment difficulty
levels. Its art follows
`frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`. The
reviewed catalog is `server/src/achievement-catalog.ts`.

| Badge | Difficulty | Condition in one expedition |
| --- | --- | --- |
| First Dig | Easy | Solve 1 main puzzle |
| Number Miner | Easy | Solve 10 main puzzles |
| Puzzle Prospector | Hard | Solve 50 main puzzles |
| Below the Surface | Easy | Reach 120 m |
| Deep Digger | Medium | Reach 720 m |
| Mantle Explorer | Hard | Reach 1,440 m |
| Cave Finder | Medium | Open a cave with 5 consecutive first-try answers under 15 seconds each |
| Bonus Brave | Medium | Solve a bonus puzzle on the first try |
| Workshop Master | Hard | Own all 20 upgrade parts |
| Core Champion | Legendary | Complete 18 layers and reach the core at 2,160 m |

Render issues questions and grades submitted answers. The shared pure engine
lives in `server/src/infinidrill/`; frontend modules re-export it for rendering
and isolated tests. Production gameplay sends same-origin profile-scoped
commands with revisions. Render locks the current state row, validates ownership,
and updates earned badge IDs/timestamps atomically with verified game state.
Answers and intermediate solutions are redacted from public state. Client clocks,
resource totals, depth, achievements, and identity are not accepted.

Current expedition state is saved for verification and resuming after navigation.
There is no answer history or separate analytics feed. Replay resets expedition
state and counters, preserving all earned badge timestamps. Legacy browser-only
expeditions have no trusted record and cannot be backfilled as earned badges.

Admin → Achievements previews the catalog and offers **Migrate achievement data**.
The admin-only action upserts the ten reviewed definitions atomically using stable
IDs; it is safe to repeat and never modifies earned badges or player progress.
“My Badges” displays the new group, including locked badges and earned dates.

Apply the checked-in `0016_infinidrill_achievements` schema migration through the
normal release workflow before using the endpoints. The admin button migrates
catalog data, not the database schema. No production migrations or deployment
are authorized by this feature task.

UAT: inspect all ten badges and difficulty labels; run the admin migration twice;
solve a main puzzle and verify First Dig in My Badges; leave and resume; replay
and confirm the earned timestamp remains. Check setup, gameplay, bonus choice,
bonus success/failure, workshop, pause, exit, core, and replay at 1366×768,
1024×768, and 1180×820 without scrolling.
