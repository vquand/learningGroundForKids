# Parent reporting guide

Follow the root guide and active Vercel/Render/Neon architecture plan. Number
clarification questions. No cloud changes or production migrations.

- Reports are read-only and require the session-bound parent capability.
- The admin family-report route reuses this repository only after authenticated
  admin-role authorization, validated target-family lookup, and query validation.
  Parent routes continue resolving their own family from the session. Admin reads
  have no parent-capability requirement and must never expose raw game state.
- Resolve family ownership from the authenticated session, never query/body IDs.
- Return bounded family/profile aggregates, not game JSON, answers, or secrets.
- Count persisted/verified progress only. Catalog-only achievements are not
  earned; unsupported games have unavailable counts, not invented zeroes.
- Distinguish lifetime totals, current expedition, current town, and self-rated
  flashcard study records. Never label recorded study as verified mastery.
- Validate stored numbers defensively and allowlist achievement IDs/metadata.
- Test family isolation, parent access, malformed state, and aggregate accuracy
  against disposable local PostgreSQL. Never run tests on production data.

## Parent and admin achievement reporting

- Whenever a minigame is added and its achievements are produced, include the
  minigame and its complete achievement group in the kid profile reports in
  **both Parent Space and Admin Space**. This is part of adding the minigame,
  not a later optional task. Keep names, badge artwork, unlock conditions,
  difficulty, earned status and progress consistent across both spaces.
- Use the shared server-owned child-report projection and the universal activity
  identity/design language. Test both reports when adding a group; registering
  it only in the admin achievement catalog is insufficient.
- Keep catalog-only definitions visibly labeled as not yet earnable. Show
  unsupported progress as unavailable, never invented completion counts or
  earned badges. Earned status must come from server-verified progress.
