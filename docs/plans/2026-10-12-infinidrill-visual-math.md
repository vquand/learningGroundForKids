# Infinidrill visual math and question variants

Branch: `feature/infinidrill-visual-math`.
Status: choices 1A/2A/3A accepted; implementation and automated verification complete; user confirmed UAT. Answers stay nonnegative, diagrams are pre-sorted, and the existing 18-level progression is preserved.

## Requested behavior

- Render arithmetic vertically, with a dedicated aligned operator column,
  right-aligned tabular digits, a result rule, and the answer field in the
  missing position. Keep keypad and current actions inside the viewport.
- Generate missing-result and missing-operand variants with one uniquely
  determined answer. Avoid unsolvable or ambiguous zero multiplication/division.
- Multiplication difficulty: easy uses two single digits, with at most one zero;
  medium uses 10–19 multiplied by 1–5; hard uses 10–19 multiplied by 6–10.
- Add rounded-rectangle Venn diagrams with simple chubby star, capybara, dairy
  cow, Highland cow, chick and penguin pictograms. Three region counts represent
  left-only, shared and right-only objects. For 3/5/6, union is 14, intersection
  is 5, left set is 8 and right set is 11. Count shared objects only once.
- Preserve profile ownership, server-issued questions, verified grading,
  excavation, source-game material rewards, equipment and earned achievements.

## Accepted choices

1. Nonnegative integers only.
2. Count already-sorted pictures; no drag-to-sort step.
3. Keep 18 levels: easy multiplication at 12, medium at 13, hard mixed with exact
   division at 14. Venn counting mixes into levels 1–11. Single missing operands
   mix across arithmetic families. Existing mastery/depth requirements stay intact.

## Implementation slices

1. Add structured question presentation and privacy-safe public serialization.
   Server fields must not reveal hidden operands, results or answer-bearing IDs.
   Verify correct/wrong grading, stale IDs, legacy saved questions and variants.
2. Render stacked arithmetic, integrate the missing-position input and bound
   multiplication generators. Verify all generated ranges, zero constraints,
   unique solutions and existing progression/reward behavior.
3. Add Venn presentation and generation, plus sorting validation if selected.
   Verify every region/set/union/intersection count and no overlap double-counts.
4. Update frontend/server Infinidrill guides, art provenance and tests. Verify
   setup, main/bonus questions, retries, pause and results at 1366×768,
   1024×768 and 1180×820 with all actions visible and no required scrolling.

## Checks

- Frontend tests, app/hosting typechecks, Vercel and compatibility builds.
- Guarded local server tests, server typecheck/build, and browser regressions.
- Never run production migrations or provision cloud resources. No commit/push
  until the user authorizes the completed feature handoff.

## Verification evidence

- Frontend: 60 test files pass; app and hosting typechecks pass; both build modes pass.
- Server: 229 guarded local tests pass; typecheck and build pass. New tests check
  unique whole-number solutions, zero ambiguity, all multiplication bands, all
  Venn targets/memberships, private-field redaction and server-verified grading.
- Browser: all 20 tests pass from the frontend working directory. Includes
  complete 18-level/core/replay flow, keyboard, saved progress/recovery, and the
  new column/operand-blank/Venn presentations at all three required viewports.
- Presentation reuses original app avatar art and a locally authored rounded
  SVG star. No reference-photo artwork was copied. Venn diagrams use SVG rounded
  rectangles and stable region slots. Animal pictograms show only larger,
  transparent faces, without circular badges, frames or colored backdrops;
  the left set is labeled Team A.
- Schema unchanged: new question metadata is optional inside existing JSON
  state; legacy saved questions render as stacked missing-result questions.
- User confirmed UAT and authorized commit/push on `feature/infinidrill-visual-math`.
