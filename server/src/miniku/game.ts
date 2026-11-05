import { MINIKU_ACHIEVEMENTS, minikuAchievementMetrics } from './achievements.js';
import { AppError } from '../errors.js';

export type BoardSize = 3 | 4 | 5;
export type CellValue = number | null;
export type MinikuStatus = 'playing' | 'complete';

export interface MinikuBoard {
  size: BoardSize;
  givens: number[];
  entries: CellValue[];
  solution: number[];
  status: MinikuStatus;
  selectedIndex: number | null;
}

export interface MinikuProgress {
  revision: number;
  board: MinikuBoard | null;
  completed: number;
  completedBySize: Record<string, number>;
  earned: Record<string, string>;
}

export type MinikuCommand =
  | { type: 'start'; size: BoardSize }
  | { type: 'select-cell'; index: number }
  | { type: 'set-cell'; index: number; value: number }
  | { type: 'clear-cell'; index: number }
  | { type: 'new-puzzle'; size: BoardSize };

export interface MinikuAchievement {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  earnedAt: string | null;
}



function unavailable(message: string): never {
  throw new AppError(409, 'MINIKU_ACTION_UNAVAILABLE', message);
}

export function emptyProgress(): MinikuProgress {
  return { revision: 0, board: null, completed: 0, completedBySize: { '3': 0, '4': 0, '5': 0 }, earned: {} };
}

function shuffle<T>(items: T[], pick: (max: number) => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = pick(index + 1);
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

function candidates(values: number[], size: BoardSize, index: number): number[] {
  const row = Math.floor(index / size), column = index % size;
  const used = new Set<number>();
  for (let offset = 0; offset < size; offset += 1) {
    const rowValue = values[row * size + offset];
    const columnValue = values[offset * size + column];
    if (rowValue) used.add(rowValue);
    if (columnValue) used.add(columnValue);
  }
  return Array.from({ length: size }, (_, value) => value + 1).filter(value => !used.has(value));
}

function countSolutions(values: number[], size: BoardSize, stopAt = 2): number {
  let count = 0;
  function search() {
    if (count >= stopAt) return;
    let best = -1;
    let bestOptions: number[] = [];
    for (let index = 0; index < values.length; index += 1) {
      if (values[index] !== 0) continue;
      const options = candidates(values, size, index);
      if (options.length === 0) return;
      if (best === -1 || options.length < bestOptions.length) {
        best = index;
        bestOptions = options;
        if (options.length === 1) break;
      }
    }
    if (best === -1) {
      count += 1;
      return;
    }
    for (const value of bestOptions) {
      values[best] = value;
      search();
      values[best] = 0;
      if (count >= stopAt) return;
    }
  }
  search();
  return count;
}

function solvesWithSingles(values: number[], size: BoardSize): boolean {
  const working = [...values];
  while (working.some(value => value === 0)) {
    let progress = false;
    for (let index = 0; index < working.length; index += 1) {
      if (working[index] !== 0) continue;
      const options = candidates(working, size, index);
      if (options.length === 0) return false;
      if (options.length === 1) {
        working[index] = options[0]!;
        progress = true;
      }
    }
    if (!progress) return false;
  }
  return true;
}

function generateSolution(size: BoardSize, pick: (max: number) => number): number[] {
  const symbols = shuffle(Array.from({ length: size }, (_, index) => index + 1), pick);
  const rows = shuffle(Array.from({ length: size }, (_, index) => index), pick);
  const columns = shuffle(Array.from({ length: size }, (_, index) => index), pick);
  return rows.flatMap(row => columns.map(column => symbols[(row + column) % size]!));
}

function targetMissing(size: BoardSize): number {
  return size === 3 ? 6 : size === 4 ? 9 : 15;
}

export function generateBoard(size: BoardSize, pick: (max: number) => number): MinikuBoard {
  const solution = generateSolution(size, pick);
  const clues = [...solution];
  const order = shuffle(Array.from({ length: solution.length }, (_, index) => index), pick);
  // Small boards need deliberately sparse clues: avoid layouts where every
  // empty square already has only one possible number at the start.
  if (size === 3) {
    for (const clueCount of [3, 4]) {
      for (let mask = 0; mask < 1 << solution.length; mask += 1) {
        const trial = Array<number>(solution.length).fill(0);
        for (let bit = 0; bit < order.length; bit += 1) {
          if (mask & (1 << bit)) trial[order[bit]!] = solution[order[bit]!]!;
        }
        if (trial.filter(Boolean).length !== clueCount) continue;
        if (!trial.some((value, index) => !value && candidates(trial, size, index).length > 1)) continue;
        if (countSolutions([...trial], size) !== 1 || !solvesWithSingles(trial, size)) continue;
        return { size, givens: trial, entries: trial.map(value => value || null), solution, status: 'playing', selectedIndex: null };
      }
    }
    throw new Error('Unable to generate a logical 3×3 Miniku board.');
  }
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const trial = [...clues];
    const removalOrder = attempt === 0 ? order : shuffle(order, pick);
    let removed = 0;
    for (const index of removalOrder) {
      if (removed >= targetMissing(size)) break;
      const previous = trial[index]!;
      trial[index] = 0;
      if (countSolutions([...trial], size) === 1 && solvesWithSingles(trial, size)) removed += 1;
      else trial[index] = previous;
    }
    if (removed < targetMissing(size)) continue;
    return { size, givens: trial, entries: trial.map(value => value || null), solution, status: 'playing', selectedIndex: null };
  }
  throw new Error('Unable to generate a Miniku board within the starting clue limit.');
}

