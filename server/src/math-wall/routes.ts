import type { Context } from 'hono';
import { z } from 'zod';
import type { App } from '../contracts/app.js';
import type { AppDatabase } from '../contracts/db.js';
import { AppError } from '../errors.js';
import { parseJson, parsePathId } from '../input.js';

const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const settings = z.object({ animal: z.enum(['capybara', 'cow', 'highland']), language: z.enum(['en', 'vi']), wall: z.enum(['brick', 'blocks', 'stone', 'garden']) }).strict();
const action = z.discriminatedUnion('type', [
  z.object({ type: z.literal('lane'), lane: z.number().int().min(0).max(2) }).strict(),
  z.object({ type: z.enum(['settle', 'next', 'pause', 'resume', 'finish']) }).strict(),
]);
export function registerMathWallRoutes(app: App, db: AppDatabase, maxBodyBytes: number, owned: (c: Context, db: AppDatabase, id: string) => Promise<unknown>) {
  const repo = () => {
    if (!db.mathWall) throw new AppError(503, 'MATH_WALL_UNAVAILABLE', 'The math game is not available.');
    return db.mathWall;
  };
  const method = () => { throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.'); };
  app.all('/api/v1/profiles/:profileId/math-wall', async c => {
    const id = parsePathId(c.req.param('profileId')); await owned(c, db, id);
    if (c.req.method !== 'GET') return method();
    return c.json(await repo().get(id));
  });
  app.all('/api/v1/profiles/:profileId/math-wall/leaderboard', async c => {
    const id = parsePathId(c.req.param('profileId')); await owned(c, db, id);
    if (c.req.method !== 'GET') return method();
    return c.json(await repo().leaderboard(id));
  });
  app.all('/api/v1/profiles/:profileId/math-wall/start', async c => {
    const id = parsePathId(c.req.param('profileId')); await owned(c, db, id);
    if (c.req.method !== 'POST') return method();
    const input = await parseJson(c.req.raw, z.object({ revision, settings }).strict(), maxBodyBytes);
    return c.json(await repo().mutate(id, input.revision, { settings: input.settings }));
  });
  app.all('/api/v1/profiles/:profileId/math-wall/action', async c => {
    const id = parsePathId(c.req.param('profileId')); await owned(c, db, id);
    if (c.req.method !== 'POST') return method();
    const input = await parseJson(c.req.raw, z.object({ revision, action }).strict(), maxBodyBytes);
    return c.json(await repo().mutate(id, input.revision, { action: input.action }));
  });
}
