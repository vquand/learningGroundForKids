import { recordAdventure } from '../adventures/events.js';
import { randomInt } from 'node:crypto';
import type { Pool } from 'pg';
import { AppError } from '../errors.js';
import { applyCommand, emptyProgress, publicState, type MinikuBoard, type MinikuCommand, type MinikuProgress, type MinikuPublicState } from './game.js';

export interface MinikuRepository {
  get(profileId: string): Promise<MinikuPublicState>;
  mutate(profileId: string, revision: number, command: MinikuCommand): Promise<MinikuPublicState>;
}

export function createMinikuRepository(pool: Pool): MinikuRepository {
  return {
    async get(profileId) {
      const result = await pool.query<{ state: MinikuProgress }>('SELECT state FROM miniku_progress WHERE profile_id=$1', [profileId]);
      return publicState(result.rows[0]?.state ?? emptyProgress());
    },
    async mutate(profileId, revision, command) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO miniku_progress (profile_id,state) VALUES ($1,$2) ON CONFLICT DO NOTHING', [profileId, JSON.stringify(emptyProgress())]);
        const result = await client.query<{ state: MinikuProgress }>('SELECT state FROM miniku_progress WHERE profile_id=$1 FOR UPDATE', [profileId]);
        const progress = result.rows[0]?.state;
        if (!progress) throw new AppError(500, 'MINIKU_STATE_MISSING', 'The Miniku board could not be loaded.');
        if (progress.revision !== revision) throw new AppError(409, 'MINIKU_STALE_SESSION', 'This board changed in another tab. Reload to continue.');
        let next: MinikuProgress;
        if (command.type === 'start' || command.type === 'new-puzzle') {
          const puzzles = await client.query<{ size: MinikuBoard['size']; givens: number[]; solution: number[] }>(
            'SELECT size,givens,solution FROM miniku_puzzles WHERE enabled=true AND size=$1 AND (owner_family_id IS NULL OR owner_family_id=(SELECT family_id FROM profiles WHERE id=$2)) ORDER BY random() LIMIT 1 FOR SHARE', [command.size, profileId]);
          const puzzle = puzzles.rows[0];
          if (puzzle) {
            next = structuredClone(progress);
            next.board = { ...puzzle, entries: puzzle.givens.map(value => value || null), status: 'playing', selectedIndex: null };
          } else next = applyCommand(progress, command, Date.now(), max => randomInt(0, max));
        } else next = applyCommand(progress, command, Date.now(), max => randomInt(0, max));
        next.revision += 1;
        if(next.completed>progress.completed)await recordAdventure(client,profileId,{key:`miniku:${next.revision}`,game:'miniku',kind:'miniku_completed',data:{amount:next.board!.size}});
        await client.query('UPDATE miniku_progress SET state=$2,updated_at=now() WHERE profile_id=$1', [profileId, JSON.stringify(next)]);
        await client.query('COMMIT');
        return publicState(next);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
