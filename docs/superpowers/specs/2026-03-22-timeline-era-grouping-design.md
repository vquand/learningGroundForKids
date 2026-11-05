# Timeline Era Grouping Design

## Goal

Replace the horizontally-scrolling dot timeline with a viewport-fitting era-bar timeline that always fits without scrolling. Users tap an era to expand it, pick a specific year, and the bar collapses back showing an active indicator.

## Context

The current `TimelineScrubber` renders one dot per unique `start_year` across ~264 items. With `flex-shrink-0` on each dot and `overflowX: auto`, the bar scrolls horizontally on small screens. The era grouping removes scrolling entirely by collapsing years into 5 proportional era bars.

The `filterStore` (`activeYear: number | null`) and the `eraMatches()` function in `WorldMap.tsx` do not change — the store contract stays the same. The new design is purely a UI replacement.

---

## Era Definitions

Five hardcoded eras cover the full range of seed data (dinosaurs ~65M BCE to 2022 CE). Era boundaries use `start_year` (integer, negative = BCE):

| Era ID | Emoji + Label | `start_year` range | Note |
|--------|--------------|-------------------|------|
| `dino` | 🦕 Dino Age | `≤ -10000` | Covers prehistoric life and dinosaurs |
| `ancient` | 🏛️ Long Ago | `-9999 … 500` | `start_year > -10000 && start_year <= 500` |
| `medieval` | ⚔️ Middle Ages | `501 … 1500` | `start_year > 500 && start_year <= 1500` |
| `olden` | 🚂 Olden Times | `1501 … 1900` | `start_year > 1500 && start_year <= 1900` |
| `today` | 🌍 Today | `> 1900` | `start_year > 1900` |

The `-10000` boundary is intentional: the Neolithic transition (~10,000 BCE) is a conventional dividing line between prehistoric and ancient history.

**Items with no `start_year`** are not assigned to any era. When an era filter is active these items are hidden — identical to current behaviour.

**Synthetic Year 0 dot removed.** The current implementation injects a `{ year: 0, count: 0 }` landmark dot. This is dropped entirely; era bars serve the same anchoring purpose without a confusing zero-item result.

---

## Component Architecture

### `TimelineScrubber.tsx` — full rewrite

**Props:** unchanged — `{ items: ItemSummary[] }`

**Local state:**
- `expandedEra: string | null` — which era is currently expanded (purely UI, not persisted to store)

**Store:** unchanged — reads `activeYear`, `setActiveYear`, `clearEra` from `filterStore`

**Derived data (useMemo):**
```
eraBuckets: Array of {
  id: string,          // 'dino' | 'ancient' | 'medieval' | 'olden' | 'today'
  label: string,       // e.g. '🦕 Dino Age'
  color: string,       // bar fill colour
  years: number[],     // sorted unique start_year values in this era
  itemCount: number,   // total items (for proportional sizing)
}
```
Only eras with `itemCount > 0` are rendered. If all items lack `start_year` the component returns `null`.

**Active era detection:** The era that contains `activeYear` is computed at render time from the era table. No additional store field is needed.

**Flex sizing:**
- Default: each era gets `flex-grow` proportional to its `itemCount`, with `min-width: 44px` as the hard floor.
- Expanded: the expanded era gets `flex: 2.5`; all others get `flex: 0.5` and hide their text label (bar only visible).
- This is always a valid layout at any viewport width — no overflow.

### `filterStore.ts` — no change

### `WorldMap.tsx` — no change

---

## Interaction Flow

### 1. Default state (all collapsed)
- 5 era bars fill 100% of the timeline width, no scrollbar anywhere
- Each bar: `height: 10px`, rounded, colour-coded per era
- Below each bar: label (`🦕 Dino Age`) + item count (`×10`)

### 2. Tap an era bar → expand
- The tapped era expands: its slot widens to `flex: 2.5` and displays an inner **year dots panel**
- Other eras shrink to `flex: 0.5` and hide their text (bar only)
- Expand animation: CSS `@keyframes era-expand` — `scaleX(0.7) opacity(0)` → `scaleX(1) opacity(1)`, 180ms ease-out
- The year dots panel has `overflow-x: auto; scrollbar-width: none` so long eras (e.g. 🌍 Today with 15+ years) scroll internally without the outer container growing. Container stays at `h-[72px]`.
- Tapping the same expanded era bar again (with no year active) collapses it back without changing `activeYear`

### 3. Tap a year dot → select
- Calls `setActiveYear(year)` on the store
- `expandedEra` resets to `null`; all era bars restore normal sizes (animated collapse)
- The bar for the era containing the newly active year turns amber (`#fbbf24`) with a glow, and its count label is replaced with the year string (e.g. `1950`)
- A **✕ Clear** button appears at `position: absolute; right: 8px` inside the timeline

