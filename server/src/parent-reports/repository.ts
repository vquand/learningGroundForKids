import type { Pool } from 'pg';
import type { ParentReportRepository } from './contracts.js';
import { summarizeChild, summarizeFamily, type ReportRow } from './summary.js';

export function createParentReportRepository(pool: Pool): ParentReportRepository {
  return {
    async read(familyId) {
      // One read-only snapshot. Every lateral aggregate is anchored to an owned profile.
      // Private questions/solutions are not even selected into the reporting process.
      const result = await pool.query<ReportRow>(`
        WITH owned AS (
          SELECT id,name,emoji,color,avatar_type,avatar_url,avatar_frame,public_id,created_at
          FROM profiles WHERE family_id=$1 ORDER BY created_at,id LIMIT 100
        )
        SELECT p.id,p.name,p.emoji,p.color,p.avatar_type,p.avatar_url,p.avatar_frame,p.public_id,
          CASE WHEN rr.profile_id IS NOT NULL THEN jsonb_build_object('stats',rr.state->'stats','earned',rr.state->'earned') END AS road_racing,
          CASE WHEN dq.profile_id IS NOT NULL THEN jsonb_build_object('stats',dq.state->'stats','categories',dq.state->'categories','earned',dq.state->'earned') END AS daily_quiz,
          cr.state->'achievements' AS cabbage_rolls,
          completed.total AS exploring_completed,
          ARRAY(SELECT COUNT(*)::int FROM profile_progress WHERE profile_id=p.id GROUP BY category) AS category_counts,
          quiz.attempts AS quiz_attempts,quiz.passes AS quiz_passes,quiz.item_passes,quiz.daily_passes,
          study.sessions AS study_sessions,study.cards AS cards_reviewed,
          drinks.total AS drink_completions,
          COALESCE(recent.items,'[]'::jsonb) AS latest_items,
          CASE WHEN u.profile_id IS NOT NULL THEN jsonb_build_object('stats',u.state->'stats') END AS ufo,
          CASE WHEN w.profile_id IS NOT NULL THEN jsonb_build_object('stats',w.state->'stats','best',w.state->'best') END AS math_wall,
          CASE WHEN d.profile_id IS NOT NULL THEN jsonb_build_object('earned',d.state->'earned','game',
            CASE WHEN d.state->'game' <> 'null'::jsonb THEN jsonb_build_object(
              'depthMetres',d.state->'game'->'depthMetres','mainQuestionsCompleted',d.state->'game'->'mainQuestionsCompleted',
              'ownedUpgradeIds',d.state->'game'->'ownedUpgradeIds') END) END AS infinidrill,
          CASE WHEN m.profile_id IS NOT NULL THEN jsonb_build_object('completed',m.state->'completed',
            'completedBySize',m.state->'completedBySize','earned',m.state->'earned') END AS miniku,
          CASE WHEN f.profile_id IS NOT NULL THEN jsonb_build_object('stats',f.state->'stats',
            'points',f.state->'points','discovered',f.state->'discovered','earnedBaits',f.state->'earnedBaits',
            'friendCatches',f.state->'friendCatches','earned',f.state->'earned') END AS fishing,
          CASE WHEN t.profile_id IS NOT NULL THEN jsonb_build_object('entities',t.state->'entities',
            'materials',t.state->'materials','storage',jsonb_build_object('wool',t.state#>'{storage,wool}'),'earned',t.state->'earned','eventHistory',jsonb_build_object('halloween-pumpkins',t.state#>'{eventHistory,halloween-pumpkins}','womens-day',t.state#>'{eventHistory,womens-day}','xmas',t.state#>'{eventHistory,xmas}'),
            'maps',jsonb_build_object('lake',CASE WHEN t.state#>'{maps,lake}' IS NOT NULL THEN jsonb_build_object(
              'unlockedAt',t.state#>'{maps,lake,unlockedAt}','stage',t.state#>'{maps,lake,stage}',
              'harvested',t.state#>'{maps,lake,harvested}','collections',t.state#>'{maps,lake,collections}',
              'built',t.state#>'{maps,lake,built}','settled',t.state#>'{maps,lake,settled}',
              'boostedSeconds',t.state#>'{maps,lake,boostedSeconds}','earned',t.state#>'{maps,lake,earned}') END)) END AS town,
          GREATEST(completed.latest,quiz.latest,study.latest,drinks.latest,u.updated_at,w.updated_at,d.updated_at,m.updated_at,f.updated_at,t.updated_at,rr.updated_at) AS last_activity_at
        FROM owned p
        LEFT JOIN daily_quiz_progress dq ON dq.profile_id=p.id
        LEFT JOIN cabbage_roll_sessions cr ON cr.profile_id=p.id
        LEFT JOIN ufo_progress u ON u.profile_id=p.id
        LEFT JOIN road_racing_progress rr ON rr.profile_id=p.id
        LEFT JOIN math_wall_progress w ON w.profile_id=p.id
        LEFT JOIN infinidrill_progress d ON d.profile_id=p.id
        LEFT JOIN miniku_progress m ON m.profile_id=p.id
        LEFT JOIN fishing_progress f ON f.profile_id=p.id
        LEFT JOIN town_state t ON t.profile_id=p.id
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS total,MAX(done_at) AS latest FROM profile_progress WHERE profile_id=p.id) completed ON true
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS attempts,
          COUNT(*) FILTER (WHERE total>0 AND score::numeric/NULLIF(total,0) >= CASE WHEN item_id IS NULL THEN 0.7 ELSE 0.8 END)::int AS passes,
          COUNT(*) FILTER (WHERE item_id IS NOT NULL AND total>0 AND score::numeric/NULLIF(total,0)>=0.8)::int AS item_passes,
          COUNT(*) FILTER (WHERE item_id IS NULL AND total>0 AND score::numeric/NULLIF(total,0)>=0.7)::int AS daily_passes,
          MAX(completed_at) AS latest FROM quiz_attempts WHERE profile_id=p.id) quiz ON true
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS sessions,COALESCE(SUM(cards_shown),0)::int AS cards,
          MAX(completed_at) AS latest FROM flashcard_study_sessions WHERE profile_id=p.id) study ON true
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS total,MAX(created_at) AS latest FROM town_reward_events
          WHERE profile_id=p.id AND event_id LIKE 'drink:%') drinks ON true
        LEFT JOIN LATERAL (SELECT jsonb_agg(recent_item ORDER BY completed_at DESC,item_id) AS items FROM (
          SELECT progress.item_id,progress.category,progress.done_at AS completed_at,
            COALESCE((SELECT title FROM item_translations WHERE item_id=progress.item_id ORDER BY (lang='en') DESC,lang LIMIT 1),'Untitled') AS title
          FROM profile_progress progress JOIN items item ON item.id=progress.item_id
          WHERE progress.profile_id=p.id AND ((item.source_type='system' AND item.is_published=true) OR item.owner_family_id=$1
            OR EXISTS (SELECT 1 FROM lesson_audiences audience LEFT JOIN profiles target ON target.id=audience.target_profile_id
              WHERE audience.item_id=item.id AND (audience.target_family_id=$1 OR target.family_id=$1)))
          ORDER BY progress.done_at DESC,progress.item_id LIMIT 8
        ) recent_item) recent ON true
        ORDER BY p.created_at,p.id`, [familyId]);
      return summarizeFamily(result.rows.map(summarizeChild), new Date());
    },
  };
}
