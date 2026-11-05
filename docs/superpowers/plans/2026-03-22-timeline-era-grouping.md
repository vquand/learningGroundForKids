# Timeline Era Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the horizontally-scrolling year-dot timeline with a viewport-fitting era-bar timeline that groups years into 5 kid-friendly eras, expands on tap to show year dots, and collapses back with an active indicator — no horizontal scroll ever.

**Architecture:** `TimelineScrubber.tsx` is a full rewrite; the `filterStore` shape (`activeYear: number | null`) is unchanged so `WorldMap.tsx` filtering requires zero edits. Era bucket data is derived via `useMemo` from the existing `items` prop. The only other change is two new CSS keyframes and removal of two now-unused ones in `app.css`.

**Tech Stack:** React 18, TypeScript (`noUncheckedIndexedAccess`), Tailwind CSS, Zustand

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/components/Map/TimelineScrubber.tsx` | Full rewrite (~130 lines) |
| `frontend/src/app.css` | Add 2 keyframes + classes, remove 2 unused ones |

No other files change.

---

## Task 1: Update CSS animations

**Files:**
- Modify: `frontend/src/app.css` (lines ~62–100, the "Phase 7: Timeline animations" block)

- [ ] **Step 1: Remove the two dot animations that will be unused**

In `frontend/src/app.css`, delete these two keyframes and their classes:

```css
/* DELETE these four blocks: */

@keyframes dot-select-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

