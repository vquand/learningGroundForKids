# Quiz Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add quiz-gated item completion, WIP map marker states, wisdom badge section, and admin quiz_required toggle to the existing Phase 10 quiz system.

**Architecture:** Add `quiz_required` column to `Item` with a startup migration + backfill. Extract badge logic into a shared `_check_and_award_badges` helper that handles both exploration and new wisdom milestones. Change `GET /api/profiles/{id}/progress` to return `{done_item_ids, wip_item_ids}` instead of a bare array. Frontend consumes the new progress shape to drive three-state map pins and the Wisdom badge section.

**Tech Stack:** FastAPI + SQLAlchemy async + SQLite, React 19 + TanStack Query v5 + Tailwind v4, pytest-asyncio

**Spec:** `docs/superpowers/specs/2026-03-21-quiz-enhancements-design.md`

---

## File Map

**Backend — modify:**
- `backend/app/badge_config.py` — add wisdom badge keys/names
- `backend/app/models.py` — add `quiz_required: bool` to `Item`
- `backend/app/main.py` — startup migration (ADD COLUMN + backfills)
- `backend/app/schemas.py` — add `ProgressResponse`, `quiz_required` to `ItemSummary`, `new_badges` to `QuizSubmitResponse`
- `backend/app/routers/profiles.py` — extract `_check_and_award_badges`, gate `mark_done`, update `list_progress`
- `backend/app/routers/quiz.py` — `submit_item_quiz` creates ProfileProgress on pass; `submit_daily_quiz` calls badge helper
- `backend/app/routers/admin.py` — accept `quiz_required` on item update

**Backend — create:**
- `backend/tests/test_quiz_enhancements.py` — all new behaviour tests

**Frontend — modify:**
- `frontend/src/types/item.ts` — add `quiz_required` to `ItemSummary`
- `frontend/src/types/quiz.ts` — add `new_badges` to submit response type; add `ProgressResponse`
- `frontend/src/api/profiles.ts` — update `fetchProgress` return type; update `markItemDone` return type
- `frontend/src/components/DoneTracking/useDoneTracking.ts` — fix optimistic update; handle `quiz_required`
- `frontend/src/components/Map/ItemMarker.tsx` — 3-state icon (done/WIP/default)
- `frontend/src/components/Map/WorldMap.tsx` — fetch progress, pass done/wip sets to markers
- `frontend/src/pages/BadgeDisplayPage.tsx` — Wisdom section
- `frontend/src/pages/admin/AdminItemEditorPage.tsx` — `quiz_required` toggle

**Frontend — create:**
- `frontend/src/hooks/useProgress.ts` — React Query hook for `ProgressResponse`

---

## Task 1: Add wisdom badge constants

**Files:**
- Modify: `backend/app/badge_config.py`

- [ ] **Step 1: Add wisdom milestones and names**

```python
# backend/app/badge_config.py  (add after existing constants)

WISDOM_MILESTONES = [1, 5, 50]        # item quizzes passed
DAILY_WISDOM_MILESTONES = [5]          # daily quizzes passed

BADGE_NAMES.update({
    "quiz_first":         {"name": "First Quiz 🎯",    "description": "Passed your very first quiz!"},
    "quiz_explorer":      {"name": "Quiz Explorer 📚",  "description": "Passed 5 quizzes!"},
    "quiz_master":        {"name": "Quiz Master 🏆",    "description": "Passed 50 quizzes — true wisdom!"},
    "quiz_daily_scholar": {"name": "Daily Scholar 🌟",  "description": "Completed 5 daily quizzes!"},
})
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/badge_config.py
git commit -m "feat(quiz): add wisdom badge constants"
```

---

## Task 2: Add `quiz_required` column to Item model

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_quiz_enhancements.py
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.database import get_db
from app.main import app
from app.models import Base, Item

test_engine = create_async_engine("sqlite+aiosqlite://", connect_args={"check_same_thread": False})
test_session = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

@pytest.fixture
async def db_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with test_session() as session:
        yield session
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def client(db_session):
    async def _override():
        yield db_session
    app.dependency_overrides[get_db] = _override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_item_has_quiz_required_column(db_session: AsyncSession):
    """Item model has quiz_required defaulting to True."""
    item = Item(
        id="test-item-1",
        category="food",
        latitude=10.0,
        longitude=20.0,
        is_published=True,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    assert item.quiz_required is True
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd backend && pytest tests/test_quiz_enhancements.py::test_item_has_quiz_required_column -v
```
Expected: `AttributeError` or column missing.

- [ ] **Step 3: Add column to Item model**

```python
# backend/app/models.py — inside class Item, after franchise_id line
quiz_required = Column(Boolean, default=True, nullable=False, server_default="1")
```

- [ ] **Step 4: Add startup migration in main.py**

In `main.py` lifespan, inside the existing `for col_name, col_type` loop, add:
```python
("quiz_required", "INTEGER"),
```

Then after the loop (before `seed_if_empty()`), add the backfill block:

```python
# Backfill quiz_required: set False for existing items that already have a quiz
# (preserves current behaviour; admin can opt specific items in)
async with engine.begin() as conn:
    # Only run if quiz_questions table exists
    result = await conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name='quiz_questions'")
    )
    if result.fetchone():
        await conn.execute(text(
            "UPDATE items SET quiz_required = 0 "
            "WHERE id IN (SELECT DISTINCT item_id FROM quiz_questions) "
            "AND quiz_required = 1"
        ))

