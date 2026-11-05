import { createHash } from "node:crypto";
import type { BadgeRecord, CompletionRecord } from "./contracts/db.js";

export interface BadgeAttempt {
  item_id: string | null;
  score: number;
  total: number;
  completed_at: string | Date;
}

const CATEGORY_MILESTONES = [5, 10, 15] as const;
const GLOBAL_MILESTONES = [5, 15, 30] as const;
const QUIZ_MILESTONES = [1, 5, 50] as const;

// Count the same milestones using database aggregates, without fetching attempts.
export function countDerivedBadges(categoryCounts: number[], itemPasses: number, dailyPasses: number): number {
  const total = categoryCounts.reduce((sum, count) => sum + count, 0);
  return GLOBAL_MILESTONES.filter((threshold) => total >= threshold).length
    + categoryCounts.reduce((sum, count) => sum + CATEGORY_MILESTONES.filter((threshold) => count >= threshold).length, 0)
    + QUIZ_MILESTONES.filter((threshold) => itemPasses >= threshold).length
    + (dailyPasses >= 5 ? 1 : 0);
}

function badgeId(profileId: string, key: string): string {
  return createHash("sha256").update(`${profileId}\0${key}`).digest("hex").slice(0, 32);
}

export function deriveBadges(
  profileId: string,
  completions: CompletionRecord[],
  attempts: BadgeAttempt[],
): BadgeRecord[] {
  const badges: BadgeRecord[] = [];
  const ordered = [...completions].sort((a, b) => +new Date(a.done_at) - +new Date(b.done_at));
  const categories = new Map<string, number>();
  let globalCount = 0;

  function add(key: string, type: string, milestone: number, earnedAt: string | Date) {
    badges.push({ id: badgeId(profileId, key), badge_key: key, badge_type: type, milestone, earned_at: earnedAt });
  }

  for (const completion of ordered) {
    globalCount += 1;
    if (GLOBAL_MILESTONES.some((milestone) => milestone === globalCount)) {
      add(`global_${globalCount}`, "global", globalCount, completion.done_at);
    }
    const categoryCount = (categories.get(completion.category) ?? 0) + 1;
    categories.set(completion.category, categoryCount);
    if (CATEGORY_MILESTONES.some((milestone) => milestone === categoryCount)) {
      add(`${completion.category}_${categoryCount}`, "category", categoryCount, completion.done_at);
    }
  }

  let itemPasses = 0;
  let dailyPasses = 0;
  for (const attempt of [...attempts].sort((a, b) => +new Date(a.completed_at) - +new Date(b.completed_at))) {
    if (attempt.total <= 0) continue;
    if (attempt.item_id !== null) {
      if (attempt.score / attempt.total < 0.8) continue;
      itemPasses += 1;
      if (QUIZ_MILESTONES.some((milestone) => milestone === itemPasses)) {
        const key = itemPasses === 1 ? "quiz_first" : itemPasses === 5 ? "quiz_explorer" : "quiz_master";
        add(key, "wisdom", itemPasses, attempt.completed_at);
      }
    } else if (attempt.score / attempt.total >= 0.7) {
      dailyPasses += 1;
      if (dailyPasses === 5) add("quiz_daily_scholar", "wisdom", 5, attempt.completed_at);
    }
  }
  return badges.sort((a, b) => +new Date(a.earned_at) - +new Date(b.earned_at));
}
