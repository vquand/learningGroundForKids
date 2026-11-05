import type { Context } from 'hono';
import { z } from 'zod';
import type { App } from '../contracts/app.js';
import type { AppDatabase } from '../contracts/db.js';
import { AppError } from '../errors.js';
import { parseJson, parsePathId } from '../input.js';
const command = z.discriminatedUnion('type', [
  z.object({ type: z.literal('submit-answer'), questionId: z.string().min(1).max(100), answer: z.number().int().min(0).max(999) }).strict(),
  z.object({ type: z.literal('choose-challenge'), choice: z.enum(['A', 'B']) }).strict(),
  z.object({ type: z.enum(['choose-upgrade-reward', 'purchase-upgrade', 'equip-upgrade']), upgradeId: z.string().min(1).max(100) }).strict(),
  z.object({ type: z.enum(['replay', 'pause', 'resume', 'open-workshop', 'close-workshop']) }).strict(),
]);
export function registerInfinidrillRoutes(app: App, db: AppDatabase, maxBodyBytes: number, owned: (c: Context, db: AppDatabase, id: string) => Promise<unknown>) {
  for (const suffix of ['', '/action']) app.all(`/api/v1/profiles/:profileId/infinidrill${suffix}`, async c => {
    const id = parsePathId(c.req.param('profileId')); await owned(c, db, id);
    const expected = suffix ? 'POST' : 'GET';
    if (c.req.method !== expected) throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    if (!db.infinidrill) throw new AppError(503, 'INFINIDRILL_UNAVAILABLE', 'Infinidrill is unavailable.');
    if (!suffix) return c.json(await db.infinidrill.get(id));
    const input = await parseJson(c.req.raw, z.object({ revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), command }).strict(), maxBodyBytes);
    return c.json(await db.infinidrill.mutate(id, input.revision, input.command));
  });
}