# Backfill ProfileProgress for profiles with passing QuizAttempts but no ProfileProgress
async with engine.begin() as conn:
    result = await conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name='quiz_attempts'")
    )
    if result.fetchone():
        await conn.execute(text("""
            INSERT OR IGNORE INTO profile_progress (id, profile_id, item_id, category, done_at)
            SELECT
                lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
                substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(2))) ||
                '-' || lower(hex(randomblob(6))),
                qa.profile_id,
                qa.item_id,
                i.category,
                qa.completed_at
            FROM quiz_attempts qa
            JOIN items i ON i.id = qa.item_id
            WHERE qa.item_id IS NOT NULL
              AND CAST(qa.score AS FLOAT) / qa.total >= 0.8
              AND NOT EXISTS (
                  SELECT 1 FROM profile_progress pp
                  WHERE pp.profile_id = qa.profile_id AND pp.item_id = qa.item_id
              )
        """))
```

- [ ] **Step 5: Run test — expect pass**

```bash
cd backend && pytest tests/test_quiz_enhancements.py::test_item_has_quiz_required_column -v
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/models.py backend/app/main.py backend/tests/test_quiz_enhancements.py
git commit -m "feat(quiz): add quiz_required column to Item + startup migration/backfill"
```

---

## Task 3: Update schemas

**Files:**
- Modify: `backend/app/schemas.py`

- [ ] **Step 1: Add `quiz_required` to `ItemSummary`**

```python
# backend/app/schemas.py — in class ItemSummary
quiz_required: bool = True
```

- [ ] **Step 2: Add `ProgressResponse`**

```python
# backend/app/schemas.py — new class after ItemSummary
class ProgressResponse(BaseModel):
    done_item_ids: list[str]
    wip_item_ids: list[str]
```

- [ ] **Step 3: Add `new_badges` to `QuizSubmitResponse`**

Find the existing `QuizSubmitResponse` class in `schemas.py` and add:
```python
new_badges: list[BadgeOut] = []
```
Also ensure `BadgeOut` is importable at that point in the file (move it above `QuizSubmitResponse` if needed).

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas.py
git commit -m "feat(quiz): add ProgressResponse, quiz_required to ItemSummary, new_badges to QuizSubmitResponse"
```

---

## Task 4: Extract badge helper + update `mark_done`

**Files:**
- Modify: `backend/app/routers/profiles.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_quiz_enhancements.py — add these tests

import hashlib
from app.models import Item, Profile, ProfileProgress, QuizAttempt, Badge, Family

# Helper to make a logged-in client for a family
async def _make_family_and_login(client, db_session):
    from app.models import Family
    import bcrypt
    pw_hash = hashlib.sha256(b"testpass").hexdigest()
    family = Family(id="fam1", username="test", password_hash=pw_hash, display_name="Test")
    db_session.add(family)
    await db_session.commit()
    resp = await client.post("/api/auth/login", json={"username": "test", "password": "testpass"})
    return resp.cookies

async def _seed_item(db_session, item_id="item1", quiz_required=True, has_quiz=False):
    from app.models import Item
    item = Item(id=item_id, category="food", latitude=0.0, longitude=0.0, is_published=True, quiz_required=quiz_required)
    db_session.add(item)
    from app.models import ItemTranslation
    db_session.add(ItemTranslation(id=f"{item_id}-t", item_id=item_id, lang="en", title="Test Item"))
    await db_session.commit()
    return item

async def _seed_profile(db_session, family_id="fam1"):
    profile = Profile(id="prof1", name="Kid", emoji="😊", color="#FF0000", family_id=family_id)
    db_session.add(profile)
    await db_session.commit()
    return profile

@pytest.mark.asyncio
async def test_mark_done_blocked_when_quiz_required(client, db_session):
    """mark_done returns quiz_required status when item has quiz_required=True and no passing attempt."""
    cookies = await _make_family_and_login(client, db_session)
    await _seed_item(db_session, "item1", quiz_required=True)
    await _seed_profile(db_session)

    resp = await client.post(
        "/api/profiles/prof1/progress",
        json={"item_id": "item1", "category": "food"},
        cookies=cookies,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "quiz_required"

@pytest.mark.asyncio
async def test_mark_done_succeeds_when_quiz_not_required(client, db_session):
    """mark_done creates ProfileProgress when quiz_required=False."""
    cookies = await _make_family_and_login(client, db_session)
    await _seed_item(db_session, "item1", quiz_required=False)
    await _seed_profile(db_session)

    resp = await client.post(
        "/api/profiles/prof1/progress",
        json={"item_id": "item1", "category": "food"},
        cookies=cookies,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "done"
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && pytest tests/test_quiz_enhancements.py::test_mark_done_blocked_when_quiz_required tests/test_quiz_enhancements.py::test_mark_done_succeeds_when_quiz_not_required -v
```

