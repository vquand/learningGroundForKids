import type { Context } from 'hono';
import { z } from 'zod';
import type { App } from '../contracts/app.js';
import type { AppDatabase } from '../contracts/db.js';
import { AppError } from '../errors.js';
import { parseJson, parsePathId } from '../input.js';

const command = z.discriminatedUnion('type', [
  z.object({ type: z.enum(['start', 'new-puzzle']), size: z.union([z.literal(3), z.literal(4), z.literal(5)]) }).strict(),
  z.object({ type: z.literal('select-cell'), index: z.number().int().min(0).max(24) }).strict(),
  z.object({ type: z.literal('set-cell'), index: z.number().int().min(0).max(24), value: z.number().int().min(1).max(5) }).strict(),
  z.object({ type: z.literal('clear-cell'), index: z.number().int().min(0).max(24) }).strict(),
]);

export function registerMinikuRoutes(app: App, db: AppDatabase, maxBodyBytes: number, owned: (c: Context, db: AppDatabase, id: string) => Promise<unknown>, admin: (c: Context) => unknown) {
  const catalog = () => {
    if (!db.minikuCatalog) throw new AppError(503, 'MINIKU_UNAVAILABLE', 'Miniku puzzle management is unavailable.');
    return db.minikuCatalog;
  };
  const createInput = z.object({ size: z.union([z.literal(3),z.literal(4),z.literal(5)]), givens:z.array(z.number().int().min(0).max(5)).max(25), enabled:z.boolean() }).strict();
  app.post('/api/v1/admin/miniku/puzzles', async c => { admin(c); return c.json(await catalog().create(await parseJson(c.req.raw,createInput,maxBodyBytes)),201); });
  app.post('/api/v1/parent/miniku/puzzles', async c => c.json(await catalog().create(await parseJson(c.req.raw,createInput,maxBodyBytes),c.get('family').id),201));
  app.patch('/api/v1/parent/miniku/puzzles/:puzzleId', async c => {
    const input=await parseJson(c.req.raw,z.object({ givens:z.array(z.number().int().min(0).max(5)).max(25), enabled:z.boolean(), revision:z.number().int().nonnegative() }).strict(),maxBodyBytes);
    return c.json(await catalog().update(parsePathId(c.req.param('puzzleId')),input,c.get('family').id));
  });
  app.get('/api/v1/admin/miniku/puzzles', async c => { admin(c); return c.json(await catalog().list()); });
  app.patch('/api/v1/admin/miniku/puzzles/:puzzleId', async c => {
    admin(c);
    const input = await parseJson(c.req.raw, z.object({ givens: z.array(z.number().int().min(0).max(5)).max(25), enabled: z.boolean(), revision: z.number().int().nonnegative() }).strict(), maxBodyBytes);
    return c.json(await catalog().update(parsePathId(c.req.param('puzzleId')), input));
  });
  app.get('/api/v1/parent/miniku/puzzles', async c => c.json(await catalog().list(c.get('family').id)));
  app.get('/api/v1/parent/miniku/settings', async c => c.json({ hints: await catalog().hints(c.get('family').id) }));
  app.patch('/api/v1/parent/miniku/settings', async c => {
    const input = await parseJson(c.req.raw, z.object({ hints: z.boolean() }).strict(), maxBodyBytes);
    await catalog().setHints(c.get('family').id, input.hints);
    return c.json(input);
  });
  for (const suffix of ['', '/action']) app.all(`/api/v1/profiles/:profileId/miniku${suffix}`, async c => {
    const id = parsePathId(c.req.param('profileId'));
    await owned(c, db, id);
    const expected = suffix ? 'POST' : 'GET';
    if (c.req.method !== expected) throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    if (!db.miniku) throw new AppError(503, 'MINIKU_UNAVAILABLE', 'Miniku is unavailable.');
    if (!suffix) return c.json({ ...await db.miniku.get(id), hints: db.minikuCatalog ? await db.minikuCatalog.hints(c.get('family').id) : true });
    const input = await parseJson(c.req.raw, z.object({ revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), command }).strict(), maxBodyBytes);
    return c.json({ ...await db.miniku.mutate(id, input.revision, input.command), hints: db.minikuCatalog ? await db.minikuCatalog.hints(c.get('family').id) : true });
  });
}
