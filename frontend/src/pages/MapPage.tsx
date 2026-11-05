import { useUiLanguage } from '../hooks/useUiLanguage';
import { KidBackButton } from '../components/KidBackButton';
import { uiText } from '../i18n/uiText';
import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { useQuery } from "@tanstack/react-query";
import { logout } from "../api/auth";
import { fetchProfiles } from "../api/profiles";
import { AppShell } from "../components/Layout/AppShell";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { CategorySidebar } from "../components/Map/CategorySidebar";
import { TimelineScrubber } from "../components/Map/TimelineScrubber";
import { timelineKey } from '../hooks/preparedMapLifecycle';
import { useFilterStore } from '../stores/filterStore';
import { ProgressFilter, useMapProgress } from '../components/Map/ProgressFilter';
import { WorldMap } from "../components/Map/WorldMap";
import type { ExploreTimelineYear } from '../types/explore';
import { useFamilyStore } from "../stores/familyStore";
import { useProfileStore } from "../stores/profileStore";
import { familyScopedQuery, profileQueryKey } from "../lib/familyQueries";
import { LearntItemsCount } from '../components/LearntItemsCount';

const JourneyReplayOverlay = lazy(() => import("../components/Journey/JourneyReplayOverlay")
  .then((module) => ({ default: module.JourneyReplayOverlay })));

function MapControls() {
  useUiLanguage();
  const navigate = useNavigate();
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const familyId = useFamilyStore((s) => s.familyId);
  const clearProfile = useProfileStore((s) => s.clearProfile);
  const clearSession = useFamilyStore((s) => s.clearSession);
  const [showJourney, setShowJourney] = useState(false);

  const { data: profiles = [], isError } = useQuery({
    queryKey: profileQueryKey(familyId),
    queryFn: familyScopedQuery(familyId, fetchProfiles),
    enabled: Boolean(familyId),
    retry: false,
  });

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  function handleBackToPlayground() {
    navigate("/playground");
  }

  function handleRelogin() {
    void (async () => {
      try {
        await logout();
      } catch {
        // The session check on the destination determines whether login is needed.
      }
      clearSession();
      clearProfile();
      window.location.assign("/");
    })();
  }

  // The session is invalid — show a single re-login button instead of silently failing.
  if (isError) {
    return (
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000]">
        <button
          onClick={handleRelogin}
          className="flex items-center gap-2 px-4 py-2 min-h-[64px] rounded-full bg-red-50 shadow-lg border border-red-200 font-semibold text-red-600 text-sm hover:bg-red-100 active:scale-95 transition-all"
        >
          <span className="text-xl leading-none">🔑</span>
          <span>{uiText("Session expired — tap to re-login")}</span>
        </button>
      </div>
    );
  }

  return (
    <>
      {activeProfile && <div className="absolute right-3 top-[84px] z-[1000] sm:right-5 sm:top-[88px]"><LearntItemsCount count={activeProfile.total_done} /></div>}
      <div className="explore-actions">
        {/* Return to this child's minigame list */}
        <button
          onClick={handleBackToPlayground}
          className="flex items-center gap-2 px-4 py-2 min-h-[64px] rounded-full bg-white shadow-lg border border-gray-200 font-semibold text-gray-700 text-sm hover:bg-gray-50 active:scale-95 transition-all"
        >
          <ProfileAvatar
            profile={activeProfile ?? { emoji: "👤", color: "#3B82F6" }}
            size="lg" className="explore-profile-avatar"
          />
          <span>{activeProfile?.name ?? uiText("Switch")}</span>
        </button>

        {/* My achievements */}
        {activeProfileId && (
          <button
            onClick={() => navigate(`/profile/${activeProfileId}/achievements`)}
            className="flex items-center gap-2 px-4 py-2 min-h-[64px] rounded-full bg-amber-400 shadow-lg font-semibold text-white text-sm hover:bg-amber-500 active:scale-95 transition-all"
          >
            <span className="text-lg leading-none">⭐</span>
            <span>{uiText("My Adventures")}</span>
          </button>
        )}

        {/* Watch My Journey */}
        {activeProfileId && (
          <button
            onClick={() => setShowJourney(true)}
            className="flex items-center gap-2 px-4 py-2 min-h-[64px] rounded-full bg-blue-500 shadow-lg font-semibold text-white text-sm hover:bg-blue-600 active:scale-95 transition-all"
          >
            <span className="text-lg leading-none">{"\u{1F5FA}\uFE0F"}</span>
            <span>{uiText("Watch My Journey")}</span>
          </button>
        )}
      </div>
      {showJourney && activeProfile && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[2100] flex flex-col items-center justify-center gap-4 bg-gray-950/80 text-white">
            <p role="status">{uiText("Loading your journey…")}</p>
            <button type="button" onClick={() => setShowJourney(false)} className="min-h-11 rounded-full border border-white px-6 py-2">{uiText("Cancel")}</button>
          </div>
        }>
          <JourneyReplayOverlay
          profileId={activeProfile.id}
          profileEmoji={activeProfile.emoji}
          profileColor={activeProfile.color}
          profileName={activeProfile.name}
          onClose={() => setShowJourney(false)}
          />
        </Suspense>
      )}
    </>
  );
}

function ScopedMapPage() {
  useUiLanguage();
  const [timeline, setTimeline] = useState<ExploreTimelineYear[]>([]);
  const timelineVersion = useRef('');
  const { progress } = useMapProgress();
  const categories = useFilterStore(s => s.activeCategories);
  const updateTimeline = useCallback((years: ExploreTimelineYear[], version?: string) => {
    const key = timelineKey(years, version, progress, categories);
    if (version && timelineVersion.current === key) return;
    timelineVersion.current = key;
    setTimeline(previous => previous.length === years.length && previous.every((entry, index) => entry.year === years[index]?.year && entry.count === years[index]?.count) ? previous : years);
  }, [progress, categories]);

  return (
    <AppShell>
      <div className="explore-page relative h-full w-full">
        <CategorySidebar />
        <header className="kid-nav explore-header absolute left-0 top-0 z-[1000] flex bg-white/90">
          <KidBackButton />
          <TimelineScrubber years={timeline} />
        </header>
        <WorldMap onTimeline={updateTimeline} />
        <MapControls />
        <ProgressFilter />
      </div>
    </AppShell>
  );
}

export function MapPage() {
  const family = useFamilyStore(s => s.familyId), generation = useFamilyStore(s => s.sessionGeneration);
  const profile = useProfileStore(s => s.activeProfileId);
  return <ScopedMapPage key={`${family}:${generation}:${profile}`}/>;
}
