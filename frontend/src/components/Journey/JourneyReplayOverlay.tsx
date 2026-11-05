import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiMessage, uiText } from '../../i18n/uiText';
import { lazy, Suspense, useEffect, useState, Component, type ReactNode } from "react";
import { useJourneyReplay, type JourneyReplaySource } from "../../hooks/useJourneyReplay";
import type { JourneyPeriod } from "../../types/journey";
import { JourneyMap } from "./JourneyMap";

const JourneyGlobe = lazy(() =>
  import("./JourneyGlobe").then((module) => ({
    default: module.JourneyGlobe,
  })),
);

class GlobeErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/30">
          <p className="text-white text-lg">
            {uiText("Unable to load 3D globe. Please try again.")}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

interface JourneyReplayOverlayProps {
  profileId: string;
  profileEmoji: string;
  profileColor: string;
  profileName: string;
  onClose: () => void;
  source?: JourneyReplaySource;
}

const PERIOD_OPTIONS: { value: JourneyPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last3days", label: "3 Days" },
  { value: "last7days", label: "7 Days" },
];

type ReplayMode = "2d" | "3d";

export function JourneyReplayOverlay({
  profileId,
  profileEmoji,
  profileColor,
  profileName: _profileName,
  onClose,
  source,
}: JourneyReplayOverlayProps) {
  useUiLanguage();
  const [replayMode, setReplayMode] = useState<ReplayMode>("2d");
  const {
    origin,
    waypoints,
    exploredCount,
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
  } = useJourneyReplay(profileId, source);

  // The replay must be stopped before switching; the new view starts from the beginning.
  const switchMode = () => {
    if (isPlaying) return;
    resetReplay();
    setReplayMode((mode) => (mode === "2d" ? "3d" : "2d"));
  };

  useEffect(() => {
    loadJourney("last7days");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-[2000] flex flex-col journey-overlay-enter">
      {/* MAP AREA */}
      <div className="flex-1 relative min-h-0 bg-gray-900">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/30">
            <p className="text-white text-lg font-bold">
              {profileEmoji} {uiText("Getting ready for the adventure...")}</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/30 gap-4">
            <p className="text-white text-lg">
              {uiText("Oops! Could not load your journey. Tap to try again.")}</p>
            <button
              onClick={() => loadJourney(period)}
              className="px-6 py-3 bg-amber-400 rounded-full font-bold"
            >
              {uiText("Retry")}</button>
          </div>
        )}
        {!loading && !error && waypoints.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
            <p className="text-4xl mb-4">{profileEmoji}</p>
            <p className="text-white text-xl font-bold">{uiText("No adventures yet!")}</p>
            <p className="text-white/70 text-base mt-2">
              {uiText("Go explore the map and come back to watch your journey!")}</p>
          </div>
        )}
        {!loading && !error && waypoints.length >= 1 && origin && (
          replayMode === "2d" ? (
            <JourneyMap
              key={`${profileId}-${period}-${replayVersion}-2d`}
              origin={origin}
              waypoints={waypoints}
              profileEmoji={profileEmoji}
              profileColor={profileColor}
              isPlaying={isPlaying}
              speedMultiplier={speedMultiplier}
              onStateChange={handleStateChange}
              onWaypointArrive={handleWaypointArrive}
              onComplete={handleComplete}
            />
          ) : (
            <GlobeErrorBoundary>
              <Suspense
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/30">
                    <p className="text-white text-lg font-bold">
                      {profileEmoji} {uiText("Loading the 3D globe...")}</p>
                  </div>
                }
              >
                <JourneyGlobe
                  key={`${profileId}-${period}-${replayVersion}-3d`}
                  origin={origin}
                  waypoints={waypoints}
                  profileEmoji={profileEmoji}
                  profileColor={profileColor}
                  isPlaying={isPlaying}
                  speedMultiplier={speedMultiplier}
                  onStateChange={handleStateChange}
                  onWaypointArrive={handleWaypointArrive}
                  onComplete={handleComplete}
                />
              </Suspense>
            </GlobeErrorBoundary>
          )
        )}
        {/* The map/globe owns the anchored callout; keep an accessible announcement here. */}
        {arrivedWaypoint && (
          <div className="sr-only" role="status" aria-live="polite">
            {uiText("Arrived at")}{arrivedWaypoint.waypoint.title}
          </div>
        )}
        {/* Completion overlay */}
        {showComplete && (
          <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/40">
            <div className="bg-white rounded-2xl p-8 text-center shadow-2xl journey-complete-enter max-w-[320px]">
              <p className="text-4xl mb-3">{profileEmoji}</p>
              <p className="text-2xl font-bold">{uiText("What an adventure!")}</p>
              <p className="text-gray-500 mt-2">
                {exploredCount} {uiText("places explored!")}</p>
              <div className="flex gap-3 mt-6 justify-center">
                <button
                  onClick={resetReplay}
                  className="px-5 py-3 bg-amber-400 rounded-full font-bold text-sm"
                >
                  {uiText("Replay")}</button>
                <button
                  onClick={onClose}
                  className="px-5 py-3 bg-gray-200 rounded-full font-bold text-sm"
                >
                  {uiText("Close")}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FLOATING TOOLBAR: period pills above, then 2D/3D | play | speed | close */}
      <div
        className="pointer-events-none absolute inset-x-0 z-[1500] flex flex-col items-center gap-2 px-3"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        <div className="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-full bg-black/60 p-1 backdrop-blur-sm no-scrollbar">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                resetReplay();
                loadJourney(opt.value);
              }}
              className={`h-11 min-w-[60px] shrink-0 rounded-full px-3 text-sm font-bold transition-colors ${
                period === opt.value
                  ? "bg-amber-400 text-gray-900"
                  : "bg-white/20 text-white"
              }`}
              aria-label={uiMessage("Show {period}", { period: uiText(opt.label) })}
            >
              {uiText(opt.label)}
            </button>
          ))}
        </div>
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/60 p-2 shadow-lg backdrop-blur-sm">
          <button
            onClick={switchMode}
            disabled={isPlaying}
            className={`h-11 min-w-[56px] rounded-full bg-white px-4 text-sm font-bold text-gray-900 ${
              isPlaying ? "cursor-not-allowed opacity-50" : ""
            }`}
            aria-label={replayMode === "2d" ? uiText("Show 3D replay globe") : uiText("Show 2D replay map")}
            title={isPlaying ? uiText("Pause the journey to switch views") : undefined}
          >
            {replayMode === "2d" ? "2D" : "3D"}
          </button>
          <button
            onClick={togglePlay}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl text-white ${
              isPlaying ? "bg-amber-400" : "bg-white/30"
            }`}
            aria-label={isPlaying ? uiText("Pause journey") : uiText("Play journey")}
          >
            {isPlaying ? "\u23F8" : "\u25B6"}
          </button>
          <button
            onClick={toggleSpeed}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white"
            aria-label={`Playback speed: ${speedMultiplier}x`}
          >
            {speedMultiplier}x
          </button>
          <button
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg text-white"
            aria-label={uiText("Close journey replay")}
          >
            &#x2715;
          </button>
        </div>
      </div>

      {/* PROGRESS BAR */}
      {animationState.totalSegments > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-[1501] h-1 bg-white/20">
          <div
            className="h-full bg-amber-400 transition-all duration-100"
            style={{
              width: `${((animationState.currentSegment + animationState.segmentProgress) / animationState.totalSegments) * 100}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}
