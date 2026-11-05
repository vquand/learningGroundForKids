import type { Context } from 'hono';
import type { App } from '../contracts/app.js';
import { ENGLISH_LETTERS, VIETNAMESE_CHARACTERS } from './letters.js';
import { z } from 'zod';
import { parseJson, parsePathId } from '../input.js';
import { AppError } from '../errors.js';
import type { AppDatabase } from '../contracts/db.js';
const difficulty = z.enum(['easy', 'medium', 'hard']);
const settings = z.object({ language: z.enum(['en', 'vi']).default('en'), difficulty, animal: z.enum(['cow', 'highland', 'sheep', 'capybara']), background: z.enum(['farm', 'forest', 'lake']) }).strict();
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const wordSchema = z.object({ language: z.enum(['en', 'vi']).default('en'), word: z.string().trim().toUpperCase().transform(value => value.normalize('NFC').replace(/ +/g, ' ')), difficulty, clue: z.string().trim().min(3).max(180), definition: z.string().trim().min(3).max(220) }).strict().superRefine((value, context) => {
  const letters = value.language === 'vi' ? VIETNAMESE_CHARACTERS : ENGLISH_LETTERS;
  if (value.word.length < 2 || value.word.length > (value.language === 'vi' ? 30 : 18) || [...value.word].some(letter => !(value.language === 'vi' && letter === ' ') && !letters.includes(letter))) context.addIssue({ code: 'custom', path: ['word'], message: 'Use letters from the selected language (2–18 English letters or 2–30 Vietnamese letters/spaces).' });
});
const action = z.discriminatedUnion('type', [z.object({ type: z.literal('guess'), letter: z.string().regex(/^[A-ZĂÂĐÊÔƠƯ]$/u) }).strict(), z.object({ type: z.enum(['hint', 'shoo', 'next']) }).strict()]);
export function registerUfoRoutes(app: App, db: AppDatabase, maxBodyBytes: number, owned: (c: Context, db: AppDatabase, id: string) => Promise<unknown>, admin: (c: Context) => unknown) {

  const repo = () => {
    if (!db.ufo)
      throw new AppError(503, 'UFO_UNAVAILABLE', 'The word game is not available.');
    return db.ufo;
  };

  const method = () => {
    throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  };

  app.all('/api/v1/profiles/:profileId/ufo', async c => {
    const id = parsePathId(c.req.param('profileId'));
    await owned(c, db, id);
    if (c.req.method !== 'GET')
      return method();
    return c.json(await repo().get(id));
  });

  app.all('/api/v1/profiles/:profileId/ufo/start', async c => {
    const id = parsePathId(c.req.param('profileId'));
    await owned(c, db, id);
    if (c.req.method !== 'POST')
      return method();
    const input = await parseJson(c.req.raw, z.object({ revision, settings }).strict(), maxBodyBytes);
    return c.json(await repo().mutate(id, input.revision, { settings: input.settings }));
  });

  app.all('/api/v1/profiles/:profileId/ufo/action', async c => {
    const id = parsePathId(c.req.param('profileId'));
    await owned(c, db, id);
    if (c.req.method !== 'POST')
      return method();
    const input = await parseJson(c.req.raw, z.object({ revision, action }).strict(), maxBodyBytes);
    return c.json(await repo().mutate(id, input.revision, { action: input.action }));
  });

  app.all('/api/v1/admin/ufo/words', async c => {
    admin(c);
    if (c.req.method === 'GET')
      return c.json(await repo().list());
    if (c.req.method === 'POST')
      return c.json(await repo().save(await parseJson(c.req.raw, wordSchema, maxBodyBytes)), 201);
    return method();
  });

  app.all('/api/v1/admin/ufo/words/master', async c => {
    admin(c);
    if (c.req.method !== 'POST')
      return method();
    return c.json({ added: await repo().loadMaster() });
  });

  app.all('/api/v1/admin/ufo/words/:wordId', async c => {
    admin(c);
    const id = parsePathId(c.req.param('wordId'));
    if (c.req.method === 'PUT')
      return c.json(await repo().save(await parseJson(c.req.raw, wordSchema, maxBodyBytes), id));
    if (c.req.method === 'DELETE') {
      await repo().remove(id);
      return c.body(null, 204);
    }
    return method();
  });

}
