import type { Pool } from "pg";
import type { AdminActivityRecord, AdminJourneyQuery, AdminJourneyPage, AdminProfileDetailRecord, AdminReadRepository } from "../contracts/db.js";
import { countDerivedBadges } from "../badges.js";

export function journeyWindow(period: AdminJourneyQuery["period"], now = new Date()) {
  if (period === "all") return { since: null, until: now };
  const since = new Date(now);
  since.setUTCHours(0, 0, 0, 0);
  const until = period === "yesterday" ? new Date(since) : now;
  const days = period === "yesterday" ? 1 : period === "last3days" ? 2 : period === "last7days" ? 6 : 0;
  since.setUTCDate(since.getUTCDate() - days);
  return { since, until };
}

// Both IDs participate in every query; admin inspection never relaxes the
// family-owned API's authorization or impersonates a child profile.
const scopedProfile = `SELECT id FROM profiles WHERE id = $2 AND family_id = $1`;
const activityEvents = `WITH scoped AS (${scopedProfile}), events AS (
  SELECT 'completion:' || p.id AS id, 'completion' AS type, p.done_at AS occurred_at,
    p.item_id, NULL::int AS score, NULL::int AS total,
    NULL::text AS theme_type, NULL::text AS theme_value,
    NULL::int AS cards_shown, NULL::int AS got_it_count, NULL::int AS review_again_count
  FROM profile_progress p JOIN scoped s ON s.id = p.profile_id
  UNION ALL
  SELECT 'quiz:' || q.id, 'quiz', q.completed_at, q.item_id, q.score, q.total,
    NULL::text, NULL::text, NULL::int, NULL::int, NULL::int
  FROM quiz_attempts q JOIN scoped s ON s.id = q.profile_id
  UNION ALL
  SELECT 'flashcard:' || f.id, 'flashcard', f.completed_at, f.focus_item_id, NULL::int, NULL::int,
    f.theme_type, f.theme_value, f.cards_shown, f.got_it_count, f.review_again_count
  FROM flashcard_study_sessions f JOIN scoped s ON s.id = f.profile_id
), filtered AS (SELECT * FROM events WHERE $3 = 'all' OR type = $3)`;
const preferredTitle = `LEFT JOIN LATERAL (
  SELECT title FROM item_translations t WHERE t.item_id = i.id
  ORDER BY (t.lang = 'en') DESC, t.lang, t.id LIMIT 1
) translation ON true`;
const journeyEvents = `WITH events AS (
  SELECT p.id, p.item_id, p.done_at, i.category, i.latitude, i.longitude,
    coalesce(translation.title, i.id) AS title
  FROM profile_progress p JOIN profiles child ON child.id = p.profile_id
  JOIN items i ON i.id = p.item_id ${preferredTitle}
  WHERE child.id = $2 AND child.family_id = $1
    AND ($3::timestamptz IS NULL OR p.done_at >= $3)
    AND p.done_at < $4
)`;

export function adminProfileReports(pool: Pool): Pick<AdminReadRepository, "profile" | "activities" | "journey"> {
  return {
    async profile(familyId, profileId) {
      const profile = await pool.query<AdminProfileDetailRecord>(`SELECT p.id, p.name, p.emoji, p.color, p.public_id,
        p.created_at, p.family_id, f.display_name AS family_name
        FROM profiles p JOIN families f ON f.id = p.family_id WHERE p.id = $2 AND p.family_id = $1`, [familyId, profileId]);
      const row = profile.rows[0];
      if (!row) return null;
      const [categories, quizzes, flashcards] = await Promise.all([
        pool.query<{ count: number }>(`SELECT category, count(*)::int AS count FROM profile_progress
          WHERE profile_id IN (${scopedProfile}) GROUP BY category`, [familyId, profileId]),
        pool.query<{ count: number; item_passes: number; daily_passes: number }>(`SELECT count(*)::int AS count,
          count(*) FILTER (WHERE item_id IS NOT NULL AND total > 0 AND score::numeric / nullif(total, 0) >= 0.8)::int AS item_passes,
          count(*) FILTER (WHERE item_id IS NULL AND total > 0 AND score::numeric / nullif(total, 0) >= 0.7)::int AS daily_passes
          FROM quiz_attempts WHERE profile_id IN (${scopedProfile})`, [familyId, profileId]),
        pool.query<{ count: number }>(`SELECT count(*)::int AS count FROM flashcard_study_sessions
          WHERE profile_id IN (${scopedProfile})`, [familyId, profileId]),
      ]);
      const counts = categories.rows.map((entry) => entry.count);
      return { ...row, total_done: counts.reduce((sum, count) => sum + count, 0),
        badge_count: countDerivedBadges(counts, quizzes.rows[0]!.item_passes, quizzes.rows[0]!.daily_passes),
        quiz_attempt_count: quizzes.rows[0]!.count, flashcard_session_count: flashcards.rows[0]!.count };
    },
    async activities(familyId, profileId, query) {
      const params = [familyId, profileId, query.type];
      const [count, page] = await Promise.all([
        pool.query<{ total: number }>(`${activityEvents} SELECT count(*)::int AS total FROM filtered`, params),
        pool.query<AdminActivityRecord>(`${activityEvents}
          SELECT e.*, translation.title AS item_title, i.category AS item_category FROM (
            SELECT * FROM filtered ORDER BY occurred_at DESC, id DESC LIMIT $4 OFFSET $5
          ) e LEFT JOIN items i ON i.id = e.item_id ${preferredTitle}
          ORDER BY e.occurred_at DESC, e.id DESC`, [...params, query.page_size, (query.page - 1) * query.page_size]),
      ]);
      const total = count.rows[0]!.total;
      return { activities: page.rows, page: query.page, page_size: query.page_size, total,
        total_pages: Math.max(1, Math.ceil(total / query.page_size)) };
    },
    async journey(familyId, profileId, query) {
      const { since, until } = journeyWindow(query.period);
      const params = [familyId, profileId, since, until];
      const [count, page] = await Promise.all([
        pool.query<{ total: number }>(`${journeyEvents} SELECT count(*)::int AS total FROM events`, params),
        pool.query<AdminJourneyPage["waypoints"][number]>(`${journeyEvents}
          SELECT 'item' AS kind, item_id, title, category, latitude, longitude, done_at
          FROM events ORDER BY done_at ASC, id ASC LIMIT $5 OFFSET $6`,
        [...params, query.page_size, (query.page - 1) * query.page_size]),
      ]);
      const first = page.rows[0];
      const total = count.rows[0]!.total;
      return { origin: first ? { latitude: first.latitude, longitude: first.longitude, title: first.title }
        : { latitude: 20, longitude: 0, title: "Start" }, waypoints: page.rows,
        exploredCount: page.rows.length, total, page: query.page, page_size: query.page_size,
        total_pages: Math.max(1, Math.ceil(total / query.page_size)) };
    },
  };
}
