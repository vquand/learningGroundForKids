import type { JourneyWaypoint } from "../../types/journey";

const CATEGORY_COLORS: Record<string, string> = {
  food: "#FF6B6B",
  monument: "#4ECDC4",
  landmark: "#45B7D1",
  music: "#96CEB4",
  movie: "#FFEAA7",
  phenomenon: "#FF9F43",
  animal: "#6C5CE7",
};

const CATEGORY_EMOJIS: Record<string, string> = {
  food: "🍜",
  monument: "🏛",
  landmark: "⛰",
  music: "🎵",
  movie: "🎬",
  phenomenon: "🌪️",
  animal: "🐾",
};

export interface JourneyWaypointPresentation {
  emoji: string;
  color: string;
  title: string;
  categoryLabel: string;
}

export function getJourneyWaypointPresentation(
  waypoint: Pick<JourneyWaypoint, "kind" | "title" | "category">,
): JourneyWaypointPresentation {
  if (waypoint.kind === "home") {
    return {
      emoji: "🏠",
      color: "#2563EB",
      title: waypoint.title,
      categoryLabel: "Home",
    };
  }

  return {
    emoji: CATEGORY_EMOJIS[waypoint.category] ?? "📍",
    color: CATEGORY_COLORS[waypoint.category] ?? "#64748B",
    title: waypoint.title,
    categoryLabel: waypoint.category,
  };
}

export function createJourneyWaypointPopupElement(
  waypoint: Pick<JourneyWaypoint, "kind" | "title" | "category">,
): HTMLDivElement {
  const presentation = getJourneyWaypointPresentation(waypoint);
  const root = document.createElement("div");
  root.className = "journey-waypoint-popup-content";

  const avatar = document.createElement("div");
  avatar.className = "journey-waypoint-popup-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.style.backgroundColor = presentation.color;
  avatar.textContent = presentation.emoji;

  const copy = document.createElement("div");
  copy.className = "journey-waypoint-popup-copy";

  const title = document.createElement("strong");
  title.className = "journey-waypoint-popup-title";
  title.textContent = presentation.title;

  const category = document.createElement("span");
  category.className = "journey-waypoint-popup-category";
  category.textContent = presentation.categoryLabel;

  copy.append(title, category);
  root.append(avatar, copy);
  return root;
}

export function createJourneyWaypointAvatarSvg(
  waypoint: Pick<JourneyWaypoint, "kind" | "title" | "category">,
): string {
  const presentation = getJourneyWaypointPresentation(waypoint);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="29" fill="${presentation.color}" stroke="#FFFFFF" stroke-width="4"/>
      <text x="32" y="42" text-anchor="middle" font-size="30">${presentation.emoji}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
