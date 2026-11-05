import { parentPort } from 'node:worker_threads';
import { tickMap } from './mapTick.ts';
import type { MapId } from './maps/types.ts';
import type { TownState } from './game.js';
import type { GardenEnvironment } from './garden.js';

export interface GardenWork { state: TownState; mapId: MapId; now: number; environment: GardenEnvironment; resume: boolean }
export type GardenResult = { ok: true; state: TownState } | { ok: false };

// This thread receives only owned, server-loaded state and server-derived time.
// All simulation, including navigation reconstruction, stays off the API loop.
parentPort!.on('message', (work: GardenWork) => {
    try {
        parentPort!.postMessage({ ok: true, state: tickMap(work.state, work.mapId, work.now, work.environment, work.resume) } satisfies GardenResult);
    } catch {
        parentPort!.postMessage({ ok: false } satisfies GardenResult);
    }
});
