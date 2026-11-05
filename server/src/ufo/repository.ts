import { recordAdventure } from '../adventures/events.js';
import { creditTown } from '../town-building/repository.js';
import { wordReward } from '../town-building/rewards.js';
import { randomInt, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { AppError } from '../errors.js';
import { applyAction, emptyProgress, publicState, startSession, type Action, type Progress, type Settings, type Word } from './game.js';
import english from './dictionary.js';
import vietnamese from './dictionary.vi.js';
const master = [...english.map(word => ({ ...word, language: 'en' as const })), ...vietnamese];
export interface UfoRepository {
  list(): Promise<Word[]>;
  save(input: Omit<Word, 'id'>, id?: string): Promise<Word>;
  remove(id: string): Promise<void>;
  loadMaster(): Promise<number>;
  get(profileId: string): Promise<ReturnType<typeof publicState>>;
  mutate(profileId: string, revision: number, input: { settings: Settings } | { action: Action }): Promise<ReturnType<typeof publicState>>;
}
export function createUfoRepository(pool: Pool): UfoRepository {

  return {
    async list() {
      return (await pool.query<Word>('SELECT id, language, word, difficulty, clue, definition FROM ufo_words ORDER BY language, difficulty, word')).rows;
    },
    async save(input, id) {

      try {

        const args = [input.word, input.difficulty, input.clue, input.definition, input.language ?? 'en'];

        const result = id ? await pool.query<Word>('UPDATE ufo_words SET word=$1,difficulty=$2,clue=$3,definition=$4,language=$5 WHERE id=$6 RETURNING *', [...args, id]) : await pool.query<Word>('INSERT INTO ufo_words (word,difficulty,clue,definition,language,id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [...args, randomUUID()]);

        if (!result.rows[0])
          throw new AppError(404, 'UFO_WORD_NOT_FOUND', 'Word not found.');
        return result.rows[0];

      } catch (e) {
        if ((e as { code?: string }).code === '23505')
          throw new AppError(409, 'UFO_WORD_DUPLICATE', 'This word already exists.');
        throw e;
      }

    },
    async remove(id) {
      const r = await pool.query('DELETE FROM ufo_words WHERE id=$1', [id]);
      if (!r.rowCount)
        throw new AppError(404, 'UFO_WORD_NOT_FOUND', 'Word not found.');
    },
    async loadMaster() {

      const client = await pool.connect();
      let count = 0;

      try {
        await client.query('BEGIN');
        for (const w of master) {
          const r = await client.query('INSERT INTO ufo_words (id,word,difficulty,clue,definition,language) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (language,word) DO NOTHING', [randomUUID(), w.word, w.difficulty, w.clue, w.definition, w.language]);
          count += r.rowCount ?? 0;
        }
        await client.query('COMMIT');
        return count;
      }
      catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

    },
    async get(profileId) {
      const r = await pool.query<{ state: Progress }>('SELECT state FROM ufo_progress WHERE profile_id=$1', [profileId]);
      return publicState(r.rows[0]?.state ?? emptyProgress());
    },
    async mutate(profileId, revision, input) {

      const client = await pool.connect();

      try {

        await client.query('BEGIN');

        await client.query('INSERT INTO ufo_progress (profile_id,state) VALUES ($1,$2) ON CONFLICT DO NOTHING', [profileId, JSON.stringify(emptyProgress())]);

        const result = await client.query<{ state: Progress }>('SELECT state FROM ufo_progress WHERE profile_id=$1 FOR UPDATE', [profileId]);

        const p = result.rows[0]!.state;

        if (p.revision !== revision)
          throw new AppError(409, 'UFO_STALE_SESSION', 'This game changed in another tab. Reload to continue.');

        const selecting = 'settings' in input || input.action.type === 'next';

        const difficulty = 'settings' in input ? input.settings.difficulty : p.session?.difficulty;

        const language = 'settings' in input ? input.settings.language ?? 'en' : p.session?.language ?? 'en';
        const words = selecting ? (await client.query<Word>('SELECT id,language,word,difficulty,clue,definition FROM ufo_words WHERE difficulty=$1 AND language=$2', [difficulty, language])).rows : [];

        const next = 'settings' in input ? startSession(p, input.settings, words, Date.now(), randomInt) : applyAction(p, input.action, words, Date.now(), randomInt);

        next.revision = p.revision + 1;

        const reward = next.stats.solved > p.stats.solved ? wordReward(next.session!.difficulty) : {};
        await creditTown(client, profileId, `ufo:${next.revision}`, reward);
        if(next.stats.solved>p.stats.solved)await recordAdventure(client,profileId,{key:`ufo:${next.revision}`,game:'ufo',kind:'ufo_solved',data:{subject:next.session!.word.word,difficulty:next.session!.difficulty}});
        await client.query('UPDATE ufo_progress SET state=$2,updated_at=now() WHERE profile_id=$1', [profileId, JSON.stringify(next)]);

        await client.query('COMMIT');
        return { ...publicState(next), ...(Object.keys(reward).length ? { townReward: reward } : {}) };

      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

    },
  };

}
