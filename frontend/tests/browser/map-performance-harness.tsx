import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useState } from "react";

import { WorldMap } from "../../src/components/Map/WorldMap";
import { useFilterStore } from "../../src/stores/filterStore";
import { useFamilyStore } from "../../src/stores/familyStore";
import { useProfileStore } from "../../src/stores/profileStore";
import type { ItemSummary } from "../../src/types/item";
import type { ProgressResponse } from "../../src/types/progress";
import "../../src/app.css";

type MarkerMethod = "setIcon" | "setLatLng";

interface MapHarnessApi {
  counts: Record<MarkerMethod, number>;
  countIds: Record<MarkerMethod, string[]>;
  navigation: string[];
  filteredCount: number;
  resetCounters: () => void;
}

declare global {
  interface Window {
    testMap: MapHarnessApi;
  }
}

const counts: Record<MarkerMethod, number> = { setIcon: 0, setLatLng: 0 };
const countIds: Record<MarkerMethod, string[]> = { setIcon: [], setLatLng: [] };
const navigation: string[] = [];

function markerId(marker: L.Marker): string | null {
  const html = marker.options.icon instanceof L.DivIcon
    ? marker.options.icon.options.html
    : undefined;
  return html?.match(/data-item-id="([^"]+)"/)?.[1] ?? null;
}

for (const method of ["setIcon", "setLatLng"] as const) {
  const original = L.Marker.prototype[method];
  L.Marker.prototype[method] = function instrumentedMarkerMethod(...args: never[]) {
    const id = markerId(this);
    if (id) {
      counts[method] += 1;
      countIds[method].push(id);
    }
    return original.apply(this, args as never);
  } as typeof original;
}

window.testMap = {
  counts,
  countIds,
  navigation,
  filteredCount: 0,
  resetCounters() {
    counts.setIcon = 0;
    counts.setLatLng = 0;
    countIds.setIcon.length = 0;
    countIds.setLatLng.length = 0;
  },
};

const categories = ["animal", "food", "monument", "landmark", "music"] as const;

function createItems(): ItemSummary[] {
  const clustered = Array.from({ length: 500 }, (_, index) => ({
    id: `cluster-item-${index}`,
    category: categories[index % categories.length]!,
    latitude: 20 + (index % 10) * 0.01,
    longitude: -2 + Math.floor(index / 10) * 0.0008,
    title: `Clustered learning item ${index + 1}`,
    icon_slug: categories[index % categories.length]!,
    start_year: index % 2 === 0 ? 1400 : 2024,
    end_year: index % 2 === 0 ? 1600 : 2026,
    quiz_required: index % 3 === 0,
  } satisfies ItemSummary));

  return [
    {
      id: "isolated-item",
      category: "animal",
      latitude: -20,
      longitude: 90,
      title: "Isolated polar fox",
      icon_slug: "animal",
      start_year: 2024,
      end_year: 2026,
      quiz_required: true,
    },
    ...clustered,
  ];
}

const items = createItems();
const emptyProgress: ProgressResponse = { done_item_ids: [], wip_item_ids: [] };
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function eraMatches(item: ItemSummary, activeYear: number | null): boolean {
  if (activeYear === null) return true;
  if (item.start_year == null) return false;
  const end = item.end_year ?? new Date().getFullYear();
  return item.start_year <= activeYear && activeYear <= end;
}

function MapHarnessControls({
  progress,
  setProgress,
  enableDetailNavigation,
  onEnableDetailNavigation,
}: {
  progress: ProgressResponse;
  setProgress: (next: ProgressResponse) => void;
  enableDetailNavigation: boolean;
  onEnableDetailNavigation: () => void;
}) {
  const activeCategories = useFilterStore((state) => state.activeCategories);
  const activeYear = useFilterStore((state) => state.activeYear);
  const toggleCategory = useFilterStore((state) => state.toggleCategory);
  const clearFilters = useFilterStore((state) => state.clearFilters);
  const setActiveYear = useFilterStore((state) => state.setActiveYear);
  const filteredCount = useMemo(() => items.filter((item) =>
    (activeCategories.length === 0 || activeCategories.includes(item.category)) &&
    eraMatches(item, activeYear),
  ).length, [activeCategories, activeYear]);

  useEffect(() => {
    window.testMap.filteredCount = filteredCount;
  }, [filteredCount]);

  return (
    <aside className="map-test-controls" aria-label="Map performance controls">
      <output data-testid="filtered-count">{filteredCount}</output>
      <output data-testid="progress-state">{progress.done_item_ids.join(",")}|{progress.wip_item_ids.join(",")}</output>
      <button type="button" data-testid="mark-isolated-done" onClick={() => setProgress({ done_item_ids: ["isolated-item"], wip_item_ids: [] })}>
        Mark isolated earned
      </button>
      <button type="button" data-testid="mark-isolated-wip" onClick={() => setProgress({ done_item_ids: [], wip_item_ids: ["isolated-item"] })}>
        Mark isolated in progress
      </button>
      <button type="button" data-testid="filter-food" aria-pressed={activeCategories.includes("food")} onClick={() => toggleCategory("food")}>
        Toggle food category
      </button>
      <button type="button" data-testid="filter-ancient" aria-pressed={activeYear === 1500} onClick={() => setActiveYear(activeYear === 1500 ? null : 1500)}>
        Toggle 1500 timeline
      </button>
      <button type="button" data-testid="clear-filters" onClick={() => { clearFilters(); setActiveYear(null); }}>
        Clear filters
      </button>
      <button type="button" data-testid="enable-detail-navigation" aria-pressed={enableDetailNavigation} onClick={onEnableDetailNavigation}>
        Enable detail navigation
      </button>
    </aside>
  );
}

function MapPerformanceHarness() {
  const [progress, setProgress] = useState(emptyProgress);
  const [enableDetailNavigation, setEnableDetailNavigation] = useState(false);
  const onOpenDetail = useCallback((item: ItemSummary) => {
    navigation.push(item.id);
  }, []);

  useEffect(() => {
    useFilterStore.getState().clearFilters();
    useFilterStore.getState().clearEra();
    setProgress(emptyProgress);
    navigation.length = 0;
    window.testMap.resetCounters();
  }, []);

  useEffect(() => {
    queryClient.setQueryData(["progress", "local-uat", "map-test-profile"], progress);
  }, [progress]);

  return (
    <main className="map-test-page" style={{ minHeight: "100vh" }}>
      <MapHarnessControls
        progress={progress}
        setProgress={setProgress}
        enableDetailNavigation={enableDetailNavigation}
        onEnableDetailNavigation={() => setEnableDetailNavigation(true)}
      />
      <section className="map-test-surface" aria-label="World map" style={{ height: "calc(100vh - 96px)", minHeight: "560px" }}>
        <WorldMap
          itemsOverride={items}
          progressOverride={progress}
          {...(enableDetailNavigation ? { onOpenDetail } : {})}
        />
      </section>
    </main>
  );
}

useFamilyStore.setState({ familyId: "map-test-family", sessionGeneration: 1, isInitializing: false });
useProfileStore.setState({ activeProfileId: "map-test-profile" });

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={["/map-performance"]}>
      <MapPerformanceHarness />
    </MemoryRouter>
  </QueryClientProvider>,
);
