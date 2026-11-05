import type { Context } from 'hono';
import { z } from 'zod';
import type { App } from '../contracts/app.js';
import type { AppDatabase } from '../contracts/db.js';
import { AppError } from '../errors.js';
import { parseJson, parsePathId } from '../input.js';
import { BAIT_IDS, COMPANION_IDS, LOCATION_IDS } from './catalog.js';

const command = z.discriminatedUnion('type', [
  z.object({ type: z.literal('select-companion'), companion: z.enum(COMPANION_IDS) }).strict(),
  z.object({ type: z.literal('select-location'), location: z.enum(LOCATION_IDS) }).strict(),
  z.object({ type: z.literal('select-bait'), baitId: z.enum(BAIT_IDS) }).strict(),
  z.object({ type: z.literal('question'), baitId: z.enum(BAIT_IDS) }).strict(),
  z.object({ type: z.literal('answer'), questionId: z.string().min(1).max(128), answer: z.number().int().min(0).max(999999), continuePractice: z.boolean().optional() }).strict(),
  z.object({ type: z.enum(['cast', 'tick', 'pause', 'resume', 'dismiss-question']) }).strict(),
]);

export function registerFishingRoutes(app: App, db: AppDatabase, maxBodyBytes: number,
  owned: (c: Context, db: AppDatabase, id: string) => Promise<unknown>) {
  for (const suffix of ['', '/action']) app.all(`/api/v1/profiles/:profileId/fishing${suffix}`, async c => {
    const profileId = parsePathId(c.req.param('profileId'));
    await owned(c, db, profileId);
    if (c.req.method !== (suffix ? 'POST' : 'GET')) throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    if (!db.fishing) throw new AppError(503, 'FISHING_UNAVAILABLE', 'Fishing Friends is unavailable.');
    if (!suffix) return c.json(await db.fishing.get(profileId));
    const input = await parseJson(c.req.raw, z.object({ revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), command }).strict(), maxBodyBytes);
    return c.json(await db.fishing.mutate(profileId, input.revision, input.command));
  });
}
