import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { AdventureEvent } from './types.js';

/** Only call from the verified game's transaction, after its progress row lock. */
export async function recordAdventure(client: Pick<PoolClient, 'query'>, profileId: string, event: AdventureEvent): Promise<void> {
  await client.query(`INSERT INTO adventure_events(id,profile_id,event_key,game,kind,data)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(profile_id,event_key) DO NOTHING`,
  [randomUUID(),profileId,event.key,event.game,event.kind,JSON.stringify(event.data)]);
}
