# Retire placeholder quizzes

The user requested removal of country/region association questions, including
the Fava question whose title already discloses the answer. Category-identification
templates previously excluded from Daily Quiz are also removed from the banks.

The three checked-in catalog banks lose 17,138 placeholder questions. This leaves
1,318 other questions and 4,283 catalog entries without quizzes. Lesson text,
translations, media, provenance, geography and publication settings are unchanged.
An empty quiz never blocks marking a lesson learned.

The shared content policy filters imports and serving, rejects placeholder
authoring and prevents catalog generators from recreating metadata-only quizzes.
Original seed slots remain stable for surviving questions and derived flashcards.
Daily snapshots containing placeholders are rebuilt while retaining counted
progress and completion state; already awarded resources cannot be awarded again.

Migration 0031 retires matching stored questions and their derived flashcards,
clears empty quiz requirements and invalidates the catalog once under write locks.
Historical attempts, learning progress, achievements and Town receipts remain.
It is idempotent and intentionally has no content-reactivation rollback.
The guarded operator handoff records the exact canonical migration identity.
No production migration, publication, commit or push is authorized here.

## Validation

- Fixture comparison verifies every non-quiz field against the original bank.
- Cleanup dry run finds zero remaining placeholder questions.
- Frontend suite: 473 passed. Backend suite against isolated local PostgreSQL:
  476 passed, including retirement, repeat execution, progress preservation,
  mixed-language fallback and stable seed IDs.
- Backend and frontend typechecks and builds pass, including Vercel and
  transitional frontend builds. The shared policy module is present in the
  compiled API artifact.
- The operator handoff executes and repeats successfully against isolated local
  PostgreSQL. Completed snapshot repair preserves earned progress and cannot
  credit a second reward.
- Local UAT migration applied. An isolated headless browser verifies eight
  filtered Daily Quiz questions, successful settings/status requests and Fava's
  `has_quiz=false` / `quiz_required=false`. Settings controls fit 1366×768,
  1024×768 and 1180×820 without scrolling or offscreen controls. Clean browser
  startup has no page errors. Evidence remains under `/tmp`.

## Integration with current main

Keep the 30 newly reviewed lessons and their authored flashcards. Their two
English questions using association wording are retired under the same policy;
118 other reviewed questions remain. All non-quiz catalog fields match main.
The reviewed-content SQL artifact is regenerated to reflect these retirements.

Main already owns migration slots 0028 and 0029 for friend baskets and river
sharing. Daily Quiz and placeholder retirement now use 0030 and 0031, retaining
their original canonical SQL hashes and timestamps. Historical main snapshots
remain unchanged; the new snapshots include both Town and Daily Quiz tables.

After conflict resolution, 491 backend tests pass against a fresh isolated local
database and 479 frontend tests pass. Server, app and hosting typechecks, server
build, Vercel build and compatibility build pass. No production data is changed.
