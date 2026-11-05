# Quiz Enhancements Design

**Date:** 2026-03-21
**Scope:** Quiz badges (Wisdom section), map marker states, quiz-gated completion, admin quiz_required toggle

---

## Overview

Three enhancements to the existing Phase 10 quiz system:

1. **Wisdom badge section** — new badge category for quiz achievements, displayed below Exploration on the badge wall
2. **Quiz-gated item completion** — items with a quiz must have the quiz passed before being counted as done
3. **Map marker WIP state** — amber pulsing pin for items where quiz was attempted but not yet passed

---

## 1. Item State Machine

Items with `quiz_required = True` (default for **newly created** items when `has_quiz = True`) follow a 3-state lifecycle:

| State | Condition | Map pin |
|-------|-----------|---------|
| Not started | No quiz attempt for this profile | Grey |
| Work in progress | `QuizAttempt` exists with `score / total < 0.8` | Amber + pulsing ring |
| Done | `ProfileProgress` record exists | Green |

**WIP derivation:** A profile's WIP item IDs are derived by querying `QuizAttempt` records for that profile where `score * 1.0 / total < 0.8` (item quiz pass threshold). Only item quizzes (`item_id IS NOT NULL`) are checked — daily quizzes use a separate 0.7 threshold and do not affect item WIP state.

Items **without** a quiz, or where admin set `quiz_required = False`, keep the existing 3-gate flow: completion → `ProfileProgress` created → 1 exploration badge. These items are never WIP.

When a quiz-required item's quiz is passed (`score / total >= 0.8`):
1. `ProfileProgress` is created
2. Exploration badge check runs (via shared `check_and_award_badges` helper — see Section 3)
3. Wisdom badge check runs (via same helper)
4. Both awarded badges are returned in the quiz submit response

---

## 2. Schema Changes

### `Item` model
- Add `quiz_required: bool` column, server default `True`.
- **Default applies to new items only.** All existing items with `has_quiz = True` get `quiz_required = False` via a one-time migration backfill (admin can then opt specific items in). Items without a quiz are unaffected — `quiz_required` is only meaningful when `has_quiz = True`.

### `ProfileProgress`
- No changes. Only created when fully done (quiz passed for quiz-required items, or 3-gate for non-quiz items).

### Migration backfill strategy
- Existing items with `has_quiz = True`: set `quiz_required = False` (preserves current behaviour).
- Existing profiles with a passing `QuizAttempt` (`score / total >= 0.8`) for an item but no `ProfileProgress`: backfill a `ProfileProgress` record using `completed_at` from the `QuizAttempt`. This prevents blocking users who passed under the old system.

### New badge keys
| Key | Milestone | Display name | Condition |
|-----|-----------|--------------|-----------|
| `quiz_first` | 1 | First Quiz 🎯 | 1 item quiz passed |
| `quiz_explorer` | 5 | Quiz Explorer 📚 | 5 item quizzes passed |
| `quiz_master` | 50 | Quiz Master 🏆 | 50 item quizzes passed |
| `quiz_daily_scholar` | 5 | Daily Scholar 🌟 | 5 daily quizzes **passed** (score / total ≥ 0.7) |

Badge `badge_type` for all four: `"wisdom"` (new type alongside existing `"exploration"`).

"Passed" for daily quizzes means `score / total >= 0.7` (same threshold as the existing daily quiz submit logic).

---

## 3. API Changes

### Shared badge helper — `_check_and_award_badges(db, profile_id)` in `profiles.py`
Extract the existing badge-awarding logic from `mark_done` into a module-level async helper. Both the done endpoint and the quiz submit endpoint call this helper after creating `ProfileProgress`. The helper checks exploration milestones (existing `GLOBAL_MILESTONES` / `CATEGORY_MILESTONES`) **and** the four new wisdom milestones in a single pass. Returns a list of newly awarded `Badge` objects.

### `GET /api/items`
- Add `quiz_required: bool` to `ItemSummary` schema (Pydantic + SQLAlchemy).

### `GET /api/profiles/{id}/progress` — **breaking change**
Change response model from `list[str]` (bare array of done item IDs) to a new `ProgressResponse` schema:

```python
class ProgressResponse(BaseModel):
    done_item_ids: list[str]
    wip_item_ids: list[str]   # items with quiz attempt, score/total < 0.8
```

All frontend callers of this endpoint must be updated to use `response.done_item_ids` instead of the bare array.

**WIP query:** `SELECT DISTINCT item_id FROM quiz_attempts WHERE profile_id = ? AND item_id IS NOT NULL AND CAST(score AS FLOAT) / total < 0.8`

