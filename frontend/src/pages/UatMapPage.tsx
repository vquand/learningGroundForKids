import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiText } from '../i18n/uiText';
import { useState } from "react";
import { KidBackButton } from '../components/KidBackButton';
import { AppShell } from "../components/Layout/AppShell";
import { CategorySidebar } from "../components/Map/CategorySidebar";
import { TimelineScrubber } from "../components/Map/TimelineScrubber";
import { WorldMap } from "../components/Map/WorldMap";
import { JourneyReplayOverlay } from "../components/Journey/JourneyReplayOverlay";
import {
  LOCAL_UAT_ITEMS,
  LOCAL_UAT_JOURNEY_SOURCE,
  LOCAL_UAT_PROGRESS,
} from "../uat/localUatData";

const UAT_PROFILE = {
  id: "local-uat-profile",
  emoji: "🧭",
  color: "#2563eb",
  name: "UAT Explorer",
};

export function UatMapPage() {
  useUiLanguage();
  const [showJourney, setShowJourney] = useState(false);

  return (
    <AppShell>
      <div className="relative h-full w-full">
        <CategorySidebar />
        <header className="kid-nav explore-header absolute left-0 top-0 z-[1000] flex bg-white/90">
          <KidBackButton />
          <TimelineScrubber items={LOCAL_UAT_ITEMS} />
        </header>
        <WorldMap
          itemsOverride={LOCAL_UAT_ITEMS}
          progressOverride={LOCAL_UAT_PROGRESS}
        />

        <div className="pointer-events-none absolute right-3 top-[84px] z-[1000] flex max-w-[calc(100%-96px)] flex-wrap items-center justify-end gap-2 sm:right-5 sm:top-[88px]">
          <span className="rounded-full border border-blue-200 bg-white/95 px-3 py-2 text-xs font-bold text-blue-800 shadow-md sm:text-sm">
            {uiText("Local UAT · no sign-in")}</span>
          <button
            type="button"
            onClick={() => setShowJourney(true)}
            className="pointer-events-auto min-h-11 rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            {uiText("🗺️ Watch demo journey")}</button>
          <a
            href="/"
            className="pointer-events-auto min-h-11 rounded-full border border-gray-200 bg-white/95 px-4 py-2 text-sm font-bold text-gray-700 shadow-md transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            {uiText("Exit UAT")}</a>
        </div>

        {showJourney && (
          <JourneyReplayOverlay
            profileId={UAT_PROFILE.id}
            profileEmoji={UAT_PROFILE.emoji}
            profileColor={UAT_PROFILE.color}
            profileName={UAT_PROFILE.name}
            source={LOCAL_UAT_JOURNEY_SOURCE}
            onClose={() => setShowJourney(false)}
          />
        )}
      </div>
    </AppShell>
  );
}