@keyframes dot-active-glow {
  0%, 100% { box-shadow: 0 0 4px #fcd34d80; }
  50% { box-shadow: 0 0 12px #fcd34d80; }
}

.dot-select-pulse {
  animation: dot-select-pulse 300ms ease-out;
}

.dot-active-glow {
  animation: dot-active-glow 2000ms ease-in-out infinite;
}
```

- [ ] **Step 2: Add the two new era animations**

In their place, add:

```css
/* Era expand: panel pops open from the left */
@keyframes era-expand {
  from { transform: scaleX(0.7); opacity: 0; }
  to   { transform: scaleX(1);   opacity: 1; }
}

/* Era bar glow: active era pulses amber */
@keyframes era-bar-glow {
  0%, 100% { box-shadow: 0 0 4px rgba(251, 191, 36, 0.5); }
  50%       { box-shadow: 0 0 12px rgba(251, 191, 36, 0.8); }
}

.era-expand {
  animation: era-expand 180ms ease-out;
  transform-origin: left center;
}

.era-bar-glow {
  animation: era-bar-glow 2000ms ease-in-out infinite;
}
```

- [ ] **Step 3: Verify build still passes**

```bash
cd frontend && npm run build
```

Expected: no TypeScript or CSS errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app.css
git commit -m "style(timeline): replace dot animations with era-expand and era-bar-glow"
```

---

## Task 2: Rewrite TimelineScrubber

**Files:**
- Modify: `frontend/src/components/Map/TimelineScrubber.tsx` (full rewrite)

- [ ] **Step 1: Verify the build passes before touching anything**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: exits 0 (or only pre-existing warnings).

- [ ] **Step 2: Replace the entire file content**

Write `frontend/src/components/Map/TimelineScrubber.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useFilterStore } from "../../stores/filterStore";
import { formatYearShort } from "../../utils/formatYear";
import type { ItemSummary } from "../../types/item";

interface TimelineScrubberProps {
  items: ItemSummary[];
}

// ---------------------------------------------------------------------------
// Era definitions — ordered oldest → newest
// ---------------------------------------------------------------------------
const ERAS = [
  { id: "dino",     label: "🦕 Dino Age",    color: "#a78bfa", activeColor: "#7c3aed" },
  { id: "ancient",  label: "🏛️ Long Ago",     color: "#818cf8", activeColor: "#4338ca" },
  { id: "medieval", label: "⚔️ Middle Ages",  color: "#f97316", activeColor: "#c2410c" },
  { id: "olden",    label: "🚂 Olden Times",  color: "#facc15", activeColor: "#a16207" },
  { id: "today",    label: "🌍 Today",         color: "#34d399", activeColor: "#065f46" },
] as const;

type EraId = (typeof ERAS)[number]["id"];

/** Assign a year (integer, negative = BCE) to an era. */
function getEraId(year: number): EraId {
  if (year <= -10000) return "dino";
  if (year <= 500)    return "ancient";
  if (year <= 1500)   return "medieval";
  if (year <= 1900)   return "olden";
  return "today";
}

interface EraBucket {
  id: EraId;
  label: string;
  color: string;
  activeColor: string;
  years: number[];   // sorted unique start_year values in this era
  itemCount: number; // total items (drives proportional flex sizing)
}

export function TimelineScrubber({ items }: TimelineScrubberProps) {
  const activeYear   = useFilterStore((s) => s.activeYear);
  const setActiveYear = useFilterStore((s) => s.setActiveYear);
  const clearEra     = useFilterStore((s) => s.clearEra);

  // Which era panel is currently open (local UI state only)
  const [expandedEra, setExpandedEra] = useState<EraId | null>(null);

  // Build era buckets: one entry per era that has ≥1 item
  const eraBuckets = useMemo<EraBucket[]>(() => {
    const yearSets  = new Map<EraId, Set<number>>();
    const counts    = new Map<EraId, number>();

    for (const item of items) {
      if (item.start_year == null) continue;
      const eraId = getEraId(item.start_year);
      if (!yearSets.has(eraId)) {
        yearSets.set(eraId, new Set());
        counts.set(eraId, 0);
      }
      yearSets.get(eraId)!.add(item.start_year);
      counts.set(eraId, (counts.get(eraId) ?? 0) + 1);
    }

    return ERAS
      .map((era) => ({
        id:         era.id,
        label:      era.label,
        color:      era.color,
        activeColor: era.activeColor,
        years:      Array.from(yearSets.get(era.id) ?? []).sort((a, b) => a - b),
        itemCount:  counts.get(era.id) ?? 0,
      }))
      .filter((b) => b.itemCount > 0);
  }, [items]);

  if (eraBuckets.length === 0) return null;

  const activeEraId  = activeYear != null ? getEraId(activeYear) : null;
  const totalItems   = eraBuckets.reduce((s, b) => s + b.itemCount, 0);

  function handleEraTap(eraId: EraId) {
    // Toggle expand/collapse; does not touch activeYear
    setExpandedEra((prev) => (prev === eraId ? null : eraId));
  }

  function handleYearTap(year: number) {
    if (activeYear === year) {
      clearEra();
    } else {
      setActiveYear(year);
    }
    setExpandedEra(null);
  }

  function handleClear() {
    clearEra();
    setExpandedEra(null);
  }

  return (
    <div
      className="pointer-events-auto absolute top-0 left-[80px] right-0 z-[1000] h-[72px] bg-white/90 rounded-b-2xl shadow-md scrubber-slide-down"
      role="group"
      aria-label="Filter by historical era"
    >
      <div className="flex h-full items-center gap-1 px-3 pr-14">
        {eraBuckets.map((bucket) => {
          const isExpanded = expandedEra === bucket.id;
          const isActive   = activeEraId === bucket.id;
          // Proportional flex-grow, min 0.5 so tiny eras stay visible
          const flexGrow   = Math.max(0.5, (bucket.itemCount / totalItems) * eraBuckets.length);

          /* ── Expanded state: show year dots ── */
          if (isExpanded) {
            return (
              <div
                key={bucket.id}
                className="era-expand flex items-center h-[56px] rounded-xl px-2"
                style={{
                  flex: "2.5 0 0",
                  background: "#fef9ee",
                  border: "1.5px solid #fcd34d",
                  overflowX: "auto",
                  // hide scrollbar
                  scrollbarWidth: "none",
                  // @ts-expect-error IE/Edge vendor
                  msOverflowStyle: "none",
                }}
              >
                {bucket.years.map((year) => {
                  const isSelected = activeYear === year;
                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => handleYearTap(year)}
                      aria-label={formatYearShort(year)}
                      aria-pressed={isSelected}
                      className="flex flex-col items-center justify-center gap-1 rounded-lg active:bg-amber-50 transition-colors"
                      style={{ minWidth: 44, minHeight: 44, padding: "0 4px" }}
                    >
                      <div
                        className="rounded-full transition-all duration-150"
                        style={{
                          width:      isSelected ? 15 : 11,
                          height:     isSelected ? 15 : 11,
                          background: isSelected ? "#f59e0b" : bucket.color,
                          boxShadow:  isSelected ? "0 0 8px rgba(251,191,36,0.5)" : undefined,
                        }}
                      />
                      <span
                        style={{
                          fontSize:   9,
                          fontWeight: isSelected ? 800 : 500,
                          color:      isSelected ? "#92400e" : "#6b7280",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatYearShort(year)}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          }

          /* ── Collapsed state: era bar ── */
          // When another era is expanded, this bar shows bar only (no labels)
          const someOtherExpanded = expandedEra !== null && !isExpanded;
          return (
            <button
              key={bucket.id}
              type="button"
              onClick={() => handleEraTap(bucket.id)}
              aria-label={`${bucket.label}, ${bucket.itemCount} items`}
              aria-expanded={isExpanded}
              className="flex flex-col items-center gap-1 px-1 py-1 rounded-lg active:bg-gray-50 transition-colors"
              style={{ flex: `${someOtherExpanded ? 0.5 : flexGrow} 1 0`, minWidth: 44 }}
            >
              {/* Bar */}
              <div
                className={isActive ? "era-bar-glow" : ""}
                style={{
                  height:     10,
                  borderRadius: 5,
                  width:      "100%",
                  background: isActive ? "#fbbf24" : bucket.color,
                  boxShadow:  isActive ? "0 0 10px rgba(251,191,36,0.5)" : undefined,
                  transition: "background 0.3s",
                }}
              />
              {/* Label + count — hidden when another era is expanded */}
              {!someOtherExpanded && (
                <>
                  <span
                    style={{
                      fontSize:   9,
                      fontWeight: 800,
                      color:      bucket.activeColor,
                      textAlign:  "center",
                      lineHeight: 1.1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {bucket.label}
                  </span>
                  <span
                    style={{
                      fontSize:   8,
                      fontWeight: isActive ? 700 : 400,
                      color:      isActive ? "#92400e" : "#9ca3af",
                    }}
                  >
                    {isActive && activeYear != null
                      ? formatYearShort(activeYear)
                      : `×${bucket.itemCount}`}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Clear button — only visible when a year is active */}
      {activeYear !== null && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear era filter"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full font-bold active:scale-95 transition-all"
          style={{
            minHeight:  44,
            minWidth:   44,
            padding:    "3px 10px",
            background: "#fef3c7",
            border:     "1.5px solid #fcd34d",
            color:      "#92400e",
            fontSize:   13,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error|warning"
```

Expected: zero TypeScript errors. (Vite build warnings about bundle size are fine.)

- [ ] **Step 4: Manual smoke-test in browser**

```bash
docker compose up --build -d
```

Open `http://localhost`. Check:
1. Timeline bar appears at the top — no horizontal scrollbar
2. Coloured era bars visible, labels like "🦕 Dino Age ×10"
3. Tap an era → it expands showing year dots, other eras shrink
4. Tap a year dot → panel collapses, tapped era bar turns amber and shows the year
5. ✕ button appears and clears the filter when tapped
6. Tap glowing era bar → re-expands showing the selected dot highlighted
7. Timeline still fits at narrow widths (DevTools → 360px wide)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Map/TimelineScrubber.tsx
git commit -m "feat(timeline): replace scroll dots with era-grouping bar

5 kid-friendly era bars (Dino Age / Long Ago / Middle Ages / Olden Times
/ Today) replace the horizontally-scrolling dot row. Always fits viewport.
Tap an era to expand year dots; tap a year to collapse back with amber
active indicator. filterStore shape unchanged."
```