- [ ] **Step 3: Extract `_check_and_award_badges` helper**

Add this function in `profiles.py` before `mark_done` (add imports for `QuizAttempt` and wisdom config at top of file):

```python
# Add to imports at top of profiles.py:
from app.models import Badge, Item, Profile, ProfileProgress, QuizAttempt
from app.badge_config import (
    BADGE_NAMES, CATEGORY_MILESTONES, GLOBAL_MILESTONES,
    WISDOM_MILESTONES, DAILY_WISDOM_MILESTONES,
)

# New helper function:
async def _check_and_award_badges(
    db: AsyncSession, profile_id: str, category: str | None = None
) -> list[Badge]:
    """Check all badge milestones and insert any not-yet-awarded badges. Returns newly inserted ones."""
    newly_inserted: list[Badge] = []

    # --- Exploration: global milestones ---
    total_done_result = await db.execute(
        select(func.count()).select_from(ProfileProgress).where(ProfileProgress.profile_id == profile_id)
    )
    total_done = total_done_result.scalar_one()
    for threshold in GLOBAL_MILESTONES:
        if total_done >= threshold:
            badge_key = f"global_{threshold}"
            exists = await db.execute(select(Badge).where(Badge.profile_id == profile_id, Badge.badge_key == badge_key))
            if exists.scalar_one_or_none() is None:
                b = Badge(profile_id=profile_id, badge_key=badge_key, badge_type="global", milestone=threshold)
                db.add(b); await db.flush(); newly_inserted.append(b)

    # --- Exploration: category milestones ---
    if category:
        cat_done_result = await db.execute(
            select(func.count()).select_from(ProfileProgress).where(
                ProfileProgress.profile_id == profile_id, ProfileProgress.category == category
            )
        )
        cat_done = cat_done_result.scalar_one()
        for threshold in CATEGORY_MILESTONES:
            if cat_done >= threshold:
                badge_key = f"{category}_{threshold}"
                exists = await db.execute(select(Badge).where(Badge.profile_id == profile_id, Badge.badge_key == badge_key))
                if exists.scalar_one_or_none() is None:
                    b = Badge(profile_id=profile_id, badge_key=badge_key, badge_type="category", milestone=threshold)
                    db.add(b); await db.flush(); newly_inserted.append(b)

    # --- Wisdom: item quizzes passed ---
    item_passed_result = await db.execute(
        select(func.count()).select_from(QuizAttempt).where(
            QuizAttempt.profile_id == profile_id,
            QuizAttempt.item_id.is_not(None),
            (QuizAttempt.score * 1.0 / QuizAttempt.total) >= 0.8,
        )
    )
    item_passed = item_passed_result.scalar_one()
    wisdom_keys = {1: "quiz_first", 5: "quiz_explorer", 50: "quiz_master"}
    for threshold in WISDOM_MILESTONES:
        if item_passed >= threshold:
            badge_key = wisdom_keys[threshold]
            exists = await db.execute(select(Badge).where(Badge.profile_id == profile_id, Badge.badge_key == badge_key))
            if exists.scalar_one_or_none() is None:
                b = Badge(profile_id=profile_id, badge_key=badge_key, badge_type="wisdom", milestone=threshold)
                db.add(b); await db.flush(); newly_inserted.append(b)

    # --- Wisdom: daily quizzes passed ---
    daily_passed_result = await db.execute(
        select(func.count()).select_from(QuizAttempt).where(
            QuizAttempt.profile_id == profile_id,
            QuizAttempt.item_id.is_(None),
            (QuizAttempt.score * 1.0 / QuizAttempt.total) >= 0.7,
        )
    )
    daily_passed = daily_passed_result.scalar_one()
    for threshold in DAILY_WISDOM_MILESTONES:
        if daily_passed >= threshold:
            badge_key = "quiz_daily_scholar"
            exists = await db.execute(select(Badge).where(Badge.profile_id == profile_id, Badge.badge_key == badge_key))
            if exists.scalar_one_or_none() is None:
                b = Badge(profile_id=profile_id, badge_key=badge_key, badge_type="wisdom", milestone=threshold)
                db.add(b); await db.flush(); newly_inserted.append(b)

    return newly_inserted
```

- [ ] **Step 4: Update `mark_done` to use helper + quiz gate**

Replace the badge logic block and return in `mark_done` (`profiles.py:254`):

