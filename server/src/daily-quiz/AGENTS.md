# Daily Quiz implementation guide

Follow `server/AGENTS.md` and the repository guide. Frontend layout and artwork
requirements below describe the shared Daily Quiz contract.

- Number every brainstorming and clarification question, with unique numbers
  within each batch and short lettered choices where useful. Preserve pending
  question numbers when restating them.
- Daily Quiz questions must use multiple choice with exactly one selection.
  Identity, grading, daily completion, streaks and rewards are server-owned.
- Every achievement belongs to a named group and defines a badge, clear unlock
  condition and difficulty. Distinguish catalog-only definitions from earnable
  achievements until server-verified grading and progress exist.
- Use the shared admin-only achievement migration for all reviewed server
  definitions. Keep migrations idempotent and preserve earned badges/progress;
  never accept browser definitions or group choices.
- Follow `frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md`:
  illustrated text-free storybook medallions with consistent frames, palette,
  linework and detail. Keep names, conditions and difficulty outside the icon.
- Include the complete achievement group in both Parent and Admin child
  reports through the shared server-owned projection. Unsupported progress is
  unavailable; never invent earned status or counts.
- Fit setup, settings, gameplay, results, failure and replay within laptop and
  iPad landscape viewports without scrolling. Preserve readable text, artwork
  proportions and usable touch targets. Verify complete flows and control
  bounds at 1366×768, 1024×768 and 1180×820.
- Use TownRewardBar with material artwork, centered large +N receipts and
  flights to visible storage. Animate only new server-committed rewards using
  stable receipt IDs, honor reduced motion and clean up layers/timers.
- Keep the first Playground slots Avatar, Badges, Town name; Calendar is
  fourth and Daily Quiz is fifth. Use shared localized navigation and
  achievement controls.

## Daily Quiz presentation

- Keep Town storage in the header and use the shared country-ball artwork for
  the two learning-language choices. Keep learning and interface language separate.
- Setup must not show material amounts, earned-looking medallions or seven-day
  circles. Show question progress out of eight during gameplay; show base plus
  bonus materials only after a newly rewarded completion.
- Keep achievement artwork for the actual collection, separate from celebration
  illustrations. Use the authored sunrise background with its calm readable
  center, chubby pastel forms and thick cocoa outlines.
- Exclude country/region association templates, category-identification filler and semantically duplicate answer
  choices. Preserve counted progress when repairing an invalid daily snapshot.

- Vocabulary is definition/clue → word: show a description and “What is this?”
  (or “Đây là gì?”), with three word choices in the selected answer language.
  Modes mean clue language → answer language. Categorize vocabulary by answer
  language; keep same-part-of-speech distractors and one correct selection.