### 4. Re-expand to change year
- Tapping the glowing (active) era bar re-expands it (`expandedEra = eraId`)
- Inside the panel the currently selected year dot appears highlighted (larger amber circle)
- Tapping a different dot calls `setActiveYear(newYear)` and collapses again
- Tapping the same highlighted dot calls `clearEra()` (toggle-off behaviour, matching current UX)

### 5. Clear
- ✕ Clear calls `clearEra()` — sets `activeYear: null` only
- Does **not** call `clearFilters()` (which only touches `activeCategories`)
- `expandedEra` resets to `null`; all bars return to default appearance
- ✕ Clear button disappears

---

## Year Dot Labels

`formatYearShort()` is reused. For very large negative years (dino era) it already produces compact strings like `-65M`. Labels are rendered at `9px` and are intentionally abbreviated — children in the dino era are exploring geological scale, not precision dates. This is acceptable.

---

## Layout & Styling

**Container** (`TimelineScrubber` root div):
- Existing classes kept: `absolute top-0 left-[80px] right-0 z-[1000] h-[72px] bg-white/90 rounded-b-2xl shadow-md scrubber-slide-down`
- **Removed:** `overflowX: auto`, `scrollbarWidth: none`, `msOverflowStyle`, `WebkitOverflowScrolling`, `scrollSnapType`, `flex-shrink-0` on children, `pr-40` padding
- Inner layout: `display: flex; align-items: center; gap: 4px; padding: 0 12px; width: 100%`

**Era bar colours:**
| Era | Bar colour |
|-----|-----------|
| 🦕 Dino Age | `#a78bfa` |
| 🏛️ Long Ago | `#818cf8` |
| ⚔️ Middle Ages | `#f97316` |
| 🚂 Olden Times | `#facc15` |
| 🌍 Today | `#34d399` |

**Active state:** amber `#fbbf24` with `box-shadow: 0 0 10px rgba(251,191,36,0.5)`

**Year dots panel (inside expanded era):**
- Background `#fef9ee`, border `1.5px solid #fcd34d`, border-radius `12px`
- Height fills available space within the 72px container (~56px)
- Inner scroll: `overflow-x: auto; scrollbar-width: none` — dots don't wrap, they scroll horizontally within the panel
- Inactive dot: 11×11px circle in era colour, `min-width: 44px` tap target
- Selected dot: 15×15px, `#f59e0b`, amber glow
- Label: `formatYearShort(year)`, `9px`, below the circle

**✕ Clear button:**
- `position: absolute; right: 8px; top: 50%; transform: translateY(-50%)`
- `background: #fef3c7; border: 1.5px solid #fcd34d; border-radius: 20px; padding: 3px 10px`
- Fade-in animation on appear, fade-out on remove

**CSS additions to `app.css`:**
- `@keyframes era-expand`: `scaleX(0.7) + opacity 0 → scaleX(1) + opacity 1`, 180ms ease-out, `transform-origin: left`
- `@keyframes era-bar-glow`: same pulse pattern as existing `dot-active-glow` but applied to bar `box-shadow`
- Remove: `.dot-active-glow`, `.dot-select-pulse` (no longer used after rewrite). Keep: `.scrubber-slide-down`.

---

## Accessibility

The `role="slider"` on the root container is removed (no longer semantically a slider). Replacement:
- Root div: `role="group" aria-label="Filter by historical era"`
- Each collapsed era button: `aria-label="🦕 Dino Age, 10 items"`, `aria-expanded={expandedEra === id}`
- Each year dot button inside expanded panel: `aria-label={formatYearShort(year)}, aria-pressed={activeYear === year}`
- ✕ Clear button: `aria-label="Clear era filter"`

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/Map/TimelineScrubber.tsx` | Full rewrite |
| `frontend/src/app.css` | Add `era-expand` + `era-bar-glow` animations; remove unused `dot-active-glow`, `dot-select-pulse` |
| `frontend/src/stores/filterStore.ts` | No change |
| `frontend/src/components/Map/WorldMap.tsx` | No change |
| `frontend/src/utils/formatYear.ts` | No change |

---

## What Does Not Change

- `filterStore` shape — `activeYear: number | null`
- `setActiveYear` / `clearEra` call sites
- `eraMatches()` logic in `WorldMap.tsx`
- `TimelineScrubberProps` interface (`items: ItemSummary[]`)
- `scrubber-slide-down` entrance animation
- Items without `start_year` are hidden when any era filter is active