```python
@router.post("/api/profiles/{profile_id}/progress", response_model=MarkDoneResponse)
async def mark_done(
    profile_id: str,
    body: MarkDoneRequest,
    db: AsyncSession = Depends(get_db),
    family_id: str = Depends(get_current_family_id),
):
    await _get_family_profile(profile_id, family_id, db)

    item_result = await db.execute(
        select(Item).where(Item.id == body.item_id, Item.is_published == True)  # noqa: E712
    )
    item = item_result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    # Check if already done
    existing_result = await db.execute(
        select(ProfileProgress).where(
            ProfileProgress.profile_id == profile_id,
            ProfileProgress.item_id == body.item_id,
        )
    )
    if existing_result.scalar_one_or_none() is not None:
        return MarkDoneResponse(status="done", already_done=True, newly_earned_badges=[])

    # Quiz gate: if quiz_required, block unless a passing attempt exists
    if item.quiz_required:
        attempt_result = await db.execute(
            select(QuizAttempt).where(
                QuizAttempt.profile_id == profile_id,
                QuizAttempt.item_id == body.item_id,
                (QuizAttempt.score * 1.0 / QuizAttempt.total) >= 0.8,
            )
        )
        if attempt_result.scalar_one_or_none() is None:
            return MarkDoneResponse(status="quiz_required", already_done=False, newly_earned_badges=[])

    progress = ProfileProgress(profile_id=profile_id, item_id=body.item_id, category=item.category)
    db.add(progress)
    await db.flush()

    newly_inserted = await _check_and_award_badges(db, profile_id, category=item.category)
    await db.commit()

    badge_outs = [
        BadgeOut(
            id=b.id, badge_key=b.badge_key, badge_type=b.badge_type,
            milestone=b.milestone, earned_at=b.earned_at,
            name=BADGE_NAMES.get(b.badge_key, {}).get("name", ""),
            description=BADGE_NAMES.get(b.badge_key, {}).get("description", ""),
        )
        for b in newly_inserted
    ]
    return MarkDoneResponse(status="done", already_done=False, newly_earned_badges=badge_outs)
```

Also add `status: str = "done"` to `MarkDoneResponse` schema (schemas.py).

- [ ] **Step 5: Run tests — expect pass**

```bash
cd backend && pytest tests/test_quiz_enhancements.py::test_mark_done_blocked_when_quiz_required tests/test_quiz_enhancements.py::test_mark_done_succeeds_when_quiz_not_required -v
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/profiles.py backend/app/schemas.py backend/tests/test_quiz_enhancements.py
git commit -m "feat(quiz): extract _check_and_award_badges, add quiz gate to mark_done"
```

---

## Task 5: Update `list_progress` to return `ProgressResponse`

**Files:**
- Modify: `backend/app/routers/profiles.py`
- Modify: `backend/app/schemas.py` (already has `ProgressResponse` from Task 3)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_quiz_enhancements.py
@pytest.mark.asyncio
async def test_list_progress_returns_done_and_wip(client, db_session):
    """GET /progress returns done_item_ids and wip_item_ids."""
    cookies = await _make_family_and_login(client, db_session)
    await _seed_item(db_session, "item1", quiz_required=False)
    await _seed_item(db_session, "item2", quiz_required=True)
    profile = await _seed_profile(db_session)

    # item1: mark done (no quiz required)
    await client.post("/api/profiles/prof1/progress",
        json={"item_id": "item1", "category": "food"}, cookies=cookies)

    # item2: create a failing quiz attempt (WIP state)
    attempt = QuizAttempt(id="a1", profile_id="prof1", item_id="item2",
                          attempt_date=None, score=3, total=10, answers=[])
    db_session.add(attempt)
    await db_session.commit()

    resp = await client.get("/api/profiles/prof1/progress", cookies=cookies)
    assert resp.status_code == 200
    data = resp.json()
    assert "item1" in data["done_item_ids"]
    assert "item2" in data["wip_item_ids"]
    assert "item2" not in data["done_item_ids"]
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd backend && pytest tests/test_quiz_enhancements.py::test_list_progress_returns_done_and_wip -v
```

- [ ] **Step 3: Rewrite `list_progress`**

```python
# backend/app/routers/profiles.py — replace list_progress
from app.schemas import ProgressResponse  # add to imports

@router.get("/api/profiles/{profile_id}/progress", response_model=ProgressResponse)
async def list_progress(
    profile_id: str,
    db: AsyncSession = Depends(get_db),
    family_id: str = Depends(get_current_family_id),
):
    await _get_family_profile(profile_id, family_id, db)

    done_result = await db.execute(
        select(ProfileProgress.item_id).where(ProfileProgress.profile_id == profile_id)
    )
    done_item_ids = list(done_result.scalars().all())

    # Build WIP filter — not_in([]) causes a SQLAlchemy error, so guard explicitly
    wip_filters = [
        QuizAttempt.profile_id == profile_id,
        QuizAttempt.item_id.is_not(None),
        (QuizAttempt.score * 1.0 / QuizAttempt.total) < 0.8,
    ]
    if done_item_ids:
        wip_filters.append(QuizAttempt.item_id.not_in(done_item_ids))
    wip_result = await db.execute(
        select(QuizAttempt.item_id).where(*wip_filters).distinct()
    )
    wip_item_ids = list(wip_result.scalars().all())

    return ProgressResponse(done_item_ids=done_item_ids, wip_item_ids=wip_item_ids)
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd backend && pytest tests/test_quiz_enhancements.py::test_list_progress_returns_done_and_wip -v
```

- [ ] **Step 5: Run full backend test suite to check for regressions**

```bash
cd backend && pytest -x -q
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/profiles.py
git commit -m "feat(quiz): list_progress returns ProgressResponse with wip_item_ids"
```

---

## Task 6: Update quiz submit endpoints

**Files:**
- Modify: `backend/app/routers/quiz.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_quiz_enhancements.py
from app.models import QuizQuestion

