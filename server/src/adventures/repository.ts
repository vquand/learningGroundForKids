import type { Pool } from 'pg';
import type { AdventureCursor, AdventureEntry, AdventurePage } from './types.js';
export interface AdventureRepository {
  list(familyId: string, profileId: string, scope: 'mine' | 'friends', limit: number, cursor: AdventureCursor | null, language: 'en' | 'vi', timeZone?: string): Promise<AdventurePage>;
}
export function createAdventureRepository(pool: Pool): AdventureRepository {
  return { async list(familyId,profileId,scope,limit,cursor,language,timeZone='UTC') {
    const pageSize=Math.min(50,Math.max(1,limit));
    const result=await pool.query<AdventureEntry & { sort_at: string }>(`
      WITH visible_profiles AS MATERIALIZED (
        SELECT p.* FROM profiles p
        WHERE EXISTS(SELECT 1 FROM profiles viewer WHERE viewer.id=$2 AND viewer.family_id=$1)
          AND (($3='mine' AND p.id=$2) OR ($3='friends' AND p.family_id<>$1 AND EXISTS (
            SELECT 1 FROM friend_requests f WHERE f.status='accepted' AND (
              (f.requesting_family_id=$1 AND (f.requesting_scope='family' OR f.requesting_profile_id=$2)
                AND f.target_family_id=p.family_id AND (f.target_scope='family' OR f.target_profile_id=p.id))
              OR (f.target_family_id=$1 AND (f.target_scope='family' OR f.target_profile_id=$2)
                AND f.requesting_family_id=p.family_id AND (f.requesting_scope='family' OR f.requesting_profile_id=p.id))
            ))))
      ), events AS (
        SELECT e.id,e.profile_id,e.game,e.kind,e.data,e.created_at
        FROM adventure_events e JOIN visible_profiles p ON p.id=e.profile_id
        UNION ALL
        SELECT 'explore:'||p.id,p.profile_id,'explore','explore_learned',jsonb_build_object('itemId',p.item_id),p.done_at
        FROM profile_progress p JOIN visible_profiles actor ON actor.id=p.profile_id
        WHERE NOT EXISTS (SELECT 1 FROM adventure_events a WHERE a.profile_id=p.profile_id AND a.event_key='explore:'||p.item_id)
      ), visible_events AS (
        SELECT e.* FROM events e LEFT JOIN items i ON i.id=e.data->>'itemId'
        WHERE NOT(e.data ? 'itemId') OR (i.is_published AND (i.owner_family_id IS NULL OR i.owner_family_id=$1 OR EXISTS (
          SELECT 1 FROM lesson_audiences a WHERE a.item_id=i.id AND (a.target_family_id=$1 OR a.target_profile_id=$2))))
      ), keyed AS (
        SELECT e.*,
          -- Subtract local minutes/seconds from the actual instant. This keeps
          -- fractional-offset hour boundaries and repeated DST hours distinct.
          e.created_at - EXTRACT(MINUTE FROM e.created_at AT TIME ZONE $8)*INTERVAL '1 minute'
            - EXTRACT(SECOND FROM e.created_at AT TIME ZONE $8)*INTERVAL '1 second' AS hour_at,
          CASE WHEN kind IN ('town_harvest','waddle_passed','drill_depth') THEN data-'amount'
            WHEN kind='explore_learned' THEN data-'itemId'-'subject'
            WHEN kind='ufo_solved' THEN data-'subject'-'difficulty'
            WHEN kind IN ('blueprint_unlocked','town_milestone','drill_upgrade') THEN data-'subject'
            ELSE data END AS activity,
          CASE WHEN jsonb_typeof(data->'amount')='number' THEN (data->>'amount')::numeric ELSE 0 END AS amount
        FROM visible_events e
      ), ranked AS (
        SELECT *,ROW_NUMBER() OVER (hourly ORDER BY created_at DESC,id DESC) AS position,COUNT(*) OVER hourly AS event_count,
          SUM(amount) OVER hourly AS total_amount,MAX(amount) OVER hourly AS best_amount
        FROM keyed WINDOW hourly AS (PARTITION BY profile_id,game,kind,activity,hour_at)
      ), grouped AS (
        SELECT 'hourly:'||md5(jsonb_build_array(profile_id,game,kind,activity,
            to_char(hour_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))::text) AS id,
          profile_id,game,kind,created_at,event_count::int AS count,
          CASE WHEN kind='town_harvest' THEN data||jsonb_build_object('amount',total_amount)
            WHEN kind IN ('waddle_passed','drill_depth') THEN data||jsonb_build_object('amount',best_amount) ELSE data END AS data
        FROM ranked WHERE position=1
      )
      SELECT e.id,e.game,e.kind,e.count,
        CASE WHEN e.data ? 'itemId' THEN e.data||jsonb_build_object('subject',COALESCE(t.title,en.title,'Learned item')) ELSE e.data END AS data,
        to_char(e.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS sort_at,
        to_char(e.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS occurred_at,
        jsonb_build_object('id',p.id,'name',p.name,'emoji',p.emoji,'color',p.color,
          'avatar_type',p.avatar_type,'avatar_url',p.avatar_url,'avatar_frame',p.avatar_frame) AS profile
      FROM grouped e JOIN visible_profiles p ON p.id=e.profile_id
      LEFT JOIN item_translations t ON t.item_id=e.data->>'itemId' AND t.lang=$7
      LEFT JOIN item_translations en ON en.item_id=e.data->>'itemId' AND en.lang='en'
      WHERE ($4::timestamptz IS NULL OR (e.created_at,e.id)<($4::timestamptz,$5::text))
      ORDER BY e.created_at DESC,e.id DESC LIMIT $6`,
      [familyId,profileId,scope,cursor?.at??null,cursor?.id??null,pageSize+1,language,timeZone]);
    const hasMore=result.rows.length>pageSize;
    const entries=result.rows.slice(0,pageSize);
    const last=entries.at(-1);
    const next_cursor=hasMore&&last?Buffer.from(JSON.stringify({at:last.sort_at,id:last.id})).toString('base64url'):null;
    return {entries:entries.map(({sort_at:_sort,...entry})=>entry),next_cursor};
  }};
}