function conflicts(board: MinikuBoard): number[] {
  const result = new Set<number>();
  const { size, entries } = board;
  for (let index = 0; index < entries.length; index += 1) {
    const value = entries[index];
    if (value === null) continue;
    const row = Math.floor(index / size), column = index % size;
    for (let offset = 0; offset < size; offset += 1) {
      const rowIndex = row * size + offset;
      const columnIndex = offset * size + column;
      if (rowIndex !== index && entries[rowIndex] === value) { result.add(index); result.add(rowIndex); }
      if (columnIndex !== index && entries[columnIndex] === value) { result.add(index); result.add(columnIndex); }
    }
  }
  return [...result].sort((a, b) => a - b);
}

function updateAchievements(progress: MinikuProgress, now: number): void {
  const metrics = minikuAchievementMetrics(progress);
  for (const { id, metric, target } of MINIKU_ACHIEVEMENTS) {
    if (metrics[metric] >= target && !progress.earned[id]) progress.earned[id] = new Date(now).toISOString();
  }
}

export function achievements(progress: MinikuProgress): MinikuAchievement[] {
  return MINIKU_ACHIEVEMENTS.map(({ id, name, description, difficulty }) => ({
    id, name, description, difficulty, earnedAt: progress.earned[id] ?? null,
  }));
}

export function applyCommand(progress: MinikuProgress, command: MinikuCommand, now: number, pick: (max: number) => number): MinikuProgress {
  const next = structuredClone(progress);
  if (command.type === 'start' || command.type === 'new-puzzle') {
    next.board = generateBoard(command.size, pick);
    return next;
  }
  const board = next.board;
  if (!board) unavailable('Choose a board size first.');
  if (command.index < 0 || command.index >= board.entries.length || !Number.isInteger(command.index)) unavailable('That grid cell is not available.');
  if (command.type === 'select-cell') {
    board.selectedIndex = command.index;
    return next;
  }
  if (board.status === 'complete') unavailable('This board is complete. Start another puzzle to keep playing.');
  if (board.givens[command.index] !== 0) unavailable('Clue cells cannot be changed.');
  if (command.type === 'clear-cell') board.entries[command.index] = null;
  else {
    if (!Number.isInteger(command.value) || command.value < 1 || command.value > board.size) unavailable('Choose one of the numbers shown below the board.');
    board.entries[command.index] = command.value;
  }
  board.selectedIndex = command.index;
  const conflictIndices = conflicts(board);
  if (board.entries.every(value => value !== null) && conflictIndices.length === 0 && board.entries.every((value, index) => value === board.solution[index])) {
    board.status = 'complete';
    next.completed += 1;
    next.completedBySize[String(board.size)] = (next.completedBySize[String(board.size)] ?? 0) + 1;
    updateAchievements(next, now);
  }
  return next;
}

export function publicState(progress: MinikuProgress, now = Date.now()) {
  const board = progress.board;
  return {
    revision: progress.revision,
    serverNow: now,
    completed: progress.completed,
    completedBySize: progress.completedBySize,
    board: board ? {
      size: board.size,
      givens: board.givens,
      entries: board.entries,
      status: board.status,
      selectedIndex: board.selectedIndex,
      conflictIndices: conflicts(board),
    } : null,
    achievements: achievements(progress),
  };
}

export type MinikuPublicState = ReturnType<typeof publicState>;

export function achievementDefinitions() {
  return MINIKU_ACHIEVEMENTS.map(({ id, name, description, difficulty }) => ({ id, name, description, difficulty }));
}

/** Validate edited clues and derive the answer only on the server. */
export function validatePuzzle(size: BoardSize, givens: number[]): MinikuBoard {
  if (givens.length !== size * size || givens.some(value => !Number.isInteger(value) || value < 0 || value > size)) {
    throw new AppError(422, 'MINIKU_INVALID_PUZZLE', 'Use one cell per square, with 0 for empty cells and valid digits.');
  }
  const clueCount = givens.filter(Boolean).length;
  if (clueCount > (size === 3 ? 4 : size === 4 ? 7 : 10) || (size === 3 && clueCount < 3)) {
    throw new AppError(422, 'MINIKU_INVALID_PUZZLE', 'Use 3–4 clues for 3×3, at most 7 for 4×4, and at most 10 for 5×5.');
  }
  const draft: MinikuBoard = { size, givens: [...givens], entries: givens.map(value => value || null), solution: [], selectedIndex: null, status: 'playing' };
  if (conflicts(draft).length || countSolutions([...givens], size) !== 1 || !solvesWithSingles(givens, size)) {
    throw new AppError(422, 'MINIKU_INVALID_PUZZLE', 'The clues must have one solution that can be reached without guessing.');
  }
  const solution = [...givens];
  while (solution.includes(0)) {
    for (let index = 0; index < solution.length; index++) {
      if (solution[index]) continue;
      const options = candidates(solution, size, index);
      if (options.length === 1) solution[index] = options[0]!;
    }
  }
  return { ...draft, solution };
}
