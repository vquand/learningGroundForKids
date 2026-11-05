import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJourney } from "../api/profiles";
import { fetchItems } from "../api/items";
import type {
  JourneyRoute,
  JourneyWaypoint,
  JourneyPeriod,
  AnimationState,
  JourneySpeed,
} from "../types/journey";
import { JOURNEY_SPEEDS } from "../types/journey";
import {
  familyScopedQuery,
  InactiveFamilySessionError,
} from "../lib/familyQueries";
import { useFamilyStore } from "../stores/familyStore";
import type { ItemSummary } from "../types/item";
import { createJourneyReplayRequestController } from "./journeyReplayRequests";
import { createJourneyStateThrottle } from "./journeyReplayState";

const IDLE_STATE: AnimationState = {
  status: "idle",
  currentSegment: 0,
  segmentProgress: 0,
  totalSegments: 0,
};

export const JOURNEY_STATE_UPDATE_INTERVAL_MS = 120;

export { createLatestRequestGuard } from "./latestRequestGuard";

export interface JourneyReplaySource {
  items: readonly ItemSummary[];
  loadJourney: (period: JourneyPeriod) => Promise<JourneyRoute>;
}

export function useJourneyReplay(profileId: string | null, source?: JourneyReplaySource) {
  const familyId = useFamilyStore((state) => state.familyId);
  const sessionGeneration = useFamilyStore((state) => state.sessionGeneration);
  const [route, setRoute] = useState<JourneyRoute | null>(null);
  const [period, setPeriod] = useState<JourneyPeriod>("last7days");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animationState, setAnimationState] =
    useState<AnimationState>(IDLE_STATE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<JourneySpeed>(1);
  const [arrivedWaypoint, setArrivedWaypoint] = useState<{
    index: number;
    waypoint: JourneyWaypoint;
  } | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [replayVersion, setReplayVersion] = useState(0);

  const arrivedTimeoutRef = useRef<number | null>(null);
  const pendingPeriodRef = useRef<JourneyPeriod | null>(null);
  const requestGuardRef = useRef(createJourneyReplayRequestController());
  const statePublishedAtRef = useRef(0);
  const pendingAnimationStateRef = useRef<AnimationState | null>(null);
  const stateUpdateTimeoutRef = useRef<number | null>(null);
  const stateThrottleRef = useRef<ReturnType<typeof createJourneyStateThrottle> | null>(null);
  if (stateThrottleRef.current === null) {
    stateThrottleRef.current = createJourneyStateThrottle(
      { statePublishedAtRef, pendingAnimationStateRef, stateUpdateTimeoutRef },
      (state) => setAnimationState(state),
      JOURNEY_STATE_UPDATE_INTERVAL_MS,
      Date.now,
      (callback, delay) => window.setTimeout(callback, delay),
      (timeoutId) => window.clearTimeout(timeoutId),
    );
  }

  const clearStateUpdateThrottle = useCallback(() => {
    stateThrottleRef.current?.reset();
  }, []);

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: source ? ["items", "local-uat-journey"] : ["items", familyId, profileId],
    queryFn: source
      ? () => Promise.resolve([...source.items])
      : familyScopedQuery(familyId, () => fetchItems(profileId)),
    enabled: Boolean(profileId && (source || familyId)),
  });

  const loadJourney = useCallback(
    async (newPeriod: JourneyPeriod) => {
      if (!profileId || (!familyId && !source)) return;
      const requestGeneration = requestGuardRef.current.begin();
      if (requestGeneration === null) return;
      const isCurrentRequest = () => requestGuardRef.current.isCurrent(requestGeneration);
      if (itemsLoading) {
        pendingPeriodRef.current = newPeriod;
        setLoading(true);
        setError(null);
        clearStateUpdateThrottle();
        setAnimationState(IDLE_STATE);
        setRoute(null);
        setPeriod(newPeriod);
        return;
      }

      setLoading(true);
      setError(null);
      clearStateUpdateThrottle();
      setAnimationState(IDLE_STATE);
      pendingPeriodRef.current = null;
      try {
        const data = source
          ? await source.loadJourney(newPeriod)
          : await familyScopedQuery(familyId, () => fetchJourney(profileId, newPeriod, items))();
        if (!isCurrentRequest()) return;
        setRoute(data);
        setPeriod(newPeriod);
      } catch (err) {
        if (err instanceof InactiveFamilySessionError || !isCurrentRequest()) return;
        setError(
          err instanceof Error ? err.message : "Failed to load journey",
        );
      } finally {
        if (isCurrentRequest()) setLoading(false);
      }
    },
    [clearStateUpdateThrottle, familyId, items, itemsLoading, profileId, source],
  );

  useEffect(() => {
    requestGuardRef.current.invalidate();
    pendingPeriodRef.current = null;
    clearStateUpdateThrottle();
    setRoute(null);
    setError(null);
    setLoading(false);
    setIsPlaying(false);
  }, [clearStateUpdateThrottle, profileId, sessionGeneration]);

  useEffect(() => {
    if (!pendingPeriodRef.current || itemsLoading) return;
    const pendingPeriod = pendingPeriodRef.current;
    pendingPeriodRef.current = null;
    void loadJourney(pendingPeriod);
  }, [itemsLoading, loadJourney]);

  const clearReplayUiState = useCallback(() => {
    if (arrivedTimeoutRef.current !== null) {
      window.clearTimeout(arrivedTimeoutRef.current);
      arrivedTimeoutRef.current = null;
    }
    clearStateUpdateThrottle();
    setShowComplete(false);
    setAnimationState(IDLE_STATE);
    setArrivedWaypoint(null);
  }, [clearStateUpdateThrottle]);

  const togglePlay = useCallback(() => {
    const status = animationState.status;
    if (status === "complete") {
      clearReplayUiState();
      setReplayVersion((prev) => prev + 1);
      setIsPlaying(true);
    } else if (status === "idle") {
      setIsPlaying(true);
    } else if (status === "playing") {
      setIsPlaying(false);
    } else if (status === "paused") {
      setIsPlaying(true);
    }
  }, [animationState.status, clearReplayUiState]);

  const toggleSpeed = useCallback(() => {
    setSpeedMultiplier((prev) => JOURNEY_SPEEDS[(JOURNEY_SPEEDS.indexOf(prev) + 1) % JOURNEY_SPEEDS.length] ?? 1);
  }, []);

  const handleStateChange = useCallback((state: AnimationState) => {
    stateThrottleRef.current?.handle(state);
    if (state.status === "paused") {
      setIsPlaying(false);
    }
  }, []);

  const handleWaypointArrive = useCallback(
    (index: number, waypoint: JourneyWaypoint) => {
      setArrivedWaypoint({ index, waypoint });
      if (arrivedTimeoutRef.current !== null) {
        window.clearTimeout(arrivedTimeoutRef.current);
      }
      arrivedTimeoutRef.current = window.setTimeout(() => {
        setArrivedWaypoint(null);
        arrivedTimeoutRef.current = null;
      }, 2000);
    },
    [],
  );

  const handleComplete = useCallback(() => {
    setShowComplete(true);
    setIsPlaying(false);
  }, []);

  const resetReplay = useCallback(() => {
    clearReplayUiState();
    setIsPlaying(false);
    setReplayVersion((prev) => prev + 1);
  }, [clearReplayUiState]);

  useEffect(() => {
    // StrictMode reruns this effect after its cleanup; re-arm the controller.
    requestGuardRef.current.mount();
    return () => {
      if (arrivedTimeoutRef.current !== null) {
        window.clearTimeout(arrivedTimeoutRef.current);
      }
      if (stateUpdateTimeoutRef.current !== null) {
        window.clearTimeout(stateUpdateTimeoutRef.current);
      }
      clearStateUpdateThrottle();
      stateThrottleRef.current?.dispose();
      requestGuardRef.current.unmount();
    };
  }, [clearStateUpdateThrottle]);

  return {
    route,
    waypoints: route?.waypoints ?? [],
    origin: route?.origin ?? null,
    exploredCount: route?.exploredCount ?? 0,
    period,
    loading,
    error,
    animationState,
    isPlaying,
    speedMultiplier,
    arrivedWaypoint,
    showComplete,
    replayVersion,
    loadJourney,
    togglePlay,
    toggleSpeed,
    handleStateChange,
    handleWaypointArrive,
    handleComplete,
    resetReplay,
  };
}
