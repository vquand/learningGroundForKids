import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { AppError } from '../errors.js';
import { validatePuzzle, type BoardSize } from './game.js';
export interface PuzzleDefinition { id:string; size:BoardSize; givens:number[]; enabled:boolean; revision:number; ownerFamilyId:string|null }
export interface PuzzleInput { givens:number[]; enabled:boolean; revision:number }
export interface MinikuCatalogRepository {
  list(familyId?:string): Promise<PuzzleDefinition[]>;
  create(input:{ size:BoardSize; givens:number[]; enabled:boolean }, familyId?:string):Promise<PuzzleDefinition>;
  update(id:string, input:PuzzleInput, familyId?:string):Promise<PuzzleDefinition>;
  hints(familyId:string):Promise<boolean>;
  setHints(familyId:string, enabled:boolean):Promise<void>;
}
const columns='id,size,givens,enabled,revision,owner_family_id AS "ownerFamilyId"';
function duplicate(error:unknown):never {
  if(error && typeof error==='object' && 'code' in error && error.code==='23505') throw new AppError(409,'MINIKU_DUPLICATE_PUZZLE','Another puzzle in this list already has this clue layout, including disabled puzzles.');
  throw error;
}
export function createMinikuCatalog(pool:Pool):MinikuCatalogRepository {
  return {
    async list(familyId) {
      return (await pool.query<PuzzleDefinition>(`SELECT ${columns} FROM miniku_puzzles WHERE ${familyId ? 'owner_family_id=$1' : 'owner_family_id IS NULL'} ORDER BY size,id`,familyId ? [familyId] : [])).rows;
    },
    async create(input,familyId) {
      const board=validatePuzzle(input.size,input.givens);
      try {
        return (await pool.query<PuzzleDefinition>(`INSERT INTO miniku_puzzles(id,size,givens,solution,enabled,owner_family_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${columns}`,[randomUUID(),input.size,JSON.stringify(board.givens),JSON.stringify(board.solution),input.enabled,familyId ?? null])).rows[0]!;
      } catch(error) { return duplicate(error); }
    },
    async update(id,input,familyId) {
      const row=(await pool.query<PuzzleDefinition>(`SELECT ${columns} FROM miniku_puzzles WHERE id=$1 AND ${familyId ? 'owner_family_id=$2' : 'owner_family_id IS NULL'}`,[id,...(familyId ? [familyId] : [])])).rows[0];
      if(!row) throw new AppError(404,'MINIKU_PUZZLE_NOT_FOUND','Puzzle not found.');
      const board=validatePuzzle(row.size,input.givens);
      try {
        const result=await pool.query<PuzzleDefinition>(`UPDATE miniku_puzzles SET givens=$2,solution=$3,enabled=$4,revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$5 RETURNING ${columns}`,[id,JSON.stringify(board.givens),JSON.stringify(board.solution),input.enabled,input.revision]);
        if(!result.rows[0]) throw new AppError(409,'MINIKU_PUZZLE_STALE','Another tab changed this puzzle. Reload before editing.');
        return result.rows[0];
      } catch(error) { return duplicate(error); }
    },
    async hints(familyId) { return (await pool.query<{hints:boolean}>('SELECT hints FROM miniku_family_settings WHERE family_id=$1',[familyId])).rows[0]?.hints ?? true; },
    async setHints(familyId,hints) { await pool.query('INSERT INTO miniku_family_settings(family_id,hints) VALUES ($1,$2) ON CONFLICT(family_id) DO UPDATE SET hints=excluded.hints',[familyId,hints]); },
  };
}
