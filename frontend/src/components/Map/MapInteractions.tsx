import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";
import { indexMapItems, saveMapViewport } from "./mapHelpers";
import { beginMapPointer, isCompletedMapTap, mapTapAction, type MapPointerStart } from "./mapTouchInteraction";
import type { ItemSummary } from "../../types/item";

export function RememberMapViewport({ family, profile }: { family: string; profile: string }) {
  const map = useMap();
  useEffect(() => {
    const save = () => saveMapViewport(map, family, profile);
    map.on('moveend zoomend', save);
    return () => { map.off('moveend zoomend', save); };
  }, [map, family, profile]);
  return null;
}

function findItemMarkerElement(target: Element): Element | null {
  return (
    target.closest("[data-item-id]") ??
    (target.classList.contains("map-item-marker")
      ? target.querySelector("[data-item-id]")
      : null)
  );
}

function findClusterElement(target: Element): Element | null {
  return (
    target.closest("[data-cluster]") ??
    (target.classList.contains("map-cluster-marker")
      ? target.querySelector("[data-cluster]")
      : null)
  );
}

/**
 * Handles actual touch pointers separately from mouse clicks so a marker drag
 * remains a map pan, a numbered cluster expands, and a precise touch marker
 * opens its detail page. Capture phase is required because Leaflet stops
 * marker clicks.
 * react-leaflet-cluster v4 breaks standard Leaflet marker click binding, so
 * we detect taps via the data-item-id attribute embedded in each DivIcon.
 */
export function MarkerClickHandler({
  items,
  onSelect,
  onOpenDetail,
  onInputModeChange,
  onCluster,
}: {
  items: ItemSummary[];
  onSelect: (item: ItemSummary) => void;
  onOpenDetail: (item: ItemSummary) => void;
  onInputModeChange: (mode: "mouse" | "touch") => void;
  onCluster?: (target: Element) => void;
}) {
  const map = useMap();
  const activePointerRef = useRef<{ start: MapPointerStart; target: Element } | null>(null);
  const lastHandledTapAtRef = useRef(0);
  const itemIndex = useMemo(() => indexMapItems(items), [items]);
  const latest = useRef({ itemIndex, onSelect, onOpenDetail, onInputModeChange, onCluster });
  latest.current = { itemIndex, onSelect, onOpenDetail, onInputModeChange, onCluster };

  useEffect(() => {
    const container = map.getContainer();

    function handlePointerDown(event: PointerEvent) {
      lastHandledTapAtRef.current = 0;

      if (!event.isPrimary || !(event.target instanceof Element)) {
        activePointerRef.current = null;
        return;
      }

      const start = beginMapPointer(event);
      activePointerRef.current = start ? { start, target: event.target } : null;
      if (event.pointerType === "mouse") {
        latest.current.onInputModeChange("mouse");
      }
    }

    function handlePointerUp(event: PointerEvent) {
      const completedPointer = activePointerRef.current;
      activePointerRef.current = null;

      if (!completedPointer || !isCompletedMapTap(completedPointer.start, event)) {
        return;
      }

      latest.current.onInputModeChange(completedPointer.start.pointerType === "touch" ? "touch" : "mouse");
      const markerElement = findItemMarkerElement(completedPointer.target);
      if (markerElement) {
        const id = markerElement.getAttribute("data-item-id");
        const item = latest.current.itemIndex.get(id ?? '');
        if (item) {
          event.preventDefault();
          lastHandledTapAtRef.current = Date.now();
          const action = mapTapAction(completedPointer.start.pointerType, "item");
          if (action === "open-detail") {
            latest.current.onOpenDetail(item);
          } else {
            latest.current.onSelect(item);
          }
        }
        return;
      }

      const clusterElement = findClusterElement(completedPointer.target);
      if (clusterElement) {
        if (latest.current.onCluster) {
          event.preventDefault();
          lastHandledTapAtRef.current = Date.now();
          latest.current.onCluster(clusterElement);
        }
      }
    }

    function handlePointerCancel() {
      activePointerRef.current = null;
    }

    function handleClick(event: MouseEvent) {
      if (Date.now() - lastHandledTapAtRef.current < 800) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (!(event.target instanceof Element)) return;
      const markerElement = findItemMarkerElement(event.target);
      if (!markerElement) return;

      const id = markerElement.getAttribute("data-item-id");
      const item = latest.current.itemIndex.get(id ?? '');
      if (item) {
        event.preventDefault();
        latest.current.onSelect(item);
      }
    }

    container.addEventListener("pointerdown", handlePointerDown, true);
    container.addEventListener("pointerup", handlePointerUp, true);
    container.addEventListener("pointercancel", handlePointerCancel, true);
    container.addEventListener("click", handleClick, true);
    return () => {
      container.removeEventListener("pointerdown", handlePointerDown, true);
      container.removeEventListener("pointerup", handlePointerUp, true);
      container.removeEventListener("pointercancel", handlePointerCancel, true);
      container.removeEventListener("click", handleClick, true);
    };
  }, [map]);

  return null;
}

export function MapMotionController({
  selectedItem,
}: {
  selectedItem: ItemSummary | null;
}) {
  const map = useMap();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      map.invalidateSize({ pan: false, debounceMoveend: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [map]);

  useEffect(() => {
    if (!selectedItem) return;

    const nextCenter = L.latLng(selectedItem.latitude, selectedItem.longitude);
    const paddedBounds = map.getBounds().pad(-0.2);
    const targetZoom = Math.max(map.getZoom(), 4);
    const shouldFly = !paddedBounds.contains(nextCenter) || map.getZoom() < 4;

    if (shouldFly) {
      map.flyTo(nextCenter, targetZoom, {
        animate: true,
        duration: 0.9,
        easeLinearity: 0.2,
        noMoveStart: true,
      });
      return;
    }

    map.panTo(nextCenter, {
      animate: true,
      duration: 0.5,
      easeLinearity: 0.25,
      noMoveStart: true,
    });
  }, [map, selectedItem]);

  return null;
}

/**
 * A fixed, non-interactive frame gives the illustrated world a storybook
 * boundary while leaving the Leaflet surface and its markers fully usable.
 * It belongs inside the map container so it stays anchored to the viewport
 * as the map is panned or zoomed.
 */
/**
 * Main world map with a bundled illustrated vector base, marker
 * clustering, category filtering, and click-to-show-popup behavior.
 */
