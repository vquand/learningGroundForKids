import { recordAdventure } from '../adventures/events.js';
import { canonicalJson, creditTown } from '../town-building/repository.js';
import { wallReward } from '../town-building/rewards.js';
import type { Cost } from '../town-building/game.js';
import { randomInt } from 'node:crypto';
import type { Pool } from 'pg';
import { AppError } from '../errors.js';
import { applyAction, emptyProgress, normalizeProgress, publicState, startSession, type Action, type Progress, type Settings, type PublicState } from './game.js';

export interface Leader { name: string; score: number; self: boolean }
export interface MathWallRepository {
  get(profileId: string): Promise<PublicState>;
  mutate(profileId: string, revision: number, input: { settings: Settings } | { action: Action }): Promise<PublicState & { townReward?: Cost }>;
  leaderboard(profileId: string): Promise<Leader[]>;
}

/** Repair the same broken saved question to the same replacement on every read. */
export function stableRepairRandom(progress: Progress): () => number {
  const source = canonicalJson(progress.session?.question ?? null);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 13), 0x5bd1e995);
    return (hash >>> 0) / 0x100000000;
  };
}
export function createMathWallRepository(pool: Pool): MathWallRepository {
  const pick = (maximumExclusive: number) => randomInt(0, Math.max(1, maximumExclusive));
  return {
    async get(profileId) {
      const result = await pool.query<{ state: Progress }>('SELECT state FROM math_wall_progress WHERE profile_id=$1', [profileId]);
      const raw = result.rows[0]?.state ?? emptyProgress();
      return publicState(normalizeProgress(raw, stableRepairRandom(raw)), Date.now());
    },
    async mutate(profileId, revision, input) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO math_wall_progress (profile_id,state) VALUES ($1,$2) ON CONFLICT DO NOTHING', [profileId, JSON.stringify(emptyProgress())]);
        const result = await client.query<{ state: Progress }>('SELECT state FROM math_wall_progress WHERE profile_id=$1 FOR UPDATE', [profileId]);
        const raw = result.rows[0]!.state;
        const progress = normalizeProgress(raw, stableRepairRandom(raw));
        if (canonicalJson(progress) !== canonicalJson(raw)) {
          await client.query('UPDATE math_wall_progress SET state=$2,updated_at=now() WHERE profile_id=$1', [profileId, JSON.stringify(progress)]);
        }
        if (progress.revision !== revision) throw new AppError(409, 'MATH_WALL_STALE_SESSION', 'This game changed in another tab. Reload to continue.');
        const now = Date.now();
        const next = 'settings' in input ? startSession(progress, input.settings, now, pick) : applyAction(progress, input.action, now, pick);
        next.revision++;
        const reward = next.stats.passed > progress.stats.passed ? wallReward(next.session!.difficulty) : {};
        await creditTown(client, profileId, `waddle:${next.revision}`, reward);
        if(next.stats.passed>progress.stats.passed)await recordAdventure(client,profileId,{key:`waddle:${next.revision}`,game:'math-wall',kind:'waddle_passed',data:{amount:next.session!.score,difficulty:next.session!.difficulty}});
        await client.query('UPDATE math_wall_progress SET state=$2,best_score=$3,updated_at=now() WHERE profile_id=$1', [profileId, JSON.stringify(next), next.best]);
        await client.query('COMMIT');
        return { ...publicState(next, now), ...(Object.keys(reward).length ? { townReward: reward } : {}) };
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    async leaderboard(profileId) {
      // Both sides must explicitly select a kid. Family-wide friendships never
      // grant leaderboard visibility, including mixed profile/family requests.
      const result = await pool.query<Leader>(`SELECT p.name, COALESCE(m.best_score,0) AS score, p.id=$1 AS self
        FROM profiles p LEFT JOIN math_wall_progress m ON m.profile_id=p.id
        WHERE p.id=$1 OR EXISTS (SELECT 1 FROM friend_requests f
          WHERE f.status='accepted' AND f.requesting_scope='profile' AND f.target_scope='profile'
          AND ((f.requesting_profile_id=$1 AND f.target_profile_id=p.id)
            OR (f.target_profile_id=$1 AND f.requesting_profile_id=p.id)))
        ORDER BY score DESC, self DESC, p.name, p.id`, [profileId]);
      return result.rows;
    },
  };
}
