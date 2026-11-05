import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useMemo, useState } from "react";
import { ERA_DEFINITIONS, getEraId } from "../../lib/eras";
import { useFilterStore } from "../../stores/filterStore";
import { formatYearShort } from "../../utils/formatYear";
import type { ItemSummary } from "../../types/item";
import type { ExploreTimelineYear } from '../../types/explore';

interface TimelineScrubberProps {
  items?: ItemSummary[];
  years?: ExploreTimelineYear[];
}

// ---------------------------------------------------------------------------
// Era definitions — ordered oldest → newest
// ---------------------------------------------------------------------------
const ERAS = [
  { ...ERA_DEFINITIONS[0], color: "#a78bfa", activeColor: "#7c3aed" },
  { ...ERA_DEFINITIONS[1], color: "#818cf8", activeColor: "#4338ca" },
  { ...ERA_DEFINITIONS[2], color: "#f97316", activeColor: "#c2410c" },
  { ...ERA_DEFINITIONS[3], color: "#facc15", activeColor: "#a16207" },
  { ...ERA_DEFINITIONS[4], color: "#34d399", activeColor: "#065f46" },
] as const;

type EraId = (typeof ERAS)[number]["id"];

interface EraBucket {
  id: EraId;
  label: string;
  color: string;
  activeColor: string;
  years: number[];   // sorted unique start_year values in this era
  itemCount: number; // total items (drives proportional flex sizing)
}

export function TimelineScrubber({ items = [], years }: TimelineScrubberProps) {
  useUiLanguage();
  const activeYear   = useFilterStore((s) => s.activeYear);
  const setActiveYear = useFilterStore((s) => s.setActiveYear);
  const clearEra     = useFilterStore((s) => s.clearEra);

  // Which era panel is currently open (local UI state only)
  const [expandedEra, setExpandedEra] = useState<EraId | null>(null);

  // Build era buckets: one entry per era that has ≥1 item
  const eraBuckets = useMemo<EraBucket[]>(() => {
    const yearSets  = new Map<EraId, Set<number>>();
    const counts    = new Map<EraId, number>();

    for (const item of years ?? items.flatMap(item => item.start_year == null ? [] : [{ year: item.start_year, count: 1 }])) {
      const eraId = getEraId(item.year);
      if (eraId === null) continue;
      if (!yearSets.has(eraId)) {
        yearSets.set(eraId, new Set());
        counts.set(eraId, 0);
      }
      yearSets.get(eraId)!.add(item.year);
      counts.set(eraId, (counts.get(eraId) ?? 0) + item.count);
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
  }, [items, years]);

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
      className="explore-timeline pointer-events-auto scrubber-slide-down"
      role="group"
      aria-label={uiText("Filter by historical era")}
    >
      <div className="explore-timeline__eras">
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
                className="era-expand flex min-w-11 items-center h-11 rounded-xl px-2"
                style={{
                  flex: "2.5 0 0",
                  background: "#fef9ee",
                  border: "1.5px solid #fcd34d",
                  overflowX: "auto",
                  // hide scrollbar
                  scrollbarWidth: "none",
                  // @ts-ignore IE/Edge vendor
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
              className="explore-era flex flex-col items-center justify-center gap-1 px-1 py-1 rounded-lg active:bg-gray-50 transition-colors"
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
                    className="explore-era__label"
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
          aria-label={uiText("Clear era filter")}
          className="explore-timeline__clear rounded-full font-bold active:scale-95 transition-all"
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
