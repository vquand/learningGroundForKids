import { recordAdventure } from '../adventures/events.js';
import { getUpgrade } from './upgrades.js';
import { canonicalJson, creditTown } from '../town-building/repository.js';
import { bonusSandFromRock, minedTownMaterials } from '../town-building/rewards.js';
import type { Pool } from 'pg';
import { randomInt } from 'node:crypto';
import { AppError } from '../errors.js';
import { applyCommand, emptyProgress, normalizeProgress, publicState, type Command, type Progress, type PublicState } from './progress.js';
export interface InfinidrillRepository {
  get(profileId: string): Promise<PublicState>;
  mutate(profileId: string, revision: number, command: Command): Promise<PublicState>;
}

/** A broken legacy question must project identically on GET and the next mutation. */
export function stableRepairRandom(progress: Progress): () => number {
  const source = canonicalJson(progress.game?.currentQuestion ?? null);
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
export function createInfinidrillRepository(pool: Pool): InfinidrillRepository {
  return {
    async get(profileId) {
      const result = await pool.query<{ state: Progress }>('SELECT state FROM infinidrill_progress WHERE profile_id=$1', [profileId]);
      const raw = result.rows[0]?.state ?? emptyProgress();
      const progress = normalizeProgress(raw, { random: stableRepairRandom(raw) });
      return publicState(progress);
    },
    async mutate(profileId, revision, command) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO infinidrill_progress (profile_id,state) VALUES ($1,$2) ON CONFLICT DO NOTHING', [profileId, JSON.stringify(emptyProgress())]);
        const result = await client.query<{ state: Progress }>('SELECT state FROM infinidrill_progress WHERE profile_id=$1 FOR UPDATE', [profileId]);
        const raw = result.rows[0]!.state;
        const progress = normalizeProgress(raw, { random: stableRepairRandom(raw) });
        if (canonicalJson(progress) !== canonicalJson(raw)) {
          await client.query('UPDATE infinidrill_progress SET state=$2,updated_at=now() WHERE profile_id=$1', [profileId, JSON.stringify(progress)]);
        }
        if (progress.revision !== revision) throw new AppError(409, 'INFINIDRILL_STALE_SESSION', 'The game changed in another tab. Sync the game to continue.');
        const next = applyCommand(progress, command, Date.now(), { random: () => randomInt(0, 1_000_000) / 1_000_000 });
        const townLoot = minedTownMaterials(progress.game, next.game);
        const bonus = bonusSandFromRock(townLoot.reward.rock ?? 0, progress.townRockRemainder ?? 0);
        next.townRockRemainder = bonus.remainder;
        const townReward = { ...townLoot.reward };
        if (bonus.sand > 0) townReward.sand = (townReward.sand ?? 0) + bonus.sand;
        await creditTown(client, profileId, `infinidrill:${next.revision}`, townReward);
        if(next.game&&command.type!=='replay'){
          const beforeDepth=progress.game?.depthMetres??0,afterDepth=next.game.depthMetres;
          const firstDig=progress.game?.mainQuestionsCompleted===0&&next.game.mainQuestionsCompleted>0;
          if(firstDig||Math.floor(afterDepth/100)>Math.floor(beforeDepth/100))await recordAdventure(client,profileId,{key:`drill:depth:${next.revision}`,game:'infinidrill',kind:'drill_depth',data:{amount:firstDig?afterDepth:Math.floor(afterDepth/100)*100}});
          if(next.game.mode==='core'&&progress.game?.mode!=='core')await recordAdventure(client,profileId,{key:`drill:core:${next.revision}`,game:'infinidrill',kind:'drill_core',data:{}});
          for(const upgrade of next.game.ownedUpgradeIds.filter(id=>!progress.game?.ownedUpgradeIds.includes(id)))await recordAdventure(client,profileId,{key:`drill:upgrade:${next.revision}:${upgrade}`,game:'infinidrill',kind:'drill_upgrade',data:{subject:getUpgrade(upgrade)!.name}});
        }
        await client.query('UPDATE infinidrill_progress SET state=$2,updated_at=now() WHERE profile_id=$1', [profileId, JSON.stringify(next)]);
        await client.query('COMMIT');
        return { ...publicState(next), ...(townLoot.deposits.length ? { townReward, townDeposits: townLoot.deposits } : {}) };
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
  };
}