async def _seed_quiz_question(db_session, item_id="item1", question_id="q1"):
    q = QuizQuestion(
        id=question_id, item_id=item_id, lang="en",
        question="Test question?", question_type="yes_no",
        options=["Yes", "No"], correct_answers=[0],
        sort_order=1, is_active=True,
    )
    db_session.add(q)
    await db_session.commit()
    return q

@pytest.mark.asyncio
async def test_item_quiz_pass_creates_profile_progress(client, db_session):
    """Passing an item quiz creates ProfileProgress and returns new_badges."""
    cookies = await _make_family_and_login(client, db_session)
    await _seed_item(db_session, "item1", quiz_required=True)
    await _seed_profile(db_session)
    await _seed_quiz_question(db_session, "item1", "q1")

    resp = await client.post(
        "/api/profiles/prof1/quiz/item/item1",
        json={"answers": [{"question_id": "q1", "chosen_answers": [0]}]},
        cookies=cookies,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["passed"] is True
    assert "new_badges" in data

    # ProfileProgress should now exist
    from sqlalchemy import select
    from app.models import ProfileProgress
    result = await db_session.execute(
        select(ProfileProgress).where(
            ProfileProgress.profile_id == "prof1",
            ProfileProgress.item_id == "item1",
        )
    )
    assert result.scalar_one_or_none() is not None

@pytest.mark.asyncio
async def test_daily_quiz_submit_returns_new_badges(client, db_session):
    """Daily quiz submit response includes new_badges field."""
    cookies = await _make_family_and_login(client, db_session)
    await _seed_item(db_session, "item1", quiz_required=False)
    await _seed_profile(db_session)
    # Mark item1 done so daily quiz has a pool
    await client.post("/api/profiles/prof1/progress",
        json={"item_id": "item1", "category": "food"}, cookies=cookies)
    await _seed_quiz_question(db_session, "item1", "q1")

    resp = await client.post(
        "/api/profiles/prof1/quiz/daily",
        json={"answers": [{"question_id": "q1", "chosen_answers": [0]}]},
        cookies=cookies,
    )
    assert resp.status_code == 200
    assert "new_badges" in resp.json()
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && pytest tests/test_quiz_enhancements.py::test_item_quiz_pass_creates_profile_progress tests/test_quiz_enhancements.py::test_daily_quiz_submit_returns_new_badges -v
```

- [ ] **Step 3: Update `submit_item_quiz` in `quiz.py`**

Add imports at top of `quiz.py`:
```python
from app.models import Badge, Item, ProfileProgress, QuizAttempt, QuizQuestion, DailyQuizSnapshot
from app.routers.profiles import _check_and_award_badges
from app.badge_config import BADGE_NAMES
from app.schemas import BadgeOut
```

After `db.add(attempt); await db.commit()` in `submit_item_quiz`, add:

```python
    # NOTE: Remove the original `await db.commit()` above this block —
    # only one commit should happen (after both the attempt and ProfileProgress are flushed).
    new_badges: list[BadgeOut] = []
    if passed:
        # Create ProfileProgress if not already exists
        existing_pp = await db.execute(
            select(ProfileProgress).where(
                ProfileProgress.profile_id == profile_id,
                ProfileProgress.item_id == item_id,
            )
        )
        if existing_pp.scalar_one_or_none() is None:
            item_result = await db.execute(select(Item).where(Item.id == item_id))
            item = item_result.scalar_one_or_none()
            if item:
                pp = ProfileProgress(profile_id=profile_id, item_id=item_id, category=item.category)
                db.add(pp)
                await db.flush()
                inserted = await _check_and_award_badges(db, profile_id, category=item.category)
                await db.commit()
                new_badges = [
                    BadgeOut(
                        id=b.id, badge_key=b.badge_key, badge_type=b.badge_type,
                        milestone=b.milestone, earned_at=b.earned_at,
                        name=BADGE_NAMES.get(b.badge_key, {}).get("name", ""),
                        description=BADGE_NAMES.get(b.badge_key, {}).get("description", ""),
                    )
                    for b in inserted
                ]

    return QuizSubmitResponse(score=score, total=total, passed=passed, new_badges=new_badges)
```

- [ ] **Step 4: Update `submit_daily_quiz` in `quiz.py`**

After `db.add(attempt); await db.commit()`, add:

```python
    inserted = await _check_and_award_badges(db, profile_id)
    await db.commit()
    new_badges = [
        BadgeOut(
            id=b.id, badge_key=b.badge_key, badge_type=b.badge_type,
            milestone=b.milestone, earned_at=b.earned_at,
            name=BADGE_NAMES.get(b.badge_key, {}).get("name", ""),
            description=BADGE_NAMES.get(b.badge_key, {}).get("description", ""),
        )
        for b in inserted
    ]
    return QuizSubmitResponse(score=score, total=total, passed=passed, new_badges=new_badges)
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd backend && pytest tests/test_quiz_enhancements.py -v
```

- [ ] **Step 6: Run full backend suite**

```bash
cd backend && pytest -x -q
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/quiz.py
git commit -m "feat(quiz): submit endpoints create ProfileProgress + return new_badges"
```

---

## Task 7: Admin — accept `quiz_required` on item update

**Files:**
- Modify: `backend/app/routers/admin.py`

- [ ] **Step 1: Find the item update endpoint and add `quiz_required`**

Locate `PUT /api/admin/items/{item_id}` in `admin.py`. In its request body schema (likely `ItemUpdate` or inline), add `quiz_required: Optional[bool] = None`. In the handler, add:

```python
if body.quiz_required is not None:
    item.quiz_required = body.quiz_required
```

- [ ] **Step 2: Verify existing admin tests still pass**

```bash
cd backend && pytest tests/test_admin_api.py -x -q
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/admin.py
git commit -m "feat(quiz): admin item update accepts quiz_required"
```

---

## Task 8: Frontend — types + API layer

**Files:**
- Modify: `frontend/src/types/item.ts`
- Modify: `frontend/src/types/quiz.ts`
- Modify: `frontend/src/api/profiles.ts`

- [ ] **Step 1: Add `quiz_required` to `ItemSummary` type**

In `frontend/src/types/item.ts`, find `ItemSummary` and add:
```ts
quiz_required: boolean;
```

- [ ] **Step 2: Add `ProgressResponse` type**

In `frontend/src/types/quiz.ts` (or create `frontend/src/types/progress.ts`), add:
```ts
export interface ProgressResponse {
  done_item_ids: string[];
  wip_item_ids: string[];
}
```

- [ ] **Step 3: Update `fetchProgress` in `api/profiles.ts`**

```ts
// frontend/src/api/profiles.ts
import type { ProgressResponse } from '../types/quiz';  // adjust path if needed

export async function fetchProgress(profileId: string): Promise<ProgressResponse> {
  const response = await fetch(`/api/profiles/${profileId}/progress`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch progress');
  return response.json() as Promise<ProgressResponse>;
}
```

- [ ] **Step 4: Update `markItemDone` return type**

In `api/profiles.ts`, update `MarkDoneResponse` type (or the return type of `markItemDone`) to include:
```ts
export interface MarkDoneResponse {
  status: 'done' | 'quiz_required';
  already_done: boolean;
  newly_earned_badges: BadgeInfo[];
}
```

- [ ] **Step 5: Add `new_badges` to quiz submit response type**

In `frontend/src/types/quiz.ts`, find `QuizSubmitResponse` (or equivalent) and add:
```ts
new_badges: BadgeInfo[];
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/ frontend/src/api/profiles.ts
git commit -m "feat(quiz): update frontend types and API for ProgressResponse + quiz_required"
```

---

## Task 9: Frontend — `useProgress` hook

**Files:**
- Create: `frontend/src/hooks/useProgress.ts`

- [ ] **Step 1: Create the hook**

```ts
// frontend/src/hooks/useProgress.ts
import { useQuery } from '@tanstack/react-query';
import { fetchProgress } from '../api/profiles';
import type { ProgressResponse } from '../types/quiz';

const EMPTY: ProgressResponse = { done_item_ids: [], wip_item_ids: [] };

export function useProgress(profileId: string | null) {
  const { data } = useQuery({
    queryKey: ['progress', profileId],
    queryFn: () => fetchProgress(profileId!),
    enabled: !!profileId,
    staleTime: 30_000,
  });
  return data ?? EMPTY;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useProgress.ts
git commit -m "feat(quiz): add useProgress hook for ProgressResponse"
```

---

## Task 10: Frontend — 3-state map markers

**Files:**
- Modify: `frontend/src/components/Map/ItemMarker.tsx`
- Modify: `frontend/src/components/Map/WorldMap.tsx`

- [ ] **Step 1: Update `createCategoryIcon` to accept state**

In `ItemMarker.tsx`, update `createCategoryIcon` to accept an optional `state` param and change border/glow accordingly:

```ts
export type MarkerState = 'default' | 'wip' | 'done';

export function createCategoryIcon(
  category: string,
  itemId: string,
  state: MarkerState = 'default',
): L.DivIcon {
  const color = CATEGORY_COLORS[category] ?? '#999';
  const emoji = CATEGORY_EMOJIS[category] ?? '?';

  const borderColor =
    state === 'done' ? '#22c55e' :
    state === 'wip'  ? '#f59e0b' :
    'white';

  const boxShadow =
    state === 'wip'
      ? `0 4px 12px rgba(0,0,0,0.25), 0 0 0 0 rgba(245,158,11,0.5)`
      : '0 4px 12px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.1)';

  const animClass = state === 'wip' ? 'wip-pulse' : '';

  return L.divIcon({
    iconSize: [64, 64],
    iconAnchor: [32, 32],
    className: animClass,
    html: `<div data-item-id="${itemId}" style="
      width:64px;height:64px;border-radius:50%;
      background:linear-gradient(135deg,${color},${color}dd);
      display:flex;align-items:center;justify-content:center;
      font-size:28px;border:4px solid ${borderColor};
      box-shadow:${boxShadow};
    ">${emoji}</div>`,
  });
}
```

Add the WIP pulse CSS to `index.css` or a global style block (since Leaflet DivIcon `className` applies to the Leaflet wrapper):

```css
/* Add to frontend/src/index.css */
@keyframes wip-pulse {
  0%, 100% { box-shadow: 0 4px 12px rgba(0,0,0,0.25), 0 0 0 0 rgba(245,158,11,0.5); }
  50%       { box-shadow: 0 4px 12px rgba(0,0,0,0.25), 0 0 0 8px rgba(245,158,11,0); }
}
.wip-pulse { animation: wip-pulse 1.8s ease-in-out infinite; }
```

- [ ] **Step 2: Update `ItemMarker` component to accept state**

```ts
export function ItemMarker({
  item,
  state = 'default',
}: {
  item: ItemSummary;
  state?: MarkerState;
}) {
  return (
    <Marker
      position={[item.latitude, item.longitude]}
      icon={createCategoryIcon(item.category, item.id, state)}
    />
  );
}
```

- [ ] **Step 3: Consume progress in WorldMap**

In `WorldMap.tsx`, import `useProgress` and `useProfileStore`, then derive per-item state:

```ts
import { useProgress } from '../../hooks/useProgress';
import { useProfileStore } from '../../stores/profileStore';

// inside WorldMap():
const activeProfileId = useProfileStore((s) => s.activeProfileId);
const progress = useProgress(activeProfileId);
const doneSet = new Set(progress.done_item_ids);
const wipSet = new Set(progress.wip_item_ids);
```

Update the `<ItemMarker>` render to pass state:

```tsx
<ItemMarker
  key={item.id}
  item={item}
  state={
    doneSet.has(item.id) ? 'done' :
    (wipSet.has(item.id) && item.quiz_required) ? 'wip' :
    'default'
  }
/>
```

- [ ] **Step 4: Build to check for TS errors**

```bash
cd frontend && npm run build 2>&1 | grep -E "error TS|✓ built"
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Map/ItemMarker.tsx frontend/src/components/Map/WorldMap.tsx frontend/src/index.css
git commit -m "feat(quiz): 3-state map markers (default/wip/done)"
```

---

## Task 11: Frontend — fix `useDoneTracking` + quiz nudge

**Files:**
- Modify: `frontend/src/components/DoneTracking/useDoneTracking.ts`

- [ ] **Step 1: Fix optimistic update and add quiz nudge state**

Replace lines 88–103 of `useDoneTracking.ts` with:

```ts
  const [quizNudge, setQuizNudge] = useState(false);

  // When all gates pass, call backend. Do NOT set isDone/persistedRef before response.
  useEffect(() => {
    if (!persistedRef.current && profileId && alreadyDone === false && timeGate && scrollGate && mediaGate) {
      markItemDone(profileId, itemId)
        .then((response) => {
          if (response.status === 'quiz_required') {
            // Quiz still required — stay ungated, show nudge
            setQuizNudge(true);
          } else {
            persistedRef.current = true;
            setIsDone(true);
            if (response.newly_earned_badges.length > 0) {
              setNewlyEarnedBadges(response.newly_earned_badges);
            }
          }
        })
        .catch((err) => {
          console.error('Failed to persist done:', err);
        });
      // NOTE: persistedRef and isDone are set INSIDE .then(), not here
    }
  }, [timeGate, scrollGate, mediaGate, itemId, profileId, alreadyDone]);
```

Update `DoneTrackingResult` interface to include `quizNudge`:
```ts
interface DoneTrackingResult {
  isDone: boolean;
  quizNudge: boolean;   // true when 3-gate passed but quiz still required
  gates: { time: boolean; scroll: boolean; media: boolean; };
  markMediaInteracted: () => void;
  newlyEarnedBadges: BadgeInfo[];
}
```

Return `quizNudge` from the hook.

- [ ] **Step 2: Wire nudge into ItemDetailPage**

In `ItemDetailPage.tsx`, destructure `quizNudge` from `useDoneTracking`. When `quizNudge` is true, show a banner above the `QuizCard`:

```tsx
{quizNudge && (
  <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
    <span className="text-xl">🎯</span>
    <span className="text-sm font-semibold text-amber-800">Quiz time! Pass the quiz below to complete this item.</span>
  </div>
)}
```

- [ ] **Step 3: Build to check for TS errors**

```bash
cd frontend && npm run build 2>&1 | grep -E "error TS|✓ built"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/DoneTracking/useDoneTracking.ts frontend/src/pages/ItemDetailPage.tsx
git commit -m "feat(quiz): fix optimistic done update, add quiz nudge on quiz_required response"
```

---

## Task 12: Frontend — Wisdom badge section

**Files:**
- Modify: `frontend/src/pages/BadgeDisplayPage.tsx`

- [ ] **Step 1: Update `BadgeDisplayPage` to split Exploration / Wisdom**

The page currently groups all badges by `badge_type`. Wisdom badges have `badge_type === 'wisdom'`. Add a dedicated section for them below Exploration:

```tsx
// Add to BADGE_TYPE_EMOJI and BADGE_TYPE_BG:
const WISDOM_BADGE_EMOJIS: Record<string, string> = {
  quiz_first: '🎯',
  quiz_explorer: '📚',
  quiz_master: '🏆',
  quiz_daily_scholar: '🌟',
};

// Define all wisdom badge placeholders (earned + unearned)
const ALL_WISDOM_BADGES = [
  { key: 'quiz_first', name: 'First Quiz 🎯', description: 'Passed your very first quiz!', milestone: 1 },
  { key: 'quiz_explorer', name: 'Quiz Explorer 📚', description: 'Passed 5 quizzes!', milestone: 5 },
  { key: 'quiz_master', name: 'Quiz Master 🏆', description: 'Passed 50 quizzes — true wisdom!', milestone: 50 },
  { key: 'quiz_daily_scholar', name: 'Daily Scholar 🌟', description: 'Completed 5 daily quizzes!', milestone: 5 },
];
```

Separate `badges` into exploration and wisdom in the render:

```tsx
const explorationBadges = badges.filter(b => b.badge_type !== 'wisdom');
const wisdomBadges = badges.filter(b => b.badge_type === 'wisdom');
const earnedWisdomKeys = new Set(wisdomBadges.map(b => b.badge_key));
```

Below the existing exploration sections, add:

```tsx
{/* Wisdom Section */}
<div className="mb-6 mt-2">
  <h2 className="text-lg font-bold text-violet-700 mb-3 flex items-center gap-2">
    <span>🧠</span>
    <span>Wisdom</span>
  </h2>
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
    {ALL_WISDOM_BADGES.map((def) => {
      const earned = wisdomBadges.find(b => b.badge_key === def.key);
      return (
        <div
          key={def.key}
          className={`rounded-2xl shadow-md p-4 text-center border-2 ${
            earned
              ? 'bg-violet-50 border-violet-400'
              : 'bg-gray-50 border-gray-200 opacity-40'
          }`}
        >
          <div className="text-4xl mb-2 mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-white/60 ring-2 ring-violet-300">
            {WISDOM_BADGE_EMOJIS[def.key] ?? '🏆'}
          </div>
          <div className="font-bold text-gray-800 text-sm leading-tight mb-1">{def.name}</div>
          <div className="text-xs text-gray-500 mb-2 leading-snug">{def.description}</div>
          <span className="inline-block bg-white/80 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
            {def.milestone} {def.key === 'quiz_daily_scholar' ? 'daily' : 'quizzes'}
          </span>
        </div>
      );
    })}
  </div>
</div>
```

- [ ] **Step 2: Build to check for TS errors**

```bash
cd frontend && npm run build 2>&1 | grep -E "error TS|✓ built"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/BadgeDisplayPage.tsx
git commit -m "feat(quiz): add Wisdom badge section to BadgeDisplayPage"
```

---

## Task 13: Frontend — Admin `quiz_required` toggle

**Files:**
- Modify: `frontend/src/pages/admin/AdminItemEditorPage.tsx`

- [ ] **Step 1: Add `quiz_required` toggle in Quiz tab**

Find the Quiz tab section in `AdminItemEditorPage.tsx`. Add a toggle above the question list, visible only when `item.has_quiz`:

```tsx
{item.has_quiz && (
  <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
    <div>
      <div className="font-semibold text-sm text-amber-900">Require quiz to complete item</div>
      <div className="text-xs text-amber-700">When on, children must pass the quiz before this item counts as done</div>
    </div>
    <button
      onClick={() => handleToggleQuizRequired(!item.quiz_required)}
      className={`w-12 h-7 rounded-full transition-colors relative ${
        item.quiz_required ? 'bg-amber-400' : 'bg-gray-300'
      }`}
    >
      <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
        item.quiz_required ? 'translate-x-5' : 'translate-x-0.5'
      }`} />
    </button>
  </div>
)}
```

Add `handleToggleQuizRequired` that calls the admin item update API with `{ quiz_required: value }`.

- [ ] **Step 2: Build to check for TS errors**

```bash
cd frontend && npm run build 2>&1 | grep -E "error TS|✓ built"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/admin/AdminItemEditorPage.tsx
git commit -m "feat(quiz): admin quiz_required toggle in item editor"
```

---

## Task 14: Final build + push

- [ ] **Step 1: Full frontend build**

```bash
cd frontend && npm run build 2>&1 | tail -5
```
Expected: `✓ built in ...ms`

- [ ] **Step 2: Full backend test suite**

```bash
cd backend && pytest -q
```
Expected: all pass, 0 failures.

- [ ] **Step 3: Push to main**

```bash
git push origin main
```