### `POST /api/profiles/{id}/items/{item_id}/done` (3-gate completion)
- If `item.quiz_required = True` and no passing `QuizAttempt` exists: **do not** create `ProfileProgress`. Return `{"status": "quiz_required"}`.
- If `item.quiz_required = False` or quiz already passed: create `ProfileProgress` as before, run `_check_and_award_badges`, return `{"status": "done", "new_badges": [...]}`.

### `QuizSubmitResponse` schema update
Add `new_badges: list[BadgeOut] = []` to the existing `QuizSubmitResponse` Pydantic schema. Both item and daily quiz submit endpoints return this field.

### `POST /api/profiles/{id}/quiz/items/{item_id}/submit` (item quiz submission)
After a passing score (`score / total >= 0.8`) on a quiz-required item:
1. Create `ProfileProgress` record (if not already exists)
2. Call `_check_and_award_badges(db, profile_id)`
3. Include `new_badges` list in response

### `POST /api/profiles/{id}/quiz/daily` (daily quiz submission) — **add badge check**
After submission (regardless of pass/fail for the attempt record):
1. Call `_check_and_award_badges(db, profile_id)` — this counts passed daily quizzes for `quiz_daily_scholar`
2. Include `new_badges` list in response

The helper counts passing daily attempts with:
```sql
SELECT COUNT(*) FROM quiz_attempts
WHERE profile_id = :profile_id
  AND item_id IS NULL
  AND CAST(score AS FLOAT) / total >= 0.7
```
This query runs on every call; it does not use an incremental counter. Only passing attempts (≥ 0.7) are counted — failures do not contribute to the `quiz_daily_scholar` milestone.

### `PUT /api/admin/items/{item_id}` (admin editor)
- Accept `quiz_required: bool` in request body and persist to DB.

---

## 4. Frontend Changes

### `ItemMarker.tsx`
- Consume updated `ProgressResponse`: use `done_item_ids` and `wip_item_ids`.
- Three pin states:
  - Default: grey (existing)
  - WIP (`item.id in wip_item_ids` and `item.quiz_required`): amber fill + CSS pulsing outline animation
  - Done (`item.id in done_item_ids`): green (existing)

### `BadgeDisplayPage.tsx`
- Add **🧠 Wisdom** section below **🗺️ Exploration** section.
- Purple accent: `violet-700` header, `bg-violet-50 border-violet-200` cards, `border-violet-400` earned badges.
- Locked wisdom badges shown as dim placeholders (same pattern as exploration).

### `useDoneTracking.ts` / `ItemDetailPage.tsx`
The existing hook sets `persistedRef.current = true` and calls `setIsDone(true)` **before** `markItemDone` resolves (optimistic update). Both assignments must be moved **inside** the `.then()` handler for **all** code paths — not just the `quiz_required` case.

Refactored flow:
```ts
markItemDone(profileId, itemId)
  .then((response) => {
    if (response.status === 'quiz_required') {
      // do NOT set isDone or persistedRef — stay in ungated state
      // show "Quiz time! 🎯" nudge pointing to QuizCard
    } else {
      persistedRef.current = true;
      setIsDone(true);
    }
  });
// Nothing set before .then() — no optimistic update
```

- When the done endpoint returns `{"status": "quiz_required"}`: keep `isDone = false`, keep `persistedRef.current = false`, show a "Quiz time! 🎯" nudge pointing to the QuizCard.
- When it returns `{"status": "done"}`: set `isDone = true` and `persistedRef.current = true` inside `.then()`.

### All callers of `GET /api/profiles/{id}/progress`
- Update to destructure `done_item_ids` from the response object instead of treating it as a bare array.
- Likely affected: `useItems` hook or wherever done IDs are consumed for map markers.

### `AdminItemEditorPage.tsx`
- Add `quiz_required` boolean toggle in Quiz tab header (visible only when item has a quiz).

---

## 5. Visual Design

**Wisdom section** uses purple accent throughout:
- Section header: `🧠 Wisdom` in `violet-700`
- Badge cards: `bg-violet-50 border-violet-200`
- Earned badges: `border-violet-400`

**WIP map pin:**
```css
@keyframes wip-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
  50%       { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
}
```
Pin background: `#f59e0b` (amber-400). Animation: 1.8s ease-in-out infinite.

---

## 6. Pass Thresholds (reference)

| Quiz type | Pass threshold | Used for |
|-----------|---------------|----------|
| Item quiz | score / total ≥ 0.8 | WIP derivation, ProfileProgress gate, exploration + wisdom badges |
| Daily quiz | score / total ≥ 0.7 | `quiz_daily_scholar` milestone count |

---

## 7. Out of Scope

- Quiz streaks tracked beyond the daily scholar milestone (no streak counter UI)
- Per-item wisdom badge (badge is profile-level milestone count, not per-item)
- Journey replay changes (WIP items do not appear — only `ProfileProgress` items qualify)
