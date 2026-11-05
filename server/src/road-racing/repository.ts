import { randomUUID, randomInt } from 'node:crypto';
import type { Pool } from 'pg';
import { AppError } from '../errors.js';
import { canonicalJson, creditTown } from '../town-building/repository.js';
import { emptyProgress, startRace, act, normalizeProgress, publicState, forfeit, payout, type Progress, type Settings, type Action } from './game.js';
export interface RoadRacingRepository {
  get(profileId:string):Promise<ReturnType<typeof publicState>>;
  mutate(profileId:string,input:{revision:number;settings:Settings}|{revision:number;raceId:string;action:Action}|{raceId:string;leave:true}):Promise<ReturnType<typeof publicState>>;
}
export function stableRepairRandom(progress: Progress): () => number {
  const source = canonicalJson(progress.race?.question ?? null);
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
export function createRoadRacingRepository(pool:Pool, clock=Date.now):RoadRacingRepository {
  async function read(profileId: string) {
    const result = await pool.query<{ state: Progress }>('SELECT state FROM road_racing_progress WHERE profile_id=$1', [profileId]);
    const raw = result.rows[0]?.state ?? emptyProgress();
    const normalized = normalizeProgress(raw, stableRepairRandom(raw));
    const visible = structuredClone(normalized);
    forfeit(visible); // Loading/reloading never resumes an abandoned race.
    return publicState(visible, clock());
  }
  async function transaction(profileId:string,input?:Parameters<RoadRacingRepository['mutate']>[1]) {
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO road_racing_progress(profile_id,state) VALUES($1,$2) ON CONFLICT DO NOTHING',[profileId,JSON.stringify(emptyProgress())]);
      const before=(await client.query<{state:Progress}>('SELECT state FROM road_racing_progress WHERE profile_id=$1 FOR UPDATE',[profileId])).rows[0]!.state;
      const normalized=normalizeProgress(before, stableRepairRandom(before));
      let next=structuredClone(normalized);const now=clock();
      if(!input) throw new AppError(500,'ROAD_RACING_INTERNAL','Road Racing mutations require an input.');
      if('leave' in input){if(next.race?.id===input.raceId)forfeit(next);}
      else {
        if(before.revision!==input.revision)throw new AppError(409,'ROAD_RACING_STALE','This race changed in another tab.');
        if('settings' in input)next=startRace(normalized,input.settings,now,()=>randomInt(1000000)/1000000,randomUUID());
        else {
          if(normalized.race?.id!==input.raceId)throw new AppError(409,'ROAD_RACING_STALE','This race has changed.');
          next=act(normalized,input.action,now,()=>randomInt(1000000)/1000000);
        }
      }
      if(next.stats.finished>normalized.stats.finished)await creditTown(client,profileId,`road-racing:${next.race!.id}`,payout(next.race!.place!));
      // jsonb reorders keys and normalization rebuilds objects, so compare semantically to avoid phantom revision bumps.
      if(canonicalJson(next)!==canonicalJson(before)) {
        next.revision=normalized.revision+1;
        await client.query('UPDATE road_racing_progress SET state=$2,updated_at=now() WHERE profile_id=$1',[profileId,JSON.stringify(next)]);
      }
      await client.query('COMMIT');return publicState(next,now);
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  return {get:read,mutate:transaction};
}
