import { randomInt, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { AppError } from '../errors.js';
import { canonicalJson, creditTown } from '../town-building/repository.js';
import {stockRaftCatch} from '../town-building/raftStock.js';
import { applyCommand, emptyProgress, normalizeProgress, publicState } from './game.js';
import type { FishingCommand, FishingProgress, FishingPublicState } from './types.js';

export interface FishingRepository {
  get(profileId: string): Promise<FishingPublicState>;
  mutate(profileId: string, revision: number, command: FishingCommand): Promise<FishingPublicState>;
}

function hashSource(source: string): number {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) { hash ^= source.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

/** Repair randomness is stable so GET and the next revisioned mutation project the same replacement. */
export function stableRepairRandom(progress: FishingProgress): (maximumExclusive: number) => number {
  let hash = hashSource(canonicalJson(progress.question ?? null));
  return maximumExclusive => {
    hash = Math.imul(hash ^ (hash >>> 13), 0x5bd1e995);
    return maximumExclusive <= 0 ? 0 : Math.floor((hash >>> 0) / 0x100000000 * maximumExclusive);
  };
}

export function stableRepairId(progress: FishingProgress): () => string {
  return () => `fishing-repair-${hashSource(canonicalJson(progress.question ?? null)).toString(36)}`;
}

export function createFishingRepository(pool: Pool, options: {
  now?: () => number; random?: (max: number) => number; id?: () => string;
} = {}): FishingRepository {
  const now = options.now ?? Date.now;
  const random = options.random ?? (max => randomInt(0, max));
  const id = options.id ?? randomUUID;
  return {
    async get(profileId) {
      const rows = await pool.query<{ state: FishingProgress }>('SELECT state FROM fishing_progress WHERE profile_id=$1', [profileId]);
      // Read-only: public projection reports an expired heartbeat as paused; the
      // next revisioned command persists that pause before any possible progress.
      const raw = rows.rows[0]?.state ?? emptyProgress();
      return publicState(normalizeProgress(raw, stableRepairRandom(raw), stableRepairId(raw)), now());
    },
    async mutate(profileId, revision, command) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO fishing_progress(profile_id,state) VALUES ($1,$2) ON CONFLICT DO NOTHING', [profileId, JSON.stringify(emptyProgress())]);
        const rows = await client.query<{ state: FishingProgress }>('SELECT state FROM fishing_progress WHERE profile_id=$1 FOR UPDATE', [profileId]);
        const previous = rows.rows[0]?.state;
        if (!previous) throw new AppError(500, 'FISHING_STATE_MISSING', 'Fishing progress could not be loaded.');
        if (previous.revision !== revision) throw new AppError(409, 'FISHING_STALE_SESSION', 'Fishing changed in another tab. Reload to continue.');
        const timestamp = now();
        const normalized = normalizeProgress(previous, stableRepairRandom(previous), stableRepairId(previous));
        const next = applyCommand(normalized, command, timestamp, random, id);
        const changed = canonicalJson(next) !== canonicalJson(previous);
        if (changed && previous.cast?.phase === 'waiting' && next.cast?.phase === 'result') {
          const cast = next.cast;
          // Durable provenance for future aquarium/meal debits. This ledger and
          // Town reward identity share the same transaction as owned quantities.
          await client.query(`INSERT INTO fishing_cast_results(profile_id,cast_id,location,fish_id,stamina,points)
            VALUES ($1,$2,$3,$4,$5,$6)`, [profileId,cast.id,cast.location,cast.fishId ?? null,cast.stamina ?? 0,cast.points ?? 0]);
          await creditTown(client, profileId, `fishing:cast:${cast.id}`, { stamina: cast.stamina ?? 0 });
          await stockRaftCatch(client,profileId,cast.id,cast.fishId??null,timestamp);
        }
        if (changed) {
          next.revision = normalized.revision + 1;
          await client.query('UPDATE fishing_progress SET state=$2,updated_at=now() WHERE profile_id=$1', [profileId, JSON.stringify(next)]);
        }
        await client.query('COMMIT');
        return publicState(next, timestamp);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  };
}
