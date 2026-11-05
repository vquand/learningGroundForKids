import { useUiLanguage } from '../hooks/useUiLanguage';
import { KidBackButton } from '../components/KidBackButton';
import { uiText } from '../i18n/uiText';
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { fetchAchievements } from "../api/profiles";
import { fetchItems } from "../api/items";
import type { AchievementItem } from "../types/profile";
import { familyQueryKey, familyScopedQuery } from "../lib/familyQueries";
import { SeasonalScreen } from "../components/SeasonalScreen";
import { useFamilyStore } from "../stores/familyStore";

const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍜",
  monument: "🏛️",
  landmark: "🗺️",
  music: "🎵",
  movie: "🎬",
  phenomenon: "🌪️",
};

const CATEGORY_LABEL: Record<string, string> = {
  food: "Food",
  monument: "Monuments",
  landmark: "Landmarks",
  music: "Music",
  movie: "Movies",
  phenomenon: "Natural Phenomena",
};

const CONTINENT_EMOJI: Record<string, string> = {
  "Asia": "🌏",
  "Europe": "🌍",
  "North America": "🌎",
  "South America": "🌎",
  "Africa": "🌍",
  "Oceania": "🌏",
  "Unknown": "🌐",
};

type GroupBy = "category" | "continent" | "country";

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function AchievementCard({ item }: { item: AchievementItem }) {
  useUiLanguage();
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-2xl bg-white shadow-md border border-gray-100">
      <span className="text-2xl">{CATEGORY_EMOJI[item.category] ?? "⭐"}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 truncate">{item.title}</p>
        <p className="text-xs text-gray-500">{item.country_name}</p>
      </div>
      <span className="text-green-500 text-lg">✓</span>
    </div>
  );
}

function GroupSection({
  title,
  emoji,
  items,
}: {
  title: string;
  emoji: string;
  items: AchievementItem[];
}) {
  useUiLanguage();
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 py-2 px-3 rounded-2xl bg-blue-50 font-bold text-blue-800 text-left"
      >
        <span className="text-xl">{emoji}</span>
        <span className="flex-1">{uiText(title)}</span>
        <span className="text-sm font-normal text-blue-500">{items.length}</span>
        <span className="text-blue-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2 pl-2">
          {items.map((item) => (
            <AchievementCard key={item.item_id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AchievementsPage() {
  useUiLanguage();
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const familyId = useFamilyStore((state) => state.familyId);
  const [groupBy_, setGroupBy] = useState<GroupBy>("category");

  const { data: items = [] } = useQuery({
    queryKey: ["items", familyId, profileId],
    queryFn: familyScopedQuery(familyId, () => fetchItems(profileId)),
    enabled: Boolean(familyId && profileId),
  });

  const { data: achievements = [], isLoading } = useQuery({
    queryKey: familyQueryKey("achievements", familyId, profileId),
    queryFn: familyScopedQuery(familyId, () => fetchAchievements(profileId!, items)),
    enabled: Boolean(familyId && profileId) && items.length > 0,
  });

  const grouped =
    groupBy_ === "category"
      ? groupBy(achievements, (a) => a.category)
      : groupBy_ === "continent"
      ? groupBy(achievements, (a) => a.continent)
      : groupBy(achievements, (a) => a.country_name);

  const sortedKeys = Object.keys(grouped).sort((a, b) =>
    (grouped[b]?.length ?? 0) - (grouped[a]?.length ?? 0)
  );

  function getEmoji(key: string): string {
    if (groupBy_ === "category") return CATEGORY_EMOJI[key] ?? "⭐";
    if (groupBy_ === "continent") return CONTINENT_EMOJI[key] ?? "🌐";
    return "🏳️";
  }

  function getLabel(key: string): string {
    if (groupBy_ === "category") return CATEGORY_LABEL[key] ?? key;
    return key;
  }

  return (
    <SeasonalScreen className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 bg-white/90 backdrop-blur-sm border-b border-gray-100 z-10">
        <div className="kid-nav flex items-center">
          <KidBackButton label="Back" onClick={() => navigate(-1)}/>
          <h1 className="text-xl font-bold text-gray-800 flex-1">{uiText("My Adventures")}</h1>
          <span className="text-sm font-semibold text-blue-600 bg-blue-100 rounded-full px-3 py-1">
            {achievements.length} {uiText("explored")}</span>
        </div>

        {/* Group-by tabs */}
        <div className="flex border-t border-gray-100">
          {(["category", "continent", "country"] as GroupBy[]).map((tab) => (
            <button
              key={uiText(tab)}
              onClick={() => setGroupBy(tab)}
              className={`flex-1 py-2 text-sm font-semibold capitalize transition-colors min-h-[64px] flex items-center justify-center ${
                groupBy_ === tab
                  ? "text-blue-600 border-b-2 border-blue-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {uiText(tab)}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {isLoading ? (
          <p className="text-center text-gray-400 py-12">{uiText("Loading adventures...")}</p>
        ) : achievements.length === 0 ? (
          <div className="rounded-3xl border border-sky-100 bg-white px-5 py-8 text-center shadow-sm sm:py-10">
            <img
              src="/illustrations/capybara-first-adventure-dong-ho.webp"
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="mx-auto mb-3 h-44 w-44 object-contain"
            />
            <h2 className="text-xl font-extrabold text-slate-800">{uiText("Your first adventure is waiting!")}</h2>
            <p className="mt-2 text-gray-500">{uiText("Choose a place on the map and collect your first star.")}</p>
            <button
              type="button"
              onClick={() => navigate("/map")}
              className="mt-5 min-h-12 rounded-full bg-sky-600 px-6 py-3 font-bold text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2"
            >
              {uiText("Explore the map")}</button>
          </div>
        ) : (
          sortedKeys.map((key) => (
            <GroupSection
              key={key}
              title={getLabel(key)}
              emoji={getEmoji(key)}
              items={grouped[key] ?? []}
            />
          ))
        )}
      </div>
    </SeasonalScreen>
  );
}
