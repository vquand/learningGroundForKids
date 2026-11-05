const MAX_TAP_DISTANCE = 12;
const MAX_TAP_DURATION_MS = 650;

export interface MapPointerSample {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  timeStamp: number;
}

export interface MapPointerStart {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  timeStamp: number;
}

export type MapTapTarget = "item" | "cluster" | "map";
export type MapTapAction =
  | "open-detail"
  | "show-preview"
  | "expand-cluster"
  | "none";
export type ClusterTapAction = "zoom-to-bounds" | "spiderfy";

/** @deprecated Use MapPointerStart for mouse, touch, and pen gestures. */
export type MapTouchStart = MapPointerStart;

export function mapTapAction(
  pointerType: string,
  target: MapTapTarget,
): MapTapAction {
  if (target === "cluster") return "expand-cluster";
  if (target === "item") {
    return pointerType === "touch" ? "open-detail" : "show-preview";
  }
  return "none";
}

export function clusterTapAction({
  currentZoom,
  maxZoom,
  hasGeographicSpread,
}: {
  currentZoom: number;
  maxZoom: number;
  hasGeographicSpread: boolean;
}): ClusterTapAction {
  if (currentZoom >= maxZoom || !hasGeographicSpread) {
    return "spiderfy";
  }

  return "zoom-to-bounds";
}

export function beginMapPointer(sample: MapPointerSample): MapPointerStart | null {
  if (!sample.pointerType || !["mouse", "touch", "pen"].includes(sample.pointerType)) {
    return null;
  }

  return {
    pointerId: sample.pointerId,
    pointerType: sample.pointerType,
    clientX: sample.clientX,
    clientY: sample.clientY,
    timeStamp: sample.timeStamp,
  };
}

export function beginMapTouch(sample: MapPointerSample): MapTouchStart | null {
  if (sample.pointerType !== "touch") return null;

  return {
    pointerId: sample.pointerId,
    pointerType: sample.pointerType,
    clientX: sample.clientX,
    clientY: sample.clientY,
    timeStamp: sample.timeStamp,
  };
}

export function isCompletedMapTap(
  start: MapTouchStart | null,
  end: MapPointerSample,
): boolean {
  if (
    !start ||
    end.pointerType !== start.pointerType ||
    end.pointerId !== start.pointerId
  ) {
    return false;
  }

  const duration = end.timeStamp - start.timeStamp;
  const distance = Math.hypot(
    end.clientX - start.clientX,
    end.clientY - start.clientY,
  );

  return (
    duration >= 0 &&
    duration <= MAX_TAP_DURATION_MS &&
    distance <= MAX_TAP_DISTANCE
  );
}
